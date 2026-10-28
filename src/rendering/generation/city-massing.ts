import { generateWfc, type WfcBuilding, type WfcConstraints } from './wfc';
import type { AssemblyInput, Volume } from '../assembly/model';

export const CITY_KIT_VERSION = 1;
export interface CityMassing {
  recipe: WfcBuilding;
  constraints: WfcConstraints;
  levels: number;
  podium: number;
  storey: number;
  fallback: boolean;
}
// This bounded cache survives immutable world projections and stock ticks. No solve per frame.
const cache = new Map<string, CityMassing>();
const instances = new WeakMap<AssemblyInput, CityMassing>();
export function cityMassing(b: AssemblyInput, hall: Volume): CityMassing {
  const instance = instances.get(b);
  if (instance) return instance;
  const shape = b.design?.shape ?? (b.variant > 0.67 ? 'tower' : 'stepped');
  const key = [CITY_KIT_VERSION, b.type, b.h, b.variant, shape].join('/');
  const cached = cache.get(key);
  if (cached) {
    instances.set(b, cached);
    return cached;
  }
  const limit = b.type === 'warehouse' ? 4 : b.type === 'factory' ? 5 : 6;
  const levels = Math.max(
    2,
    Math.min(
      limit,
      shape === 'tower' ? 6 : shape === 'block' ? 3 : 4,
      Math.floor(hall.h / 1.2),
    ),
  );
  const podium = Math.min(2.7, hall.h * 0.65),
    storey = (hall.h - podium) / (levels - 1);
  const pins: Record<number, number> = {};
  // Rear service deck: two supported pads and a core joining them. Front terrace: access.
  for (let x = 0; x < 5; x++) {
    pins[x] = levels;
    pins[x + 20] = 1;
  }
  for (const i of [5, 6, 8, 9]) pins[i] = levels;
  if (b.type === 'factory')
    for (const i of [10, 11]) pins[i] = Math.max(1, levels - 2);
  if (b.type === 'warehouse') {
    for (const i of [13, 14, 18, 19]) pins[i] = Math.max(1, levels - 2);
    if (shape !== 'block') pins[12] = 1; // a light court above the enclosed storage floor
  }
  const constraints: WfcConstraints = {
    height: levels,
    step: 2,
    core: [2, 0],
    target: shape === 'block' ? levels : levels - 1,
    minimum: 1,
    pins,
  };
  const seed =
    (Math.round(b.variant * 4294967295) ^
      (b.type === 'power'
        ? 0x9151
        : b.type === 'factory'
          ? 0x7713
          : 0x3361)) >>>
    0;
  const style =
    shape === 'tower' ? 'spire' : shape === 'block' ? 'courtyard' : 'terraces';
  const result = generateWfc(seed, style, 400, constraints);
  // Constructive fallback from the pinned lower bounds; it obeys the same height-step rules.
  // Keep the failure explicit for diagnostics. This is never a random replacement recipe.
  const heights = Array.from({ length: 25 }, (_, i) =>
    Math.max(
      1,
      ...Object.entries(pins).map(
        ([k, h]) =>
          h -
          2 *
            (Math.abs((i % 5) - (Number(k) % 5)) +
              Math.abs(Math.floor(i / 5) - Math.floor(Number(k) / 5))),
      ),
    ),
  );
  const recipe: WfcBuilding =
    result.status === 'solved'
      ? result.building
      : {
          version: 1,
          seed,
          style,
          size: 5,
          heights,
          core: 2,
          entrance: 22,
          observations: result.observations,
          backtracks: result.backtracks,
        };
  const model = {
    recipe,
    constraints,
    levels,
    podium,
    storey,
    fallback: result.status !== 'solved',
  };
  if (cache.size >= 512) cache.delete(cache.keys().next().value!);
  cache.set(key, model);
  instances.set(b, model);
  return model;
}
export const levelHeight = (m: CityMassing, level: number) =>
  level <= 1 ? level * m.podium : m.podium + (level - 1) * m.storey;
export function massingSolids(m: CityMassing, hall: Volume): Volume[] {
  return m.recipe.heights.map((h, i) => ({
    x: hall.x + ((i % 5) * hall.w) / 5,
    y: hall.y + (Math.floor(i / 5) * hall.d) / 5,
    z: hall.z,
    w: hall.w / 5,
    d: hall.d / 5,
    h: levelHeight(m, h),
  }));
}
