import { mkdir, readFile, writeFile, copyFile, access } from 'node:fs/promises';
import { resolve, join, relative, isAbsolute } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomInt, createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { format } from 'prettier';
import { validateArtifact } from './validate-artifact.mjs';
import {
  createRun,
  recordCandidate,
  recordReview,
  decidePromotion,
  saveRun,
  loadRun,
  withRunLock,
} from './ledger.mjs';

const execute = promisify(execFile);
const repo = resolve(fileURLToPath(new URL('../../', import.meta.url)));
const families = ['electrical-termination', 'furnace-extraction'];
const args = process.argv.slice(2),
  command = args[0] ?? 'status';
const option = (key, fallback) => {
  const i = args.indexOf(`--${key}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const id = option('id', '2026-10-30-pilot-01');
if (!/^[\w-]{1,80}$/.test(id))
  throw Error(
    'Run id must contain only letters, digits, underscore and hyphen',
  );
const root = join(repo, 'asset-studies/mesh-pilot/runs', id);
const exists = async (path) =>
  access(path).then(
    () => true,
    () => false,
  );
const json = async (path, value) =>
  writeFile(path, await format(JSON.stringify(value), { parser: 'json' }));
const inside = (base, path) => {
  const rel = relative(base, path);
  if (rel.startsWith('..') || isAbsolute(rel))
    throw Error('Artifact path leaves run workspace');
  return path;
};
const ledgerPath = (family) => join(root, `${family}.ledger.json`);
async function contextHash() {
  const hash = createHash('sha256');
  for (const file of [
    'src/features/mesh-pilot/context-view.tsx',
    'src/features/mesh-pilot/mesh-view.tsx',
    'src/features/city/building-preview.tsx',
    'src/rendering/canvas/buildings.ts',
    'src/rendering/canvas/artwork.js',
    'src/app/palette.css',
  ]) {
    hash.update(file);
    hash.update(await readFile(join(repo, file)));
  }
  return hash.digest('hex');
}

async function initialize() {
  await mkdir(root, { recursive: true });
  for (const family of families)
    if (!(await exists(ledgerPath(family))))
      await saveRun(
        ledgerPath(family),
        createRun({
          id: `${id}-${family}`,
          assetId: family,
          maxCandidates: 4,
          maxRevisionRounds: 1,
          incumbent: {
            id: 'legacy-canvas',
            artifactDir: 'asset-studies/foundry/captures/10-functional-kit',
          },
          scope: 'isolated mesh pilot; no automatic city edits',
          reference: 'asset-studies/foundry/reference-v1.png',
        }),
      );
}
async function ingest(dir) {
  inside(join(root, 'candidates'), dir);
  const manifest = JSON.parse(
    await readFile(join(dir, 'manifest.json'), 'utf8'),
  );
  if (!families.includes(manifest.assetId))
    throw Error('Unexpected asset family');
  const checked = await validateArtifact(dir);
  await json(join(dir, 'validation.json'), checked);
  let state = await loadRun(ledgerPath(manifest.assetId));
  const candidateId = `${manifest.assetId}-${manifest.candidateId}`;
  if (state.candidates.some((c) => c.id === candidateId)) {
    const previous = state.candidates.find((c) => c.id === candidateId);
    if (previous.sourceHash !== checked.stats?.geometrySha256)
      throw Error(
        'Previously registered artifact changed; use a fresh candidate identity',
      );
    if (!state.reviews.some((r) => r.candidateId === candidateId)) {
      state = {
        ...state,
        candidates: state.candidates.map((c) =>
          c.id === candidateId
            ? {
                ...c,
                machine: checked,
                validationHistory: [...(c.validationHistory ?? []), c.machine],
              }
            : c,
        ),
      };
      await saveRun(ledgerPath(manifest.assetId), state);
      console.log(
        `${candidateId}: revalidated ${checked.passed ? 'pass' : 'FAILED'}`,
      );
    }
    return;
  }
  const sourceHash =
    checked.stats?.geometrySha256 ??
    createHash('sha256')
      .update(await readFile(join(dir, 'scene.json')))
      .digest('hex');
  state = recordCandidate(state, {
    id: candidateId,
    assetId: manifest.assetId,
    builderId: manifest.builderId ?? 'mesh-builder',
    revisionRound: manifest.revisionRound ?? 0,
    sourceHash,
    artifactDir: relative(repo, dir).replaceAll('\\', '/'),
    machine: checked,
  });
  await saveRun(ledgerPath(manifest.assetId), state);
  const jobsPath = join(root, 'jobs.json');
  if (await exists(jobsPath)) {
    const jobs = JSON.parse(await readFile(jobsPath, 'utf8'));
    await json(
      jobsPath,
      jobs.map((job) =>
        job.id === candidateId
          ? { ...job, status: 'artifact_ready', sourceHash }
          : job,
      ),
    );
  }
  console.log(
    `${candidateId}: ${checked.passed ? 'machine checks pass' : 'FAILED'}${checked.errors.length ? ` — ${checked.errors.join('; ')}` : ''}`,
  );
}
async function sheet() {
  const mappingPath = join(root, 'blind-map.json');
  const previous = (await exists(mappingPath))
    ? JSON.parse(await readFile(mappingPath, 'utf8'))
    : {};
  const map = { ...previous },
    candidates = [];
  for (const family of families) {
    const state = await loadRun(ledgerPath(family));
    const shuffled = [...state.candidates];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = randomInt(i + 1);
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    for (const candidate of shuffled) {
      let label = Object.entries(map).find(([, v]) => v === candidate.id)?.[0];
      if (!label) {
        label = `${family === 'electrical-termination' ? 'E' : 'F'}${1 + Object.keys(map).filter((k) => k.startsWith(family === 'electrical-termination' ? 'E' : 'F')).length}`;
        map[label] = candidate.id;
      }
      const dir = join(root, 'review', label);
      await mkdir(dir, { recursive: true });
      for (const file of ['beauty.png', 'idle.png', 'scene.json'])
        if (await exists(join(repo, candidate.artifactDir, file)))
          await copyFile(
            join(repo, candidate.artifactDir, file),
            join(dir, file),
          );
      candidates.push({
        label,
        assetId: family,
        baseUrl: `/asset-studies/mesh-pilot/runs/${id}/review/${label}`,
        machinePassed: candidate.machine.passed,
        incumbentId: state.incumbent?.id ?? null,
        decision: state.decisions.find((d) => d.candidateId === candidate.id)
          ? {
              promoted: state.decisions.find(
                (d) => d.candidateId === candidate.id,
              ).promoted,
              reasons: state.decisions.find(
                (d) => d.candidateId === candidate.id,
              ).reasons,
            }
          : null,
      });
    }
  }
  await json(mappingPath, map);
  await json(join(root, 'review-sheet.json'), {
    schemaVersion: 1,
    id,
    phase: candidates.every((c) => c.decision)
      ? 'reviewed'
      : 'awaiting_independent_reviews',
    candidates,
    benchmark: '/asset-studies/mesh-pilot/benchmark.md',
    reference: '/asset-studies/foundry/reference-v1.png',
    legacy: '/asset-studies/foundry/captures/10-functional-kit/close.png',
    contextSha256: await contextHash(),
  });
}

await initialize();
await withRunLock(root, async () => {
  if (command === 'batch') {
    const blender = option('blender', process.env.INDUSKORVE_BLENDER);
    const selected = option('candidate', '');
    if (
      selected &&
      (!/^[\w-]+$/.test(selected) ||
        !families.some((f) => selected.startsWith(f + '-')))
    )
      throw Error('Invalid selected builder identity');
    for (const family of families)
      for (const variant of selected
        ? selected.startsWith(family + '-')
          ? [selected.slice(family.length + 1)]
          : []
        : ['A', 'B']) {
        const dir = join(root, 'candidates', `${family}-${variant}`);
        if (!(await exists(join(dir, 'manifest.json')))) {
          if (args.includes('--skip-build')) continue;
          if (!blender)
            throw Error(
              'Set INDUSKORVE_BLENDER or pass --blender with an existing trusted executable. No installation is performed.',
            );
          console.log(`Building ${family}-${variant}`);
          const { stdout, stderr } = await execute(
            blender,
            [
              '--background',
              '--factory-startup',
              '--python',
              join(repo, 'tools/asset-pilot/build_meshes.py'),
              '--',
              '--out',
              root,
              '--palette',
              join(repo, 'src/app/palette.css'),
              '--candidate',
              `${family}-${variant}`,
            ],
            {
              cwd: repo,
              maxBuffer: 16 * 1024 * 1024,
              timeout: 600000,
              windowsHide: true,
            },
          );
          await writeFile(
            join(root, `${family}-${variant}.build.log`),
            stdout + '\n' + stderr,
          );
        }
        await ingest(dir);
      }
    await sheet();
  } else if (command === 'queue-revision') {
    const mapping = JSON.parse(
      await readFile(join(root, 'blind-map.json'), 'utf8'),
    );
    const parentId = mapping[option('label', '')];
    const family = families.find((f) => parentId?.startsWith(f + '-'));
    if (!family) throw Error('Unknown parent blind label');
    const state = await loadRun(ledgerPath(family)),
      parent = state.candidates.find((c) => c.id === parentId);
    const round = parent.revisionRound + 1;
    if (
      round > state.maxRevisionRounds ||
      state.candidates.length >= state.maxCandidates
    )
      throw Error('Revision/candidate budget exhausted');
    const defect = option('defect', ''),
      expected = option('expected', '');
    if (!defect || !expected)
      throw Error(
        'A revision needs an observed defect and predicted improvement',
      );
    const jobsPath = join(root, 'jobs.json');
    const jobs = (await exists(jobsPath))
      ? JSON.parse(await readFile(jobsPath, 'utf8'))
      : [];
    const candidateId = `${parent.id}-r${round}`;
    if (jobs.some((j) => j.id === candidateId))
      throw Error('Revision already queued');
    jobs.push({
      id: candidateId,
      assetId: family,
      parentId,
      parentSourceHash: parent.sourceHash,
      revisionRound: round,
      defect,
      expected,
      status: 'queued',
      output: relative(repo, join(root, 'candidates', candidateId)).replaceAll(
        '\\',
        '/',
      ),
      next: 'Builder authors this one correction in an isolated new candidate directory, then register, capture, and request independent reviews.',
    });
    await json(jobsPath, jobs);
  } else if (command === 'finish') {
    for (const family of families) {
      let state = await loadRun(ledgerPath(family));
      if (
        state.candidates.some(
          (c) => !state.decisions.some((d) => d.candidateId === c.id),
        )
      )
        throw Error(
          'Decide every registered candidate before closing the batch',
        );
      state = {
        ...state,
        status: 'complete',
        metadata: {
          ...state.metadata,
          stopReason: option(
            'reason',
            'Bounded pilot complete; further work needs a new scoped experiment.',
          ),
        },
      };
      await saveRun(ledgerPath(family), state);
    }
  } else if (command === 'register') {
    await ingest(resolve(repo, option('dir', '')));
    await sheet();
  } else if (command === 'review') {
    const review = JSON.parse(
      await readFile(resolve(option('file', '')), 'utf8'),
    );
    const mapping = JSON.parse(
      await readFile(join(root, 'blind-map.json'), 'utf8'),
    );
    const candidateId = mapping[review.label];
    if (!candidateId) throw Error('Unknown blind label');
    const family = families.find((f) => candidateId.startsWith(f + '-'));
    let state = await loadRun(ledgerPath(family));
    let evidence = null;
    if (review.evidenceDir) {
      const captureDir = inside(root, resolve(repo, review.evidenceDir));
      evidence = JSON.parse(
        await readFile(join(captureDir, 'capture.json'), 'utf8'),
      );
    }
    state = recordReview(state, {
      ...review,
      candidateId,
      contextSha256: evidence?.contextSha256 ?? null,
    });
    await saveRun(ledgerPath(family), state);
  } else if (command === 'decide') {
    const mapping = JSON.parse(
      await readFile(join(root, 'blind-map.json'), 'utf8'),
    );
    const candidateId = mapping[option('label', '')];
    if (!candidateId)
      throw Error('Specify --label from the blind review sheet');
    const family = families.find((f) => candidateId.startsWith(f + '-'));
    let state = await loadRun(ledgerPath(family));
    const candidate = state.candidates.find((c) => c.id === candidateId);
    const fresh = await validateArtifact(join(repo, candidate.artifactDir));
    if (!fresh.passed || fresh.stats.geometrySha256 !== candidate.sourceHash)
      throw Error('Artifact failed revalidation or changed after review');
    for (const [file, identity] of Object.entries(candidate.machine.files))
      if (fresh.files[file]?.sha256 !== identity.sha256)
        throw Error(`Artifact bytes changed after registration: ${file}`);
    const visual = state.reviews.find(
      (r) => r.candidateId === candidateId && r.role === 'visual',
    );
    const spatial = state.reviews.find(
      (r) => r.candidateId === candidateId && r.role === 'spatial',
    );
    if (
      visual?.verdict === 'win' &&
      spatial?.verdict === 'pass' &&
      visual.contextSha256 !== (await contextHash())
    )
      throw Error(
        'Visual win is not bound to the current captured context renderer',
      );
    state = decidePromotion(state, {
      candidateId,
      coordinatorId: 'pilot-coordinator',
      nextWork: option('next', ''),
    });
    await saveRun(ledgerPath(family), state);
    console.log(JSON.stringify(state.decisions.at(-1), null, 2));
    const jobsPath = join(root, 'jobs.json');
    if (await exists(jobsPath)) {
      const decision = state.decisions.at(-1),
        jobs = JSON.parse(await readFile(jobsPath, 'utf8'));
      await json(
        jobsPath,
        jobs.map((j) =>
          j.id === candidateId
            ? {
                ...j,
                status: decision.promoted
                  ? 'accepted_for_pilot'
                  : 'stopped_after_review',
                reasons: decision.reasons,
                nextWork: decision.nextWork,
              }
            : j,
        ),
      );
    }
  } else if (command !== 'status')
    throw Error(
      'Use batch, queue-revision, register, review, decide, finish or status',
    );
  for (const family of families) {
    const state = await loadRun(ledgerPath(family));
    console.log(
      `${family}: ${state.candidates.length}/${state.maxCandidates} candidates, ${state.reviews.length} reviews; incumbent ${state.incumbent?.id ?? 'none'}`,
    );
  }
  if (
    ['status', 'review', 'decide', 'queue-revision', 'finish'].includes(command)
  )
    await sheet();
  const states = await Promise.all(families.map((f) => loadRun(ledgerPath(f))));
  await json(join(root, 'run.json'), {
    schemaVersion: 1,
    id,
    phase: states.every((s) => s.status === 'complete') ? 'complete' : 'active',
    scope:
      'isolated asset pilot; promotion updates an experimental incumbent, not the city',
    contextSha256: await contextHash(),
    assets: states.map((s) => ({
      assetId: s.assetId,
      incumbent: s.incumbent,
      candidates: s.candidates.length,
      reviews: s.reviews.length,
      decisions: s.decisions,
      remainingCandidates: s.maxCandidates - s.candidates.length,
      maxRevisionRounds: s.maxRevisionRounds,
      next: s.candidates.some(
        (c) =>
          !s.reviews.some(
            (r) => r.candidateId === c.id && r.role === 'spatial',
          ) ||
          !s.reviews.some((r) => r.candidateId === c.id && r.role === 'visual'),
      )
        ? 'independent reviews required'
        : s.decisions.length < s.candidates.length
          ? 'coordinator decisions required'
          : 'inspect decisions; preserve incumbent on failure or tie',
    })),
  });
});
