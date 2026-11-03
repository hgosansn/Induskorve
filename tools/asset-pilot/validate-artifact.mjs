import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { gunzipSync, zstdDecompressSync } from 'node:zlib';

const PALETTE = new Set([
  'background',
  'foreground',
  'card',
  'primary',
  'muted',
  'edge',
  'ink',
  'surface',
  'steel',
  'concrete',
  'concrete-light',
  'concrete-shadow',
  'ground',
  'ground-alt',
  'road',
  'power',
  'materials',
  'production',
  'danger',
  'soot',
]);
const REQUIRED = [
  'source.blend',
  'asset.glb',
  'scene.json',
  'beauty.png',
  'manifest.json',
];
const finite3 = (p) =>
  Array.isArray(p) && p.length === 3 && p.every(Number.isFinite);
const sub = (a, b) => a.map((n, i) => n - b[i]);
const dot = (a, b) => a.reduce((s, n, i) => s + n * b[i], 0);
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const length = (a) => Math.sqrt(dot(a, a));
const distance = (a, b) => length(sub(a, b));
const add = (a, b) => a.map((n, i) => n + b[i]);
const mul = (a, n) => a.map((v) => v * n);
const bounds = (points) =>
  points.reduce(
    (b, p) => ({
      min: b.min.map((n, i) => Math.min(n, p[i])),
      max: b.max.map((n, i) => Math.max(n, p[i])),
    }),
    {
      min: [Infinity, Infinity, Infinity],
      max: [-Infinity, -Infinity, -Infinity],
    },
  );
function pointTriangleDistance(p, [a, b, c]) {
  const ab = sub(b, a),
    ac = sub(c, a),
    ap = sub(p, a),
    d1 = dot(ab, ap),
    d2 = dot(ac, ap);
  if (d1 <= 0 && d2 <= 0) return distance(p, a);
  const bp = sub(p, b),
    d3 = dot(ab, bp),
    d4 = dot(ac, bp);
  if (d3 >= 0 && d4 <= d3) return distance(p, b);
  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0)
    return distance(p, add(a, mul(ab, d1 / (d1 - d3))));
  const cp = sub(p, c),
    d5 = dot(ab, cp),
    d6 = dot(ac, cp);
  if (d6 >= 0 && d5 <= d6) return distance(p, c);
  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0)
    return distance(p, add(a, mul(ac, d2 / (d2 - d6))));
  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0)
    return distance(p, add(b, mul(sub(c, b), (d4 - d3) / (d4 - d3 + d5 - d6))));
  const denom = 1 / (va + vb + vc);
  return distance(p, add(a, add(mul(ab, vb * denom), mul(ac, vc * denom))));
}
function closest(point, triangles) {
  let best = Infinity;
  for (const triangle of triangles)
    best = Math.min(best, pointTriangleDistance(point, triangle));
  return best;
}
function fingerprint(triangles) {
  return createHash('sha256')
    .update(
      triangles
        .map((t) =>
          t
            .map((p) => p.map((n) => Math.round(n * 10000)).join(','))
            .sort()
            .join(';'),
        )
        .sort()
        .join('|'),
    )
    .digest('hex');
}
function compareTriangles(expected, actual, tolerance = 1e-6) {
  if (expected.length !== actual.length)
    return {
      passed: false,
      unmatched: Math.abs(expected.length - actual.length),
      maxDeviation: null,
      tolerance,
    };
  const cell = tolerance * 4;
  const centroid = (t) =>
    [0, 1, 2].map((i) =>
      Math.floor((t[0][i] + t[1][i] + t[2][i]) / (3 * cell)),
    );
  const buckets = new Map();
  for (const triangle of actual) {
    const key = centroid(triangle).join(',');
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(triangle);
  }
  const permutations = [
    [0, 1, 2],
    [0, 2, 1],
    [1, 0, 2],
    [1, 2, 0],
    [2, 0, 1],
    [2, 1, 0],
  ];
  const deviation = (a, b) =>
    Math.min(
      ...permutations.map((order) =>
        Math.max(
          ...a.flatMap((p, i) => p.map((v, j) => Math.abs(v - b[order[i]][j]))),
        ),
      ),
    );
  let unmatched = 0,
    maxDeviation = 0;
  for (const triangle of expected) {
    const c = centroid(triangle);
    let found = false;
    for (const dx of [0, -1, 1]) {
      if (found) break;
      for (const dy of [0, -1, 1]) {
        if (found) break;
        for (const dz of [0, -1, 1]) {
          const bucket = buckets.get(
            [c[0] + dx, c[1] + dy, c[2] + dz].join(','),
          );
          if (!bucket) continue;
          const index = bucket.findIndex(
            (candidate) => deviation(triangle, candidate) <= tolerance,
          );
          if (index < 0) continue;
          maxDeviation = Math.max(
            maxDeviation,
            deviation(triangle, bucket[index]),
          );
          bucket.splice(index, 1);
          found = true;
          break;
        }
      }
    }
    if (!found) unmatched++;
  }
  return { passed: unmatched === 0, unmatched, maxDeviation, tolerance };
}
const identity = () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
function matrixMultiply(a, b) {
  const out = Array(16).fill(0);
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++)
      for (let k = 0; k < 4; k++) out[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
  return out;
}
function nodeMatrix(node) {
  if (node.matrix) return node.matrix;
  const [x, y, z, w] = node.rotation ?? [0, 0, 0, 1],
    s = node.scale ?? [1, 1, 1],
    t = node.translation ?? [0, 0, 0];
  return [
    (1 - 2 * y * y - 2 * z * z) * s[0],
    (2 * x * y + 2 * z * w) * s[0],
    (2 * x * z - 2 * y * w) * s[0],
    0,
    (2 * x * y - 2 * z * w) * s[1],
    (1 - 2 * x * x - 2 * z * z) * s[1],
    (2 * y * z + 2 * x * w) * s[1],
    0,
    (2 * x * z + 2 * y * w) * s[2],
    (2 * y * z - 2 * x * w) * s[2],
    (1 - 2 * x * x - 2 * y * y) * s[2],
    0,
    ...t,
    1,
  ];
}
function transform(p, m) {
  return [0, 1, 2].map(
    (i) => m[i] * p[0] + m[4 + i] * p[1] + m[8 + i] * p[2] + m[12 + i],
  );
}
function glbTriangles(bytes, upAxis) {
  if (
    bytes.length < 20 ||
    bytes.toString('ascii', 0, 4) !== 'glTF' ||
    bytes.readUInt32LE(4) !== 2 ||
    bytes.readUInt32LE(8) !== bytes.length
  )
    throw Error('GLB header/version/length invalid');
  let offset = 12,
    json,
    bin;
  while (offset < bytes.length) {
    if (offset + 8 > bytes.length) throw Error('GLB chunk header truncated');
    const size = bytes.readUInt32LE(offset),
      kind = bytes.readUInt32LE(offset + 4);
    offset += 8;
    if (size % 4 || offset + size > bytes.length)
      throw Error('GLB chunk length invalid');
    if (kind === 0x4e4f534a) {
      if (json) throw Error('Duplicate GLB JSON chunk');
      json = JSON.parse(bytes.toString('utf8', offset, offset + size).trim());
    }
    if (kind === 0x004e4942) {
      if (bin) throw Error('Duplicate GLB BIN chunk');
      bin = bytes.subarray(offset, offset + size);
    }
    offset += size;
  }
  if (!json || !bin || json.asset?.version !== '2.0')
    throw Error('GLB lacks glTF 2.0 JSON/BIN');
  if (
    (json.buffers ?? []).length !== 1 ||
    json.buffers[0].uri ||
    json.buffers[0].byteLength > bin.length
  )
    throw Error('GLB must contain one embedded geometry buffer');
  const component = {
    5121: [1, 'readUInt8'],
    5123: [2, 'readUInt16LE'],
    5125: [4, 'readUInt32LE'],
    5126: [4, 'readFloatLE'],
  };
  const width = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
  function accessor(index) {
    const a = json.accessors?.[index],
      view = json.bufferViews?.[a?.bufferView];
    if (
      !a ||
      !view ||
      a.sparse ||
      a.normalized ||
      !component[a.componentType] ||
      !width[a.type]
    )
      throw Error('Unsupported or missing GLB geometry accessor');
    if (view.buffer !== 0 || !Number.isInteger(a.count) || a.count < 0)
      throw Error('Invalid GLB accessor/buffer');
    const [size, read] = component[a.componentType],
      n = width[a.type],
      stride = view.byteStride ?? size * n,
      base = (view.byteOffset ?? 0) + (a.byteOffset ?? 0);
    const end = base + Math.max(0, a.count - 1) * stride + size * n;
    if (
      stride < size * n ||
      base < 0 ||
      end > (view.byteOffset ?? 0) + view.byteLength ||
      end > bin.length
    )
      throw Error('GLB accessor outside binary buffer');
    return Array.from({ length: a.count }, (_, i) =>
      Array.from({ length: n }, (_, j) =>
        bin[read](base + i * stride + j * size),
      ),
    );
  }
  const triangles = [],
    active = new Set();
  function visit(index, parent) {
    if (active.has(index)) throw Error('Cyclic GLB nodes');
    const node = json.nodes?.[index];
    if (!node) throw Error('Missing GLB node');
    active.add(index);
    const matrix = matrixMultiply(parent, nodeMatrix(node));
    if (matrix.length !== 16 || !matrix.every(Number.isFinite))
      throw Error('Invalid GLB transform');
    if (node.skin !== undefined)
      throw Error('Skinned assets are outside static-piece contract');
    if (node.mesh !== undefined)
      for (const p of json.meshes?.[node.mesh]?.primitives ?? []) {
        if ((p.mode ?? 4) !== 4 || p.targets)
          throw Error('Only static triangle GLB primitives are supported');
        const positions = accessor(p.attributes?.POSITION).map((v) => {
          if (v.length !== 3 || !v.every(Number.isFinite))
            throw Error('Invalid GLB position');
          const q = transform(v, matrix);
          return upAxis === 'Z' ? q : [q[0], -q[2], q[1]];
        });
        const indices =
          p.indices === undefined
            ? positions.map((_, i) => i)
            : accessor(p.indices).map((v) => v[0]);
        if (indices.length % 3) throw Error('GLB triangle indices incomplete');
        for (let i = 0; i < indices.length; i += 3) {
          const ids = indices.slice(i, i + 3);
          if (
            ids.some(
              (i) => !Number.isInteger(i) || i < 0 || i >= positions.length,
            )
          )
            throw Error('GLB index out of range');
          const triangle = ids.map((i) => positions[i]);
          if (
            length(
              cross(
                sub(triangle[1], triangle[0]),
                sub(triangle[2], triangle[0]),
              ),
            ) < 1e-10
          )
            throw Error('Degenerate GLB triangle');
          triangles.push(triangle);
        }
      }
    for (const child of node.children ?? []) visit(child, matrix);
    active.delete(index);
  }
  const scene = json.scenes?.[json.scene ?? 0];
  if (!scene) throw Error('GLB default scene missing');
  for (const node of scene.nodes ?? []) visit(node, identity());
  if (!triangles.length) throw Error('GLB has no rendered triangles');
  return triangles;
}

/** Artifact integrity and bounded spatial checks; not collision/manifold certification. */
export async function validateArtifact(
  dir,
  { triangleBudget = 150000, socketTolerance = 0.2, paletteTokens } = {},
) {
  const errors = [],
    warnings = [
      'Checks do not certify manifold topology, general collisions, engineering function or artistic quality.',
    ];
  const files = {},
    buffers = {};
  for (const name of REQUIRED)
    try {
      const data = await readFile(join(dir, name));
      buffers[name] = data;
      files[name] = {
        sha256: createHash('sha256').update(data).digest('hex'),
        bytes: data.length,
      };
      if (!data.length) errors.push(`${name}: empty`);
    } catch (error) {
      errors.push(`${name}: ${error.code ?? error.message}`);
    }
  const stats = {
    objects: 0,
    triangles: 0,
    vertices: 0,
    sockets: 0,
    joints: 0,
    glbTriangles: 0,
    sourceCompression: 'unknown',
    sourceHeader: '',
    geometrySha256: '',
    imageWidth: 0,
    imageHeight: 0,
  };
  if (errors.length) return { passed: false, errors, warnings, stats, files };
  let scene, manifest;
  try {
    scene = JSON.parse(buffers['scene.json']);
    manifest = JSON.parse(buffers['manifest.json']);
  } catch (error) {
    return {
      passed: false,
      errors: [`JSON parse: ${error.message}`],
      warnings,
      stats,
      files,
    };
  }
  if (
    !scene ||
    typeof scene !== 'object' ||
    !manifest ||
    typeof manifest !== 'object'
  )
    return {
      passed: false,
      errors: ['scene/manifest must be JSON objects'],
      warnings,
      stats,
      files,
    };
  if (
    manifest.schemaVersion !== 1 ||
    !manifest.assetId ||
    !manifest.candidateId
  )
    errors.push('manifest: invalid identity/schema');
  for (const name of REQUIRED.filter((n) => n !== 'manifest.json')) {
    const expected = manifest.files?.[name]?.sha256 ?? manifest.files?.[name];
    if (expected !== files[name].sha256)
      errors.push(`${name}: manifest hash mismatch or missing hash`);
  }
  try {
    let blend = buffers['source.blend'];
    stats.sourceCompression = 'none';
    if (blend.subarray(0, 4).equals(Buffer.from([0x28, 0xb5, 0x2f, 0xfd]))) {
      blend = zstdDecompressSync(blend, { maxOutputLength: 512 * 1024 * 1024 });
      stats.sourceCompression = 'zstd';
    } else if (blend[0] === 0x1f && blend[1] === 0x8b) {
      blend = gunzipSync(blend, { maxOutputLength: 512 * 1024 * 1024 });
      stats.sourceCompression = 'gzip';
    }
    const prefix = blend.toString('ascii', 0, 17);
    // Legacy 12-byte headers and the locally Blender-reopened 5.2 format.
    const legacy = /^BLENDER[_-][vV]\d{3}/.test(prefix);
    const modern = /^BLENDER17-01[vV]\d{4}/.test(prefix);
    if (!legacy && !modern)
      errors.push(
        'source.blend: invalid Blender header after bounded decompression',
      );
    else stats.sourceHeader = prefix.slice(0, modern ? 17 : 12);
  } catch (error) {
    errors.push(
      `source.blend: invalid compressed Blender source (${error.message})`,
    );
  }
  const png = buffers['beauty.png'];
  if (
    png.length < 45 ||
    !png
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ||
    png.toString('ascii', 12, 16) !== 'IHDR' ||
    png.readUInt32BE(8) !== 13
  )
    errors.push('beauty.png: invalid PNG header');
  else if (
    !png.readUInt32BE(16) ||
    !png.readUInt32BE(20) ||
    png.readUInt32BE(16) > 16384 ||
    png.readUInt32BE(20) > 16384
  )
    errors.push('beauty.png: invalid extent');
  else {
    stats.imageWidth = png.readUInt32BE(16);
    stats.imageHeight = png.readUInt32BE(20);
  }
  if (
    scene.schemaVersion !== 1 ||
    scene.assetId !== manifest.assetId ||
    scene.candidateId !== manifest.candidateId ||
    scene.units !== 'kit'
  )
    errors.push('scene: identity/schema/units mismatch');
  if (!finite3(scene.bounds?.min) || !finite3(scene.bounds?.max))
    errors.push('scene: invalid bounds');
  if (!Array.isArray(scene.objects) || !scene.objects.length)
    errors.push('scene: no objects');
  const objects = new Map(),
    triangles = [],
    points = [],
    palette = new Set(paletteTokens ?? PALETTE);
  for (const o of Array.isArray(scene.objects) ? scene.objects : []) {
    if (!o || typeof o !== 'object') {
      errors.push('scene: invalid object record');
      continue;
    }
    if (typeof o.id !== 'string' || !o.id.trim() || objects.has(o.id))
      errors.push('scene: missing/duplicate object id');
    if (typeof o.role !== 'string' || !o.role.trim())
      errors.push(`${o.id}: missing role`);
    if (!palette.has(o.material))
      errors.push(`${o.id}: unknown palette material ${o.material}`);
    const vertices = Array.isArray(o.positions) ? o.positions : [];
    const indices = Array.isArray(o.indices) ? o.indices : [];
    if (
      !vertices.length ||
      vertices.length % 3 ||
      vertices.some((n) => !Number.isFinite(n) || Math.abs(n) > 1000)
    )
      errors.push(`${o.id}: invalid positions`);
    if (
      !Array.isArray(o.normals) ||
      o.normals.length !== vertices.length ||
      o.normals.some((n) => !Number.isFinite(n))
    )
      errors.push(`${o.id}: invalid normals`);
    else
      for (let i = 0; i < o.normals.length; i += 3)
        if (Math.abs(length(o.normals.slice(i, i + 3)) - 1) > 0.1) {
          errors.push(`${o.id}: normals not reasonably unit length`);
          break;
        }
    const objectTriangles = [];
    if (
      !indices.length ||
      indices.length % 3 ||
      indices.some(
        (i) => !Number.isInteger(i) || i < 0 || i >= vertices.length / 3,
      )
    )
      errors.push(`${o.id}: invalid indices`);
    else
      for (let i = 0; i < indices.length; i += 3) {
        const t = indices
          .slice(i, i + 3)
          .map((i) => vertices.slice(i * 3, i * 3 + 3));
        if (
          t.some((p) => !finite3(p)) ||
          length(cross(sub(t[1], t[0]), sub(t[2], t[0]))) < 1e-10
        )
          errors.push(`${o.id}: nonfinite/degenerate triangle`);
        else {
          triangles.push(t);
          objectTriangles.push(t);
          points.push(...t);
        }
      }
    objects.set(o.id, objectTriangles);
    stats.vertices += vertices.length / 3;
  }
  stats.objects = objects.size;
  stats.triangles = triangles.length;
  stats.geometrySha256 = fingerprint(triangles);
  if (stats.triangles > triangleBudget)
    errors.push(
      `scene: triangle budget exceeded (${stats.triangles}/${triangleBudget})`,
    );
  if (
    points.length &&
    finite3(scene.bounds?.min) &&
    finite3(scene.bounds?.max)
  ) {
    const actual = bounds(points);
    stats.bounds = actual;
    if (
      [0, 1, 2].some(
        (i) =>
          scene.bounds.min[i] > scene.bounds.max[i] ||
          Math.abs(actual.min[i] - scene.bounds.min[i]) > 0.01 ||
          Math.abs(actual.max[i] - scene.bounds.max[i]) > 0.01,
      )
    )
      errors.push('scene: declared bounds differ from geometry');
  }
  const socketIds = new Set();
  if (!Array.isArray(scene.sockets))
    errors.push('scene: sockets must be an array');
  for (const s of Array.isArray(scene.sockets) ? scene.sockets : []) {
    if (!s || typeof s !== 'object') {
      errors.push('scene: invalid socket record');
      continue;
    }
    if (
      typeof s.id !== 'string' ||
      !s.id ||
      socketIds.has(s.id) ||
      typeof s.service !== 'string' ||
      !s.service
    )
      errors.push('scene: invalid/duplicate socket identity');
    socketIds.add(s.id);
    if (
      !finite3(s.point) ||
      !finite3(s.normal) ||
      Math.abs(length(s.normal) - 1) > 0.1
    )
      errors.push(`${s.id}: invalid socket point/normal`);
    else if (closest(s.point, triangles) > socketTolerance)
      errors.push(
        `${s.id}: socket farther than ${socketTolerance} kit units from actual geometry`,
      );
  }
  if (!Array.isArray(scene.joints))
    errors.push('scene: joints must be an array');
  for (const j of Array.isArray(scene.joints) ? scene.joints : []) {
    if (!j || typeof j !== 'object') {
      errors.push('scene: invalid joint record');
      continue;
    }
    if (
      !objects.has(j.a) ||
      !objects.has(j.b) ||
      j.a === j.b ||
      typeof j.kind !== 'string' ||
      !j.kind ||
      !finite3(j.point)
    )
      errors.push('scene: invalid joint identity/point');
    else if (
      closest(j.point, objects.get(j.a)) > socketTolerance ||
      closest(j.point, objects.get(j.b)) > socketTolerance
    )
      errors.push(
        `${j.a}/${j.b}: joint does not reach both actual object surfaces`,
      );
  }
  stats.sockets = scene.sockets?.length ?? 0;
  stats.joints = scene.joints?.length ?? 0;
  try {
    const readback = glbTriangles(
      buffers['asset.glb'],
      manifest.gltfUpAxis ?? 'Y',
    );
    stats.glbTriangles = readback.length;
    // Rounding-bin hashes are unsuitable equality gates: float32 export and
    // rounded JSON can straddle a bin despite differing by <1e-6 kit units.
    // Match every actual triangle one-to-one within a strict spatial tolerance.
    stats.glbReadbackComparison = compareTriangles(triangles, readback);
    if (!stats.glbReadbackComparison.passed)
      errors.push(
        'asset.glb: actual world-space triangle geometry differs from scene.json',
      );
  } catch (error) {
    errors.push(`asset.glb: ${error.message}`);
  }
  return {
    passed: errors.length === 0,
    errors: [...new Set(errors)],
    warnings,
    stats,
    files,
  };
}
