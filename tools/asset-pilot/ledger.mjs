import { mkdir, readFile, rename, open, unlink } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';

/** @param {{id:string,assetId:string,maxCandidates?:number,maxRevisionRounds?:number,incumbent?:{id:string,sourceHash?:string,artifactDir?:string}|null,[key:string]:unknown}} options */
export function createRun({
  id,
  assetId,
  maxCandidates = 4,
  maxRevisionRounds = 3,
  incumbent = null,
  ...metadata
}) {
  if (
    !id ||
    !assetId ||
    !Number.isInteger(maxCandidates) ||
    maxCandidates < 1 ||
    !Number.isInteger(maxRevisionRounds) ||
    maxRevisionRounds < 0
  )
    throw Error('Invalid run identity/budget');
  return {
    schemaVersion: 1,
    id,
    assetId,
    maxCandidates,
    maxRevisionRounds,
    incumbent,
    candidates: [],
    reviews: [],
    decisions: [],
    status: 'active',
    metadata,
  };
}
export function recordCandidate(state, candidate) {
  if (state.status !== 'active') throw Error('Run is not active');
  if (state.candidates.length >= state.maxCandidates)
    throw Error('Candidate budget exhausted');
  const {
    id,
    assetId,
    builderId,
    sourceHash,
    revisionRound = 0,
    machine,
  } = candidate;
  if (
    !id ||
    assetId !== state.assetId ||
    !builderId ||
    !sourceHash ||
    typeof machine?.passed !== 'boolean' ||
    !Number.isInteger(revisionRound) ||
    revisionRound < 0 ||
    revisionRound > state.maxRevisionRounds
  )
    throw Error(
      'Invalid candidate identity, machine result or revision budget',
    );
  if (
    state.candidates.some((c) => c.id === id || c.sourceHash === sourceHash) ||
    state.incumbent?.sourceHash === sourceHash
  )
    throw Error('Duplicate candidate identity/source hash');
  return {
    ...state,
    candidates: [...state.candidates, { ...candidate, revisionRound }],
    status: state.status,
  };
}
export function recordReview(state, review) {
  const c = state.candidates.find((c) => c.id === review.candidateId);
  if (
    !c ||
    !review.reviewerId ||
    review.reviewerId === c.builderId ||
    !['spatial', 'visual'].includes(review.role) ||
    !Array.isArray(review.reasons) ||
    !review.reasons.length
  )
    throw Error(
      'Review must identify independent reviewer, candidate, role and reasons',
    );
  if (
    state.reviews.some(
      (r) =>
        r.candidateId === review.candidateId &&
        (r.reviewerId === review.reviewerId || r.role === review.role),
    )
  )
    throw Error('Duplicate review/reviewer role');
  if (
    review.role === 'spatial' &&
    !['pass', 'reject', 'uncertain'].includes(review.verdict)
  )
    throw Error('Invalid spatial verdict');
  if (
    review.role === 'visual' &&
    (!['win', 'tie', 'reject', 'uncertain'].includes(review.verdict) ||
      review.anonymous !== true)
  )
    throw Error(
      'Visual review must be anonymous and have a comparison verdict',
    );
  if (
    review.role === 'visual' &&
    (review.againstId ?? null) !== (state.incumbent?.id ?? null)
  )
    throw Error('Visual review must compare against the current incumbent');
  return {
    ...state,
    reviews: [
      ...state.reviews,
      {
        ...review,
        ...(review.role === 'visual'
          ? { againstId: review.againstId ?? null }
          : {}),
      },
    ],
  };
}
export function decidePromotion(
  state,
  { candidateId, coordinatorId, nextWork = null },
) {
  const candidate = state.candidates.find((c) => c.id === candidateId);
  if (!candidate || !coordinatorId || coordinatorId === candidate.builderId)
    throw Error('Promotion requires a coordinator distinct from builder');
  if (state.decisions.some((d) => d.candidateId === candidateId))
    throw Error('Candidate already decided');
  const reviews = state.reviews.filter((r) => r.candidateId === candidateId),
    spatial = reviews.find((r) => r.role === 'spatial'),
    visual = reviews.find((r) => r.role === 'visual');
  const reasons = [];
  if (!candidate.machine.passed) reasons.push('Machine validation failed');
  if (!spatial || !visual)
    reasons.push(
      'Independent spatial and anonymous visual reviews are required',
    );
  if (spatial && spatial.verdict !== 'pass')
    reasons.push(`Spatial verdict: ${spatial.verdict}`);
  if (visual && visual.verdict !== 'win')
    reasons.push(`Visual verdict: ${visual.verdict}; incumbent retained`);
  if (visual && (visual.againstId ?? null) !== (state.incumbent?.id ?? null))
    reasons.push('Visual comparison is stale; incumbent has changed');
  if (spatial && visual && spatial.reviewerId === visual.reviewerId)
    reasons.push('Spatial and visual reviewers must be different');
  for (const review of [spatial, visual].filter(Boolean)) {
    if (review.benchmarkPassed !== true)
      reasons.push(
        `${review.role}: explicit full benchmark acceptance is missing or failed`,
      );
    if (review.integrationReady !== true)
      reasons.push(
        `${review.role}: integration readiness is missing or unverified`,
      );
  }
  if (
    state.metadata?.integrationReady === false ||
    candidate.integrationReady === false ||
    candidate.metadata?.integrationReady === false
  )
    reasons.push('Run/candidate metadata explicitly marks integration unready');
  const promoted = reasons.length === 0;
  const decisions = [
    ...state.decisions,
    {
      candidateId,
      coordinatorId,
      promoted,
      reasons: promoted
        ? [
            'Machine pass, independent spatial pass, anonymous visual win, and explicit full benchmark/integration acceptance',
          ]
        : reasons,
      nextWork,
    },
  ];
  const exhausted =
    state.candidates.length >= state.maxCandidates &&
    decisions.length === state.candidates.length;
  return {
    ...state,
    incumbent: promoted
      ? {
          id: candidate.id,
          sourceHash: candidate.sourceHash,
          artifactDir: candidate.artifactDir,
        }
      : state.incumbent,
    decisions,
    status: exhausted ? 'complete' : state.status,
  };
}
export async function saveRun(file, state) {
  await mkdir(dirname(file), { recursive: true });
  const temporary = join(dirname(file), `.${randomUUID()}.tmp`);
  const handle = await open(temporary, 'wx');
  try {
    await handle.writeFile(JSON.stringify(state, null, 2) + '\n');
    await handle.sync();
  } finally {
    await handle.close();
  }
  try {
    await rename(temporary, file);
  } catch (error) {
    await unlink(temporary).catch(() => {});
    throw error;
  }
}
export async function loadRun(file) {
  const state = JSON.parse(await readFile(file, 'utf8'));
  if (
    state.schemaVersion !== 1 ||
    !state.id ||
    !state.assetId ||
    !Array.isArray(state.candidates) ||
    !Array.isArray(state.reviews) ||
    !Array.isArray(state.decisions)
  )
    throw Error('Invalid run ledger');
  return state;
}
export async function withRunLock(dir, fn) {
  await mkdir(dir, { recursive: true });
  const file = join(dir, '.coordinator.lock');
  let handle;
  try {
    handle = await open(file, 'wx');
  } catch (error) {
    if (error.code === 'EEXIST')
      throw Error('Run coordinator lock is already held', { cause: error });
    throw error;
  }
  try {
    await handle.writeFile(
      JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }),
    );
    return await fn();
  } finally {
    await handle.close();
    await unlink(file);
  }
}
