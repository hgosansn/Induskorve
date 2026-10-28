import type { WfcBuilding } from './wfc';
export interface GeneratedBay {
  x: number;
  y: number;
  floor: number;
  front: boolean;
  right: boolean;
  roof: boolean;
  core: boolean;
  entrance: boolean;
  lit: boolean;
  braced: boolean;
}
export function compileWfcKit(b: WfcBuilding): GeneratedBay[] {
  const bays: GeneratedBay[] = [];
  for (let y = 0; y < b.size; y++)
    for (let x = 0; x < b.size; x++) {
      const index = x + y * b.size,
        height = b.heights[index]!;
      for (let floor = 0; floor < height; floor++) {
        const v =
          Math.sin(b.seed * 0.13 + index * 173 + floor * 37) * 43758.5453;
        bays.push({
          x,
          y,
          floor,
          front: y === b.size - 1 || b.heights[index + b.size]! <= floor,
          right: x === b.size - 1 || b.heights[index + 1]! <= floor,
          roof: floor === height - 1,
          core: index === b.core,
          entrance: index === b.entrance && floor === 0,
          lit: v - Math.floor(v) > 0.3,
          braced: index % 4 === 0,
        });
      }
    }
  // Columns nearer the fixed camera occlude the lower portions of rear columns.
  return bays.sort(
    (a, b) => a.x + a.y - b.x - b.y || a.floor - b.floor || a.x - b.x,
  );
}
export const WFC_KIT = [
  [
    'Floor slab',
    'Carries one storey; full stacks always reach the foundation.',
  ],
  [
    'Wall / window bay',
    'Closes an exposed edge. Shared interior faces are omitted.',
  ],
  [
    'Brace bay',
    'Repeats in a structural column instead of scattering randomly.',
  ],
  [
    'Roof cap / guardrail',
    'Closes the top of a stack and protects exposed terrace edges.',
  ],
  [
    'Stair core',
    'Every generated floor must have a connected route to this column.',
  ],
  ['Entrance', 'Pinned to an accessible ground-floor bay at the front.'],
] as const;
