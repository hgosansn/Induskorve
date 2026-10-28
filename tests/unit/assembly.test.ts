import { describe, expect, it } from 'vitest';
import { composeBuilding } from '../../src/rendering/assembly/compose';
import {
  validateAssembly,
  type AssemblyInput,
} from '../../src/rendering/assembly/model';
import { assemblyDrawOrder } from '../../src/rendering/assembly/draw-order';
import {
  defaultDraft,
  moduleKinds,
  type BuildingKind,
  type BuildingModule,
} from '../../src/domain/city/model';

const families: BuildingKind[] = ['power', 'factory', 'warehouse'];
function input(type: BuildingKind): AssemblyInput {
  return {
    type,
    h: 58,
    variant: 0.5,
    modules: [],
    design: defaultDraft.design,
    stock: 400,
  };
}
describe('building assembly contracts', () => {
  it('places footings only beneath ground-contact solids, leaving crane voids and aprons open', () => {
    for (const type of families) {
      const a = composeBuilding({
        ...input(type),
        modules: type === 'warehouse' ? ['loading-bay'] : [],
      });
      const base = a.parts.find((p) => p.id === 'base')!;
      const groundParts = a.parts.filter(
        (p) => a.mounts.find((m) => m.id === p.mount)?.support === 'base',
      );
      const feet = groundParts.flatMap((p) =>
        p.solids.filter((s) => Math.abs(s.z - base.volume.h) < 0.001),
      );
      expect(base.solids).toHaveLength(feet.length);
      for (const pad of base.solids)
        expect(
          feet.some(
            (s) =>
              s.x === pad.x && s.y === pad.y && s.w === pad.w && s.d === pad.d,
          ),
        ).toBe(true);
      expect(base.solids.reduce((area, s) => area + s.w * s.d, 0)).toBeLessThan(
        base.volume.w * base.volume.d * 0.85,
      );
      const removed = base.solids.shift()!;
      expect(
        validateAssembly(a).some((e) => e.includes('unsupported top mount')),
      ).toBe(true);
      base.solids.unshift(removed);
      expect(validateAssembly(a)).toEqual([]);
    }
  });
  it('reserves the same mounting bays before and after equipment is installed', () => {
    const empty = composeBuilding(input('power'));
    const fitted = composeBuilding({
      ...input('power'),
      modules: ['turbine', 'heat-exchanger'],
    });
    expect(fitted.mounts).toEqual(empty.mounts);
    expect(empty.parts.some((p) => p.id === 'extra-turbine')).toBe(false);
    const unit = fitted.parts.find((p) => p.id === 'extra-turbine')!;
    expect(unit.volume).toEqual(
      empty.mounts.find((m) => m.id === unit.mount)!.volume,
    );
  });
  it('fits every module combination, shape and supported height without collisions or obstructed access', () => {
    let count = 0;
    for (const type of families) {
      const modules = (Object.keys(moduleKinds) as BuildingModule[]).filter(
        (m) => moduleKinds[m] === type,
      );
      for (let mask = 0; mask < 1 << modules.length; mask++)
        for (const h of [8, 24, 48, 85, 160])
          for (const shape of ['block', 'stepped', 'tower'] as const)
            for (const balcony of [false, true]) {
              const b = {
                ...input(type),
                h,
                modules: modules.filter((_, i) => mask & (1 << i)),
                design: { ...defaultDraft.design, shape, balcony },
              };
              const a = composeBuilding(b);
              expect(
                validateAssembly(a),
                JSON.stringify({ type, h, shape, balcony, modules: b.modules }),
              ).toEqual([]);
              count++;
            }
    }
    expect(count).toBe(360);
  });
  it('detects a collision instead of exempting equipment in the same layer', () => {
    const a = composeBuilding(input('power'));
    const control = a.parts.find((p) => p.id === 'control')!,
      grid = a.parts.find((p) => p.id === 'grid')!;
    control.volume = { ...grid.volume };
    control.solids = [control.volume];
    expect(validateAssembly(a)).toContain('control intersects grid');
  });
  it('rejects floating or incompatible parts and blocked maintenance lanes', () => {
    const a = composeBuilding(input('power')),
      p = a.parts.find((p) => p.id === 'control')!;
    p.volume.z += 0.2;
    expect(validateAssembly(a)).toContain('control: unsupported top mount');
    p.kind = 'cooler';
    expect(validateAssembly(a)).toContain('control: incompatible mount');
    const access = a.clearances.find((c) => c.id === 'roof-access')!.volume;
    p.volume.y = access.y;
    p.volume.z = access.z;
    expect(validateAssembly(a)).toContain('control blocks roof-access');
  });
  it('rejects disconnected and intersecting process ducts', () => {
    const a = composeBuilding(input('power'));
    a.routes[0]!.points[1] = [4, 2.6, 2];
    const errors = validateAssembly(a);
    expect(errors).toContain('cooling-feed: disconnected route');
    expect(errors).toContain('cooling-feed: pipe enters hall');
  });
  it('keeps cargo inside the gantry void and stops drawing stock when empty', () => {
    const b = {
      ...input('warehouse'),
      modules: ['loading-bay'] as BuildingModule[],
    };
    const full = composeBuilding(b);
    expect(full.parts.filter((p) => p.kind === 'cargo')).toHaveLength(8);
    expect(validateAssembly(full)).toEqual([]);
    expect(
      composeBuilding({ ...b, stock: 0 }).parts.some((p) => p.kind === 'cargo'),
    ).toBe(false);
  });
  it('replaces the exhaust bypass with treatment in the same mounted bay', () => {
    const base = composeBuilding(input('factory')),
      fitted = composeBuilding({ ...input('factory'), modules: ['scrubber'] });
    const before = base.parts.find((p) => p.id === 'extraction')!,
      after = fitted.parts.find((p) => p.id === 'extraction')!;
    expect(after.volume).toEqual(before.volume);
    expect(after.kind).toBe('scrubber');
    expect(before.kind).toBe('stack');
  });
  it('paints supports before mounted parts without using assembly layers as draw order', () => {
    const a = composeBuilding({
      ...input('power'),
      modules: ['turbine', 'heat-exchanger'],
    });
    const order = assemblyDrawOrder(a).map((p) => p.id);
    for (const m of a.mounts)
      expect(order.indexOf(m.support)).toBeLessThan(
        order.indexOf(a.parts.find((p) => p.mount === m.id)!.id),
      );
    expect(order.indexOf('control')).toBeLessThan(order.indexOf('cooler'));
  });
});
