import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { foundryKit } from '../../src/rendering/canvas/foundry-kit';
import { composeBuilding } from '../../src/rendering/assembly/compose';
import { assemblyDimensions } from '../../src/rendering/assembly/mounts';
import { validateAssembly } from '../../src/rendering/assembly/model';
import type { Volume } from '../../src/rendering/assembly/model';
import type {
  BuildingDesign,
  BuildingModule,
} from '../../src/domain/city/model';

describe('native-scale foundry sprite kit', () => {
  it('fits supported bays and exact route ports across shapes, seeds, heights and modules', () => {
    for (const shape of ['block', 'stepped', 'tower'] as const)
      for (const h of [30, 78, 120])
        for (const variant of [0, 0.3, 0.5, 0.99])
          for (const modules of [
            [],
            ['furnace'],
            ['scrubber'],
            ['furnace', 'scrubber'],
          ] as BuildingModule[][]) {
            const b = {
              type: 'factory' as const,
              h,
              variant,
              design: { shape } as BuildingDesign,
              modules,
            };
            const assembly = composeBuilding(b);
            const { equipmentX, floor } = assemblyDimensions(b);
            expect(validateAssembly(assembly)).toEqual([]);
            for (const [owner, asset] of [
              ['grid', 'city-grid'],
              ['second-furnace', 'city-furnace'],
              ['exhaust-stand', 'city-saddle'],
            ]) {
              const part = assembly.parts.find((p) => p.id === owner);
              if (!part) continue;
              const sprite = foundryKit.find((p) => p.id === asset)!;
              const size = [part.volume.w, part.volume.d, part.volume.h];
              for (let axis = 0; axis < 3; axis++) {
                expect(sprite.bounds.min[axis]!).toBeGreaterThanOrEqual(-1e-5);
                expect(sprite.bounds.max[axis]!).toBeLessThanOrEqual(
                  size[axis]! + 1e-5,
                );
              }
            }
            const grid = assembly.parts.find((p) => p.id === 'grid')!;
            const wire = assembly.ports.find((p) => p.id === 'grid')!;
            const socket = foundryKit.find((p) => p.id === 'city-grid')!
              .ports[0]!;
            const origin = [grid.volume.x, grid.volume.y, grid.volume.z];
            for (let axis = 0; axis < 3; axis++)
              expect(wire.point[axis]).toBeCloseTo(
                origin[axis]! + socket.point[axis]!,
                5,
              );
            for (const route of assembly.routes.filter(
              (r) => r.service === 'exhaust',
            )) {
              const sprite = foundryKit.find(
                (p) => p.id === `route-${route.id}`,
              )!;
              for (const [index, port] of sprite.ports.entries()) {
                const endpoint =
                  index === 0 ? route.points[0]! : route.points.at(-1)!;
                const offset = [equipmentX, 0, floor];
                for (let axis = 0; axis < 3; axis++)
                  expect(offset[axis]! + port.point[axis]!).toBeCloseTo(
                    endpoint[axis]!,
                    5,
                  );
                expect(port.radius! * 2).toBe(route.diameter);
              }
            }
            expect(
              assembly.routes.some((r) => r.id === 'second-extraction'),
            ).toBe(modules.includes('furnace'));
          }
  });

  it('keeps the expanded shared equipment catalog under 70 KB, without per-seed or per-state textures', () => {
    expect(
      foundryKit.reduce((n, p) => n + p.variants[256].bytes, 0),
    ).toBeLessThan(70_000);
    expect(foundryKit).toHaveLength(10);
  });

  it('keeps evaluated duct vertices and triangle centres clear of other solids and access lanes', () => {
    const samples = JSON.parse(
      readFileSync(
        new URL('../fixtures/foundry-route-samples.json', import.meta.url),
        'utf8',
      ),
    ) as Record<string, number[][]>;
    const inside = (p: number[], v: Volume) =>
      p[0]! > v.x + 1e-5 &&
      p[0]! < v.x + v.w - 1e-5 &&
      p[1]! > v.y + 1e-5 &&
      p[1]! < v.y + v.d - 1e-5 &&
      p[2]! > v.z + 1e-5 &&
      p[2]! < v.z + v.h - 1e-5;
    const collisions = new Set<string>();
    for (const shape of ['block', 'stepped', 'tower'] as const) {
      const b = {
        type: 'factory' as const,
        h: 78,
        variant: 0.5,
        design: { shape } as BuildingDesign,
        modules: ['furnace', 'scrubber'] as BuildingModule[],
      };
      const a = composeBuilding(b),
        d = assemblyDimensions(b);
      for (const route of a.routes.filter((r) => r.service === 'exhaust')) {
        const ownerIds = [route.from, route.to].map(
          (id) => a.ports.find((p) => p.id === id)!.part,
        );
        for (const local of samples[`route-${route.id}`]!) {
          const p = [local[0]! + d.equipmentX, local[1]!, local[2]! + d.floor];
          for (const part of a.parts.filter((p) => p.kind !== 'foundation')) {
            if (
              ownerIds.includes(part.id) &&
              [route.points[0]!, route.points.at(-1)!].some(
                (q) => Math.hypot(...p.map((v, i) => v - q[i]!)) < 0.25,
              )
            )
              continue;
            if (part.solids.some((v) => inside(p, v)))
              collisions.add(`${shape}/${route.id} enters ${part.id}`);
          }
          if (a.clearances.some((c) => inside(p, c.volume)))
            collisions.add(`${shape}/${route.id} blocks access`);
        }
      }
    }
    expect([...collisions]).toEqual([]);
  });
});
