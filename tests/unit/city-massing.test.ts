import { describe, expect, it } from 'vitest';
import { composeBuilding } from '../../src/rendering/assembly/compose';
import {
  validateAssembly,
  type AssemblyInput,
} from '../../src/rendering/assembly/model';
import {
  cityMassing,
  levelHeight,
} from '../../src/rendering/generation/city-massing';
import { validateWfc } from '../../src/rendering/generation/wfc';
import {
  defaultDraft,
  moduleKinds,
  type BuildingModule,
  worldSchema,
} from '../../src/domain/city/model';
import {
  projectPlacement,
  projectWorld,
} from '../../src/rendering/canvas/view-model';

const families = ['power', 'factory', 'warehouse'] as const;
describe('modular city buildings', () => {
  it('supports every roof pad and retains connected floors across roles, shapes and seeds', () => {
    for (const type of families)
      for (const shape of ['block', 'stepped', 'tower'] as const)
        for (const h of [8, 48, 85, 160])
          for (let seed = 0; seed < 12; seed++) {
            const b: AssemblyInput = {
              type,
              h,
              variant: seed / 11,
              stock: 400,
              modules: (Object.keys(moduleKinds) as BuildingModule[]).filter(
                (m) => moduleKinds[m] === type,
              ),
              design: { ...defaultDraft.design, shape },
            };
            const a = composeBuilding(b),
              hall = a.parts.find((p) => p.id === 'hall')!,
              m = cityMassing(b, hall.volume);
            const context = JSON.stringify({ type, shape, h, seed });
            expect(m.fallback, context).toBe(false);
            expect(validateWfc(m.recipe, m.constraints), context).toEqual([]);
            expect(validateAssembly(a), context).toEqual([]);
            expect(Math.max(...hall.solids.map((s) => s.z + s.h))).toBeCloseTo(
              hall.volume.z + hall.volume.h,
            );
            expect(levelHeight(m, 1)).toBeGreaterThan(
              type === 'factory' ? 2 : 1.2,
            );
          }
  });
  it('rejects a floating roof pad even when its conservative hall envelope looks supported', () => {
    const a = composeBuilding({ type: 'power', h: 85, variant: 0.5 });
    a.parts.find((p) => p.id === 'hall')!.solids[3]!.h -= 0.2;
    expect(validateAssembly(a)).toContain('grid: unsupported top mount');
  });
  it('keeps machinery retrofits and stock changes from reshuffling the architecture', () => {
    const b: AssemblyInput = {
      type: 'warehouse',
      h: 85,
      variant: 0.433,
      design: defaultDraft.design,
    };
    const initial = composeBuilding(b).parts.find(
      (p) => p.id === 'hall',
    )!.solids;
    expect(
      composeBuilding({
        ...b,
        modules: ['loading-bay', 'solar-roof'],
        stock: 400,
      }).parts.find((p) => p.id === 'hall')!.solids,
    ).toEqual(initial);
    const variants = new Set(
      Array.from({ length: 20 }, (_, i) =>
        JSON.stringify(
          composeBuilding({ ...b, variant: i / 19 }).parts.find(
            (p) => p.id === 'hall',
          )!.solids,
        ),
      ),
    );
    expect(variants.size).toBeGreaterThan(10);
  });
  it('uses identical recipes in workshop, forecast ghost and a reloaded placed building', () => {
    const world = {
      version: 3 as const,
      citizens: [],
      buildings: [{ id: 0, type: 'power' as const, x: 0, y: 0, on: true }],
      appearances: [{ buildingId: 0, height: 85, seed: 0.2 }],
    };
    const draft = { ...defaultDraft, seed: 0.735, kind: 'warehouse' as const };
    const ghost = projectPlacement(world, draft, { x: 1, y: 1 })!.building;
    const placed = worldSchema.parse(
      JSON.parse(
        JSON.stringify({
          ...world,
          buildings: [
            ...world.buildings,
            { id: 1, x: 1, y: 1, type: draft.kind, on: true },
          ],
          appearances: [
            ...world.appearances,
            {
              buildingId: 1,
              height: draft.height,
              seed: draft.seed,
              design: draft.design,
            },
          ],
        }),
      ),
    );
    const b = projectWorld(placed).buildings.get('1,1')!;
    const workshop = {
      type: draft.kind,
      h: draft.height,
      variant: draft.seed,
      design: draft.design,
    };
    const recipe = (input: AssemblyInput) => {
      const hall = composeBuilding(input).parts.find(
        (p) => p.id === 'hall',
      )!.volume;
      return cityMassing(input, hall).recipe;
    };
    expect(recipe(ghost)).toEqual(recipe(b));
    expect(recipe(workshop)).toEqual(recipe(b));
  });
});
