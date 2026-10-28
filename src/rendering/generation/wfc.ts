export const WFC_VERSION = 1;
export const GRID_SIZE = 5;
export type WfcStyle = 'terraces' | 'spire' | 'courtyard';
export const WFC_STYLES = {
  terraces: { label: 'Terraces', height: 4, step: 1, core: [2, 1], target: 2 },
  spire: { label: 'Spire', height: 6, step: 2, core: [2, 1], target: 2 },
  courtyard: {
    label: 'Courtyard',
    height: 4,
    step: 2,
    core: [2, 0],
    target: 1.5,
  },
} as const;
export interface WfcBuilding {
  version: number;
  seed: number;
  style: WfcStyle;
  size: number;
  heights: number[];
  core: number;
  entrance: number;
  observations: number;
  backtracks: number;
}
export type WfcResult =
  | { status: 'solved'; building: WfcBuilding }
  | {
      status: 'exhausted' | 'contradiction';
      observations: number;
      backtracks: number;
    };
export function randomStream(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function neighbors(index: number, size = GRID_SIZE): number[] {
  const x = index % size,
    y = Math.floor(index / size);
  return [
    x > 0 ? index - 1 : -1,
    x < size - 1 ? index + 1 : -1,
    y > 0 ? index - size : -1,
    y < size - 1 ? index + size : -1,
  ].filter((i) => i >= 0);
}
export const compatibleHeights = (a: number, b: number, style: WfcStyle) =>
  Math.abs(a - b) <= WFC_STYLES[style].step;

export interface WfcConstraints {
  height: number;
  step: number;
  core: [number, number];
  target: number;
  minimum: number;
  pins: Record<number, number>;
}

// Simple tiled WFC: stack heights are tiles; edges encode allowed height transitions.
// A global reachability constraint additionally keeps every occupied floor joined to the stair core.
export function generateWfc(
  seed: number,
  style: WfcStyle,
  budget = 4000,
  constraints?: WfcConstraints,
): WfcResult {
  const spec = constraints ?? WFC_STYLES[style],
    size = GRID_SIZE,
    core = spec.core[0] + spec.core[1] * size,
    entrance = 2 + 4 * size;
  const rng = randomStream(seed),
    adj = Array.from({ length: size * size }, (_, i) => neighbors(i, size));
  const initial = Array.from({ length: size * size }, () =>
    Array.from({ length: spec.height + 1 }, (_, i) => i).filter(
      (h) => h >= (constraints?.minimum ?? 0),
    ),
  );
  initial[core] = [spec.height];
  if (constraints) {
    for (const [index, height] of Object.entries(constraints.pins))
      initial[Number(index)] = [height];
  } else {
    initial[entrance] = [1];
    initial[20] = [0];
    initial[24] = [0];
    if (style === 'courtyard') initial[12] = [0];
  }
  let observations = 0,
    backtracks = 0,
    exhausted = false;
  const weight = (height: number, index: number) => {
    const distance =
      Math.abs((index % size) - spec.core[0]) +
      Math.abs(Math.floor(index / size) - spec.core[1]);
    const target = Math.max(
      0.5,
      spec.target + (style === 'spire' ? 1.5 : 1) - distance * 0.4,
    );
    return height === 0
      ? 0.7
      : Math.exp(-Math.abs(height - target) * 0.65) + 0.08;
  };
  function propagate(domains: number[][]): boolean {
    let changed = true;
    while (changed) {
      changed = false;
      for (let i = 0; i < domains.length; i++) {
        for (const j of adj[i]!) {
          const next = domains[i]!.filter((a) =>
            domains[j]!.some((b) => Math.abs(a - b) <= spec.step),
          );
          if (!next.length) return false;
          if (next.length !== domains[i]!.length) {
            domains[i] = next;
            changed = true;
          }
        }
      }
      // Remove values that could only make an isolated upper storey. This is a global constraint,
      // not an adjacency claim: a potentially walkable route to the core must remain at each level.
      for (let level = 1; level <= spec.height; level++) {
        const reached = new Set([core]),
          queue = [core];
        for (let q = 0; q < queue.length; q++)
          for (const j of adj[queue[q]!]!)
            if (!reached.has(j) && domains[j]!.some((h) => h >= level)) {
              reached.add(j);
              queue.push(j);
            }
        for (let i = 0; i < domains.length; i++)
          if (!reached.has(i)) {
            const next = domains[i]!.filter((h) => h < level);
            if (!next.length) return false;
            if (next.length !== domains[i]!.length) {
              domains[i] = next;
              changed = true;
            }
          }
      }
    }
    return true;
  }
  function search(domains: number[][]): number[] | undefined {
    if (!propagate(domains)) return;
    let selected = -1,
      lowest = Infinity;
    for (let i = 0; i < domains.length; i++)
      if (domains[i]!.length > 1) {
        const weights = domains[i]!.map((h) => weight(h, i)),
          sum = weights.reduce((a, b) => a + b, 0);
        const entropy =
          Math.log(sum) -
          weights.reduce((a, w) => a + w * Math.log(w), 0) / sum +
          rng() * 1e-5;
        if (entropy < lowest) {
          lowest = entropy;
          selected = i;
        }
      }
    if (selected < 0) return domains.map((d) => d[0]!);
    if (observations >= budget) {
      exhausted = true;
      return;
    }
    observations++;
    // Weighted random permutation retains alternatives for bounded backtracking.
    const choices = domains[selected]!.map((h) => ({
      h,
      key: -Math.log(Math.max(rng(), 1e-9)) / weight(h, selected),
    })).sort((a, b) => a.key - b.key);
    for (const { h } of choices) {
      const next = domains.map((d) => [...d]);
      next[selected] = [h];
      const solution = search(next);
      if (solution) return solution;
      backtracks++;
      if (exhausted) return;
    }
    return;
  }
  const heights = search(initial);
  if (!heights)
    return {
      status: exhausted ? 'exhausted' : 'contradiction',
      observations,
      backtracks,
    };
  return {
    status: 'solved',
    building: {
      version: WFC_VERSION,
      seed: seed >>> 0,
      style,
      size,
      heights,
      core,
      entrance,
      observations,
      backtracks,
    },
  };
}
export function validateWfc(
  b: WfcBuilding,
  constraints?: WfcConstraints,
): string[] {
  const errors: string[] = [],
    spec = constraints ?? WFC_STYLES[b.style];
  if (b.heights.length !== b.size * b.size) return ['Incorrect grid size'];
  if (b.heights[b.core] !== spec.height) errors.push('Missing stair core');
  if (b.heights[b.entrance] !== 1)
    errors.push('Entrance is not at ground level');
  if (!constraints && b.style === 'courtyard' && b.heights[12] !== 0)
    errors.push('Courtyard obstructed');
  b.heights.forEach((height, i) => {
    if (
      !Number.isInteger(height) ||
      height < (constraints?.minimum ?? 0) ||
      height > spec.height
    )
      errors.push('Invalid height');
    if (
      neighbors(i, b.size).some(
        (j) => Math.abs(height - b.heights[j]!) > spec.step,
      )
    )
      errors.push('Incompatible neighboring stacks');
  });
  if (constraints)
    for (const [i, h] of Object.entries(constraints.pins))
      if (b.heights[Number(i)] !== h)
        errors.push(`Unsupported reserved pad ${i}`);
  for (let level = 1; level <= spec.height; level++) {
    const reached = new Set([b.core]),
      queue = [b.core];
    for (let q = 0; q < queue.length; q++)
      for (const j of neighbors(queue[q]!, b.size))
        if (!reached.has(j) && b.heights[j]! >= level) {
          reached.add(j);
          queue.push(j);
        }
    if (b.heights.some((h, i) => h >= level && !reached.has(i)))
      errors.push(`Disconnected floor ${level}`);
  }
  return [...new Set(errors)];
}
