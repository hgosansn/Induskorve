import { expect, it } from 'vitest';
import { composeBuilding } from '../../src/rendering/assembly/compose';
import { gantryHoist } from '../../src/rendering/assembly/gantry-hoist';
import { defaultDraft } from '../../src/domain/city/model';

it('keeps the moving hook above full stock and inside the open span, including short halls', () => {
  for (const shape of ['block', 'stepped', 'tower'] as const)
    for (const h of [24, 85, 160]) {
      const a = composeBuilding({
        type: 'warehouse',
        h,
        variant: 0.5,
        design: { ...defaultDraft.design, shape },
        modules: ['loading-bay'],
        stock: 400,
      });
      const part = a.parts.find((p) => p.kind === 'gantry')!;
      const stockTop = Math.max(
        ...a.parts
          .filter((p) => p.kind === 'cargo')
          .map((p) => p.volume.z + p.volume.h),
      );
      for (const t of [0, 2, 6, 10]) {
        const hoist = gantryHoist(part, true, t, 0.5);
        expect(Math.min(...hoist.hook.map((p) => p[2]))).toBeGreaterThan(
          stockTop + 0.1,
        );
        expect(hoist.ropeTop[2]).toBeGreaterThanOrEqual(hoist.ropeBottom[2]);
        expect(hoist.block.x).toBeGreaterThan(part.volume.x + 0.3);
        expect(hoist.block.x + hoist.block.w).toBeLessThan(
          part.volume.x + part.volume.w - 0.3,
        );
        expect(gantryHoist(part, false, t, 0.5)).toEqual(
          gantryHoist(part, false, 0, 0.5),
        );
      }
      expect(gantryHoist(part, true, 0, 0.5).x).not.toBe(
        gantryHoist(part, true, 2, 0.5).x,
      );
    }
});
