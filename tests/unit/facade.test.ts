import { describe, it, expect } from 'vitest';
import { composeFacade } from '../../src/rendering/assembly/facade';
import { composeBuilding } from '../../src/rendering/assembly/compose';
import {
  contains,
  type AssemblyInput,
  volume,
} from '../../src/rendering/assembly/model';
import { defaultDraft } from '../../src/domain/city/model';

const base: AssemblyInput = {
  type: 'power',
  h: 78,
  variant: 0.5,
  design: defaultDraft.design,
};
function facade(b: AssemblyInput) {
  const hall = composeBuilding(b).parts.find((p) => p.id === 'hall')!.volume;
  return { hall, facade: composeFacade(b, hall) };
}
describe('architectural facade kit', () => {
  it('keeps every floor, panel backing and structural column inside the reserved hall', () => {
    for (const type of ['power', 'factory', 'warehouse'] as const)
      for (const h of [8, 24, 48, 78, 85, 160])
        for (const shape of ['block', 'stepped', 'tower'] as const) {
          const { hall, facade: f } = facade({
            ...base,
            type,
            h,
            design: { ...defaultDraft.design, shape },
          });
          for (const v of [
            f.roof,
            f.spine,
            ...f.columns,
            ...f.floors.flatMap((f) => [f.body, f.slab]),
          ])
            expect(contains(hall, v)).toBe(true);
          for (const floor of f.floors) {
            expect(floor.body.h).toBeGreaterThan(0);
            for (const bay of floor.bays) {
              expect(bay.start).toBeGreaterThanOrEqual(0);
              expect(bay.start + bay.width).toBeLessThanOrEqual(
                bay.face === 'front' ? floor.body.w : floor.body.d,
              );
              expect(bay.z).toBeGreaterThanOrEqual(floor.body.z);
              expect(bay.z + bay.height).toBeLessThanOrEqual(
                floor.body.z + floor.body.h,
              );
            }
          }
          expect(
            contains(
              f.spine,
              volume(
                f.display.x,
                f.display.y,
                f.display.z,
                0,
                f.display.width,
                f.display.height,
              ),
            ),
          ).toBe(true);
        }
  });
  it('changes hall setbacks with the chosen architecture while preserving all machinery mounts', () => {
    const shapes = ['block', 'stepped', 'tower'] as const;
    const inputs = shapes.map((shape) => ({
      ...base,
      design: { ...defaultDraft.design, shape },
    }));
    const profiles = inputs.map((b) => facade(b).facade);
    expect(profiles[0]!.floors[1]!.body.w).toBeGreaterThan(
      profiles[1]!.floors[1]!.body.w,
    );
    expect(profiles[1]!.floors[1]!.body.w).toBeGreaterThan(
      profiles[2]!.floors[1]!.body.w,
    );
    expect(composeBuilding(inputs[0]!).mounts).toEqual(
      composeBuilding(inputs[2]!).mounts,
    );
  });
  it('keeps floor lighting deterministic and uneven across architectural bays', () => {
    const a = facade(base).facade;
    expect(facade({ ...base }).facade).toEqual(a);
    const windows = a.floors.flatMap((f) => f.bays).filter((b) => b.glazing);
    expect(windows.some((w) => w.lit)).toBe(true);
    expect(windows.some((w) => !w.lit)).toBe(true);
    expect(facade({ ...base, variant: 0.7 }).facade.floors).not.toEqual(
      a.floors,
    );
  });
});
