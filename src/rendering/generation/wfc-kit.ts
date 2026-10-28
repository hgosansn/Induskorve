import type { WfcBuilding } from './wfc';
import type { BuildingKind } from '../../domain/city/model';
export type FacadePiece =
  'glazing' | 'clerestory' | 'louvers' | 'ribs' | 'frame';
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
  facade: FacadePiece;
  roofFinish: 'membrane' | 'daylight' | 'deck';
}
export function compileWfcKit(
  b: WfcBuilding,
  role?: BuildingKind,
): GeneratedBay[] {
  const bays: GeneratedBay[] = [];
  const rhythm = b.seed % 3;
  for (let y = 0; y < b.size; y++)
    for (let x = 0; x < b.size; x++) {
      const index = x + y * b.size,
        height = b.heights[index]!;
      for (let floor = 0; floor < height; floor++) {
        const v =
          Math.sin(b.seed * 0.13 + index * 173 + floor * 37) * 43758.5453;
        const core = index === b.core;
        // A facade column keeps its construction language between floors.
        // Top occupied floors house operators; ground bays enclose the process.
        const families: FacadePiece[] =
          role === 'factory'
            ? ['louvers', 'frame', 'ribs']
            : role === 'warehouse'
              ? ['ribs', 'clerestory', 'frame']
              : ['glazing', 'louvers', 'frame'];
        const facade: FacadePiece = core
          ? 'clerestory'
          : floor === height - 1 && floor > 0 && y < 2
            ? 'glazing'
            : families[(x + rhythm) % families.length]!;
        bays.push({
          x,
          y,
          floor,
          front: y === b.size - 1 || b.heights[index + b.size]! <= floor,
          right: x === b.size - 1 || b.heights[index + 1]! <= floor,
          roof: floor === height - 1,
          core,
          entrance: index === b.entrance && floor === 0,
          lit: v - Math.floor(v) > 0.3,
          braced: facade === 'frame',
          facade,
          roofFinish:
            role === 'factory' && (x + rhythm) % 2 === 0
              ? 'daylight'
              : core || (x + y + rhythm) % 3 === 0
                ? 'deck'
                : 'membrane',
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
    'Glazed operator bay',
    'Upper occupied floors integrate control spaces into the hall.',
  ],
  [
    'Louver bay',
    'Ventilates process floors; slats share a continuous floor and column grid.',
  ],
  [
    'Ribbed cladding',
    'Insulated solid enclosure for freight and industrial spaces.',
  ],
  [
    'Clerestory bay',
    'A high daylight ribbon leaves solid wall below for plant and circulation.',
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
