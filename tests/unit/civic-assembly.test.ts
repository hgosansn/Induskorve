import { describe, expect, it } from 'vitest';
import { composeCivicBuilding } from '../../src/rendering/assembly/civic';
import {
  validateAssembly,
  type AssemblyInput,
} from '../../src/rendering/assembly/model';

describe('civic building supports and pedestrian access', () => {
  it('keeps every civic family grounded and clear across height and shape limits', () => {
    for (const type of ['residential', 'skyscraper', 'shop'] as const)
      for (const shape of ['block', 'stepped', 'tower'] as const)
        for (const h of [0, 8, 40, 85, 160, 1000]) {
          const a = composeCivicBuilding({
            type,
            h,
            variant: 0.5,
            design: {
              shape,
              stacks: false,
              balcony: true,
              display: 'animated',
            },
          });
          expect(validateAssembly(a), `${type}/${shape}/${h}`).toEqual([]);
          expect(a.parts.map((p) => p.kind)).toEqual([
            'foundation',
            'hall',
            'grid',
          ]);
          expect(a.ports.map((p) => p.service)).toEqual(['power']);
          expect(a.routes).toEqual([]);
          const grid = a.parts.find((p) => p.id === 'grid')!;
          expect(grid.volume.z).toBe(0.8);
          expect(a.ports[0]!.point[2]).toBeCloseTo(2.35);
        }
  });

  it('detects a service cabinet lifted off its actual ground support', () => {
    const a = composeCivicBuilding({
      type: 'residential',
      h: 85,
      variant: 0.5,
    });
    const grid = a.parts.find((p) => p.id === 'grid')!;
    grid.volume.z += 0.1;
    grid.solids[0]!.z += 0.1;
    expect(validateAssembly(a)).toContain('grid: unsupported top mount');
  });

  it('does not silently reinterpret an industrial family', () => {
    expect(() =>
      composeCivicBuilding({
        type: 'power',
        h: 40,
        variant: 0.5,
      } as AssemblyInput),
    ).toThrow('Not a civic building');
  });
});
