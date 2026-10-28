import type { RenderBuilding } from './view-model';

export const ASSEMBLY_LAYERS = [
  'all',
  'foundation',
  'shell',
  'machinery',
  'modules',
  'services',
] as const;
export type AssemblyLayer = (typeof ASSEMBLY_LAYERS)[number];
export interface BuildingStudy {
  exploded: boolean;
  focus: AssemblyLayer;
}
export const roofHeight = (b: RenderBuilding) =>
  b.h * (b.type === 'warehouse' ? 0.42 : 0.55);
// The drawing and connection renderer use the same physical hardware anchors.
export function attachment(
  b: RenderBuilding,
  kind: 'power' | 'materials' | 'heat',
) {
  return {
    x: b.x + (kind === 'power' ? 0.18 : 0.79),
    y: b.y + (kind === 'power' ? 0.72 : 0.33),
    z: roofHeight(b) + (kind === 'power' ? 14 : 10),
    base: roofHeight(b) + 3,
  };
}
export const assemblyOffset = (layer: AssemblyLayer, study?: BuildingStudy) =>
  study?.exploded ? Math.max(0, ASSEMBLY_LAYERS.indexOf(layer) - 1) * 19 : 0;
