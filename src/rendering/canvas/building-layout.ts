import type { RenderBuilding } from './view-model';
import { buildingAssembly } from '../assembly/compose';
import { KIT_SIZE, KIT_Z } from '../assembly/model';
export {
  ASSEMBLY_LAYERS,
  type AssemblyLayer,
  type BuildingStudy,
} from '../assembly/model';
import type { AssemblyLayer, BuildingStudy } from '../assembly/model';

export const roofHeight = (b: RenderBuilding) => {
  const hall = buildingAssembly(b).parts.find((p) => p.id === 'hall')!.volume;
  return (hall.z + hall.h) * KIT_Z;
};
// Cables and the physical rack share the assembly port, including its elevation.
export function attachment(
  b: RenderBuilding,
  kind: 'power' | 'materials' | 'heat',
) {
  const a = buildingAssembly(b);
  const p = a.ports.find(
    (p) =>
      p.id ===
      (kind === 'power'
        ? 'grid'
        : kind === 'materials'
          ? 'logistics'
          : a.ports.some((p) => p.id === 'heat-export')
            ? 'heat-export'
            : 'heat'),
  )!;
  const owner = a.parts.find((part) => part.id === p.part)!;
  return {
    x: b.x + p.point[0] / KIT_SIZE,
    y: b.y + p.point[1] / KIT_SIZE,
    z: p.point[2] * KIT_Z,
    base: owner.volume.z * KIT_Z,
  };
}
export const assemblyOffset = (layer: AssemblyLayer, study?: BuildingStudy) =>
  study?.exploded
    ? Math.max(
        0,
        [
          'all',
          'foundation',
          'shell',
          'machinery',
          'modules',
          'services',
        ].indexOf(layer) - 1,
      ) * 19
    : 0;
