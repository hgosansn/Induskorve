import { generateWfc, type WfcBuilding, type WfcConstraints } from './wfc';
import type { AssemblyInput, Volume } from '../assembly/model';
import { buildingShape } from '../assembly/building-form';

export const CITY_KIT_VERSION = 3;
export interface CityMassing {
  recipe: WfcBuilding;
  constraints: WfcConstraints;
  levels: number;
  podium: number;
  storey: number;
  gridLevel: number;
  equipmentLevel: number;
  fallback: boolean;
}
// This bounded cache survives immutable world projections and stock ticks. No solve per frame.
const cache = new Map<string, CityMassing>();
const instances = new WeakMap<AssemblyInput, CityMassing>();
export function cityMassing(b: AssemblyInput, hall: Volume): CityMassing {
  const instance = instances.get(b);
  if (instance) return instance;
  const shape = buildingShape(b);
  const key = [CITY_KIT_VERSION, b.type, b.h, b.variant, shape].join('/');
  const cached = cache.get(key);
  if (cached) {
    instances.set(b, cached);
    return cached;
  }
  const limit = b.type === 'warehouse' ? 7 : 8;
  const levels = Math.max(
    2,
    Math.min(
      limit,
      shape === 'tower' ? 8 : shape === 'block' ? 3 : 5,
      Math.floor(hall.h / 1.2),
    ),
  );
  const podium = Math.min(2.7, hall.h * 0.65),
    storey = (hall.h - podium) / (levels - 1);
  const gridLevel = shape === 'tower' ? Math.min(2, levels) : levels;
  const equipmentLevel =
    shape === 'tower' ? Math.min(2, levels - 1) : Math.max(1, levels - 2);
  const step = shape === 'tower' ? Math.max(2, levels - 1) : 2;
  const pins: Record<number, number> = {};
  // Only the electrical deck and stair core pin the rear skyline.
  // The former control-room pad is free to step down with the generated shell.
  for (let x = 0; x < 5; x++) {
    pins[x + 20] = 1;
  }
  pins[2] = levels;
  for (const i of [3, 4, 8, 9]) pins[i] = gridLevel;
  if (shape === 'tower') {
    // An occupied vertical core rises from the process podium; services remain
    // on a low side deck instead of forcing the entire rear wall to tower height.
    for (const i of [1, 6, 7]) pins[i] = levels;
    for (const i of [0, 5, 10, 15]) pins[i] = 1;
    pins[12] = Math.max(1, levels - 2);
    pins[17] = equipmentLevel;
  } else if (shape === 'stepped') {
    // Continuous middle terrace plus a second offset landing, connected to the core.
    for (let x = 0; x < 5; x++) pins[x + 10] = equipmentLevel;
    const side = b.variant < 0.5 ? 0 : 2;
    pins[15 + side] = 1;
    pins[16 + side] = 1;
  } else {
    for (const i of [0, 1, 5, 6, 7]) pins[i] = levels;
  }
  if (b.type === 'factory') for (const i of [10, 11]) pins[i] = equipmentLevel;
  if (b.type === 'warehouse') {
    for (const i of [13, 14, 18, 19]) pins[i] = equipmentLevel;
    if (shape === 'stepped') pins[12] = equipmentLevel;
  }
  const constraints: WfcConstraints = {
    height: levels,
    step,
    core: [2, 0],
    target:
      shape === 'tower'
        ? 1.5
        : shape === 'block'
          ? levels
          : Math.max(
              1.25,
              levels - 1 - (Math.floor(b.variant * 1000) % 3) * 0.4,
            ),
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
          step *
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
    gridLevel,
    equipmentLevel,
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
