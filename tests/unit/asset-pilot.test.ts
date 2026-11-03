import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { zstdCompressSync } from 'node:zlib';
import { validateArtifact } from '../../tools/asset-pilot/validate-artifact.mjs';
import {
  createRun,
  recordCandidate,
  recordReview,
  decidePromotion,
  saveRun,
  loadRun,
  withRunLock,
} from '../../tools/asset-pilot/ledger.mjs';

const dirs: string[] = [];
async function temporary() {
  const dir = await mkdtemp(join(tmpdir(), 'induskorve-asset-test-'));
  dirs.push(dir);
  return dir;
}
afterEach(async () => {
  for (const dir of dirs.splice(0))
    await rm(dir, { recursive: true, force: true });
});
const hash = (bytes: Buffer) =>
  createHash('sha256').update(bytes).digest('hex');
function glb(positions: number[]) {
  const binary = Buffer.alloc(positions.length * 4);
  positions.forEach((n, i) => binary.writeFloatLE(n, i * 4));
  const doc = {
    asset: { version: '2.0' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
    buffers: [{ byteLength: binary.length }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: binary.length }],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: positions.length / 3,
        type: 'VEC3',
      },
    ],
  };
  const raw = Buffer.from(JSON.stringify(doc)),
    json = Buffer.concat([raw, Buffer.alloc((4 - (raw.length % 4)) % 4, 32)]);
  const header = Buffer.alloc(20);
  header.write('glTF');
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + json.length + 8 + binary.length, 8);
  header.writeUInt32LE(json.length, 12);
  header.writeUInt32LE(0x4e4f534a, 16);
  const binHeader = Buffer.alloc(8);
  binHeader.writeUInt32LE(binary.length);
  binHeader.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([header, json, binHeader, binary]);
}
async function fixture() {
  const dir = await temporary();
  const scene = {
    schemaVersion: 1,
    assetId: 'furnace',
    candidateId: 'A',
    units: 'kit',
    bounds: { min: [0, 0, 0], max: [1, 1, 0] },
    objects: [
      {
        id: 'shell',
        role: 'furnace casing',
        material: 'steel',
        positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
        normals: [0, 0, 1, 0, 0, 1, 0, 0, 1],
        indices: [0, 1, 2],
      },
    ],
    sockets: [
      {
        id: 'exhaust',
        service: 'exhaust',
        point: [0.2, 0.2, 0],
        normal: [0, 0, 1],
      },
    ],
    joints: [],
  };
  const png = Buffer.alloc(45);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(png);
  png.writeUInt32BE(13, 8);
  png.write('IHDR', 12);
  png.writeUInt32BE(64, 16);
  png.writeUInt32BE(64, 20);
  await writeFile(
    join(dir, 'source.blend'),
    Buffer.from('BLENDER-v500sourcefixture'),
  );
  await writeFile(join(dir, 'asset.glb'), glb([0, 0, 0, 1, 0, 0, 0, 0, -1]));
  await writeFile(join(dir, 'beauty.png'), png);
  await writeFile(join(dir, 'scene.json'), JSON.stringify(scene));
  await refresh(dir);
  return { dir, scene };
}
async function refresh(dir: string) {
  const files: Record<string, { sha256: string }> = {};
  for (const file of ['source.blend', 'asset.glb', 'beauty.png', 'scene.json'])
    files[file] = { sha256: hash(await readFile(join(dir, file))) };
  await writeFile(
    join(dir, 'manifest.json'),
    JSON.stringify({
      schemaVersion: 1,
      assetId: 'furnace',
      candidateId: 'A',
      files,
    }),
  );
}
describe('asset artifact readback', () => {
  it('recognizes modern Blender headers inside bounded Zstandard source files', async () => {
    const { dir } = await fixture();
    await writeFile(
      join(dir, 'source.blend'),
      zstdCompressSync(Buffer.from('BLENDER17-01v0502RENDfixture')),
    );
    await refresh(dir);
    const valid = await validateArtifact(dir);
    expect(valid.passed).toBe(true);
    expect(valid.stats.sourceCompression).toBe('zstd');
    await writeFile(
      join(dir, 'source.blend'),
      zstdCompressSync(Buffer.from('random compressed bytes are not Blender')),
    );
    await refresh(dir);
    expect((await validateArtifact(dir)).errors.join('\n')).toMatch(
      /invalid Blender header/,
    );
  });
  it('reads real GLB triangles and converts glTF Y-up into authored kit Z-up', async () => {
    const { dir } = await fixture();
    const result = await validateArtifact(dir);
    expect(result.errors).toEqual([]);
    expect(result.passed).toBe(true);
    expect(result.stats.glbTriangles).toBe(1);
  });
  it('uses actual coordinate tolerance instead of rounding-bin equality', async () => {
    const { dir, scene } = await fixture();
    scene.objects[0]!.positions[3] = 1.00005;
    scene.bounds.max[0] = 1.00005;
    await writeFile(join(dir, 'scene.json'), JSON.stringify(scene));
    await writeFile(
      join(dir, 'asset.glb'),
      glb([0, 0, 0, 1.00004999, 0, 0, 0, 0, -1]),
    );
    await refresh(dir);
    expect((await validateArtifact(dir)).passed).toBe(true);
    // This difference remains inside the old 1e-4 bin but exceeds the actual
    // 1e-6 tolerance and must not silently reuse a rounded fingerprint match.
    await writeFile(
      join(dir, 'asset.glb'),
      glb([0, 0, 0, 1.00007, 0, 0, 0, 0, -1]),
    );
    await refresh(dir);
    expect((await validateArtifact(dir)).errors).toContain(
      'asset.glb: actual world-space triangle geometry differs from scene.json',
    );
  });
  it('rejects tampering even when geometry remains readable', async () => {
    const { dir, scene } = await fixture();
    scene.objects[0]!.role = 'tampered';
    await writeFile(join(dir, 'scene.json'), JSON.stringify(scene));
    expect((await validateArtifact(dir)).errors).toContain(
      'scene.json: manifest hash mismatch or missing hash',
    );
  });
  it('rejects corrupt indices, normals and detached sockets', async () => {
    const { dir, scene } = await fixture();
    scene.objects[0]!.indices = [0, 1, 99];
    scene.objects[0]!.normals[2] = 0;
    scene.sockets[0]!.point = [3, 3, 3];
    await writeFile(join(dir, 'scene.json'), JSON.stringify(scene));
    await refresh(dir);
    const result = await validateArtifact(dir);
    expect(result.passed).toBe(false);
    expect(result.errors.join('\n')).toMatch(/invalid indices/);
    expect(result.errors.join('\n')).toMatch(/unit length/);
    expect(result.errors.join('\n')).toMatch(/socket farther/);
  });
  it('rejects GLB/source geometry mismatch and actual degeneracy', async () => {
    const { dir } = await fixture();
    await writeFile(join(dir, 'asset.glb'), glb([0, 0, 0, 2, 0, 0, 0, 0, -1]));
    await refresh(dir);
    expect((await validateArtifact(dir)).errors).toContain(
      'asset.glb: actual world-space triangle geometry differs from scene.json',
    );
    await writeFile(join(dir, 'asset.glb'), glb([0, 0, 0, 0, 0, 0, 0, 0, 0]));
    await refresh(dir);
    expect((await validateArtifact(dir)).errors.join('\n')).toMatch(
      /Degenerate GLB/,
    );
  });
  it('rejects budget overflow and invalid joints without banning overlapping parts', async () => {
    const { dir, scene } = await fixture();
    expect((await validateArtifact(dir, { triangleBudget: 0 })).passed).toBe(
      false,
    );
    scene.joints.push({
      a: 'shell',
      b: 'missing',
      kind: 'bolted',
      point: [0, 0, 0],
    } as never);
    await writeFile(join(dir, 'scene.json'), JSON.stringify(scene));
    await refresh(dir);
    expect((await validateArtifact(dir)).errors.join('\n')).toMatch(
      /invalid joint/,
    );
  });
});
const candidate = (id = 'A', sourceHash = 'sha-A') => ({
  id,
  assetId: 'furnace',
  builderId: 'builder',
  sourceHash,
  revisionRound: 0,
  artifactDir: `candidates/${id}`,
  machine: { passed: true },
});
function reviewed(verdict: 'win' | 'tie' | 'reject' = 'win') {
  let state = recordCandidate(
    createRun({
      id: 'run',
      assetId: 'furnace',
      incumbent: { id: 'old', sourceHash: 'old-hash' },
    }),
    candidate(),
  );
  state = recordReview(state, {
    candidateId: 'A',
    reviewerId: 'spatial-agent',
    role: 'spatial',
    verdict: 'pass',
    benchmarkPassed: true,
    integrationReady: true,
    reasons: ['Joints reach real surfaces'],
  });
  return recordReview(state, {
    candidateId: 'A',
    reviewerId: 'visual-agent',
    role: 'visual',
    againstId: 'old',
    verdict,
    anonymous: true,
    benchmarkPassed: true,
    integrationReady: true,
    reasons: ['Anonymous comparison against incumbent'],
  });
}
describe('bounded asset promotion ledger', () => {
  it('retains incumbent when a relative win lacks full benchmark acceptance', () => {
    const state = reviewed();
    delete state.reviews[1].benchmarkPassed;
    const decision = decidePromotion(state, {
      candidateId: 'A',
      coordinatorId: 'coordinator',
    });
    expect(decision.incumbent?.id).toBe('old');
    expect(decision.decisions.at(-1)?.reasons.join(' ')).toMatch(
      /full benchmark/,
    );
  });
  it('blocks explicit or missing integration readiness even after a full relative win', () => {
    const state = { ...reviewed(), metadata: { integrationReady: false } };
    expect(
      decidePromotion(state, { candidateId: 'A', coordinatorId: 'coordinator' })
        .incumbent?.id,
    ).toBe('old');
    const missing = reviewed();
    delete missing.reviews[0].integrationReady;
    expect(
      decidePromotion(missing, {
        candidateId: 'A',
        coordinatorId: 'coordinator',
      }).incumbent?.id,
    ).toBe('old');
    const failed = reviewed();
    failed.reviews[1].benchmarkPassed = false;
    expect(
      decidePromotion(failed, {
        candidateId: 'A',
        coordinatorId: 'coordinator',
      }).incumbent?.id,
    ).toBe('old');
  });
  it('requires all gates and preserves incumbent on missing review, ties and rejection', () => {
    let state = recordCandidate(
      createRun({ id: 'run', assetId: 'furnace', incumbent: { id: 'old' } }),
      candidate(),
    );
    state = decidePromotion(state, {
      candidateId: 'A',
      coordinatorId: 'coordinator',
    });
    expect(state.incumbent?.id).toBe('old');
    for (const verdict of ['tie', 'reject'] as const)
      expect(
        decidePromotion(reviewed(verdict), {
          candidateId: 'A',
          coordinatorId: 'coordinator',
        }).incumbent?.id,
      ).toBe('old');
    expect(
      decidePromotion(reviewed(), {
        candidateId: 'A',
        coordinatorId: 'coordinator',
      }).incumbent?.id,
    ).toBe('A');
  });
  it('rejects builder self-review/promotion, duplicate hashes and exhausted budgets', () => {
    const state = recordCandidate(
      createRun({ id: 'run', assetId: 'furnace', maxCandidates: 1 }),
      candidate(),
    );
    expect(() => recordCandidate(state, candidate('B', 'sha-B'))).toThrow(
      /budget/,
    );
    expect(() =>
      recordReview(state, {
        candidateId: 'A',
        reviewerId: 'builder',
        role: 'spatial',
        verdict: 'pass',
        reasons: ['self'],
      }),
    ).toThrow(/independent/);
    expect(() =>
      decidePromotion(reviewed(), {
        candidateId: 'A',
        coordinatorId: 'builder',
      }),
    ).toThrow(/distinct/);
    const duplicate = recordCandidate(
      createRun({ id: 'run', assetId: 'furnace' }),
      candidate(),
    );
    expect(() => recordCandidate(duplicate, candidate('B'))).toThrow(
      /Duplicate/,
    );
    expect(() =>
      recordCandidate(
        createRun({ id: 'run', assetId: 'furnace', maxRevisionRounds: 1 }),
        { ...candidate(), revisionRound: 2 },
      ),
    ).toThrow(/revision/);
  });
  it('never promotes a machine failure and completes a fully decided budget', () => {
    let state = reviewed();
    state.candidates[0]!.machine.passed = false;
    expect(
      decidePromotion(state, { candidateId: 'A', coordinatorId: 'coordinator' })
        .incumbent?.id,
    ).toBe('old');
    state = { ...reviewed(), maxCandidates: 1 };
    expect(
      decidePromotion(state, { candidateId: 'A', coordinatorId: 'coordinator' })
        .status,
    ).toBe('complete');
  });
  it('rejects wins compared against a superseded incumbent', () => {
    const state = {
      ...reviewed(),
      incumbent: { id: 'newer', sourceHash: 'newer-hash' },
    };
    const decision = decidePromotion(state, {
      candidateId: 'A',
      coordinatorId: 'coordinator',
    });
    expect(decision.incumbent?.id).toBe('newer');
    expect(decision.decisions.at(-1)?.reasons.join(' ')).toMatch(/stale/);
  });
  it('writes atomically and prevents simultaneous coordinators', async () => {
    const dir = await temporary(),
      file = join(dir, 'run.json'),
      state = createRun({ id: 'run', assetId: 'furnace' });
    await saveRun(file, state);
    expect(await loadRun(file)).toEqual(state);
    await withRunLock(dir, async () => {
      await expect(withRunLock(dir, async () => {})).rejects.toThrow(
        /already held/,
      );
    });
    await expect(withRunLock(dir, async () => true)).resolves.toBe(true);
  });
});
