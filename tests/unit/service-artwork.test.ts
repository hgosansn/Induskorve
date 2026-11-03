import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { defaultDraft } from '../../src/domain/city/model';
import { composeBuilding } from '../../src/rendering/assembly/compose';
import { createGeometry, iso } from '../../src/rendering/canvas/geometry';
import { paintServiceEquipment } from '../../src/rendering/canvas/service-equipment';
import { foundryKit } from '../../src/rendering/canvas/foundry-kit';
import type { Palette } from '../../src/rendering/palette';

const palette = Object.fromEntries(
  [
    ...readFileSync('src/app/palette.css', 'utf8').matchAll(
      /--([\w-]+):\s*([^;]+);/g,
    ),
  ].map((m) => [m[1], m[2]!.trim()]),
) as Palette;
describe('shared current-kit construction', () => {
  it('keeps footing, ladder, catwalk and northlight surfaces in their native envelopes', () => {
    for (const type of ['power', 'factory', 'warehouse'] as const)
      for (const shape of ['block', 'stepped', 'tower'] as const)
        for (const h of [24, 78, 120]) {
          const a = composeBuilding({
            type,
            h,
            variant: 0.5,
            design: { ...defaultDraft.design, shape, balcony: true },
            modules: [],
          });
          for (const part of a.parts.filter((p) =>
            ['foundation', 'ladder', 'catwalk', 'skylights'].includes(p.kind),
          )) {
            const points: number[][] = [];
            const ctx = {
              beginPath() {},
              closePath() {},
              moveTo(x: number, y: number) {
                points.push([x, y]);
              },
              lineTo(x: number, y: number) {
                points.push([x, y]);
              },
              fill() {},
              stroke() {},
            } as unknown as CanvasRenderingContext2D;
            expect(
              paintServiceEquipment(
                createGeometry(ctx, palette),
                part,
                { x: 0, y: 0 },
                false,
                true,
              ),
            ).toBe(true);
            const v = part.volume,
              corners = [0, 1].flatMap((x) =>
                [0, 1].flatMap((y) =>
                  [0, 1].map((z) =>
                    iso(
                      (v.x + x * v.w) / 12,
                      (v.y + y * v.d) / 12,
                      (v.z + z * v.h) * 3,
                    ),
                  ),
                ),
              );
            for (const axis of [0, 1]) {
              expect(
                Math.min(...points.map((p) => p[axis]!)),
              ).toBeGreaterThanOrEqual(
                Math.min(...corners.map((p) => p[axis]!)) - 1e-5,
              );
              expect(
                Math.max(...points.map((p) => p[axis]!)),
              ).toBeLessThanOrEqual(
                Math.max(...corners.map((p) => p[axis]!)) + 1e-5,
              );
            }
          }
        }
  });
  it('matches shared power/logistics sockets and fits collector/hatch hardware across roles and profiles', () => {
    for (const type of ['power', 'factory', 'warehouse'] as const)
      for (const shape of ['block', 'stepped', 'tower'] as const) {
        const a = composeBuilding({
          type,
          h: 78,
          variant: 0.99,
          design: { ...defaultDraft.design, shape },
          modules: ['furnace', 'scrubber'],
        });
        for (const [id, assetId] of [
          ['grid', 'city-grid'],
          ['terminal', 'city-terminal'],
        ]) {
          const part = a.parts.find((p) => p.id === id)!,
            asset = foundryKit.find((p) => p.id === assetId)!,
            port = a.ports.find((p) => p.part === id)!,
            v = part.volume;
          [v.x, v.y, v.z].forEach((n, i) =>
            expect(n + asset.ports[0]!.point[i]!).toBeCloseTo(
              port.point[i]!,
              5,
            ),
          );
          [v.w, v.d, v.h].forEach((n, i) =>
            expect(asset.bounds.max[i]!).toBeLessThanOrEqual(n + 1e-5),
          );
        }
        for (const [id, assetId] of [
          ['exhaust-plenum', 'city-plenum'],
          ['roof-hatch', 'city-hatch'],
        ]) {
          const part = a.parts.find((p) => p.id === id);
          if (!part) continue;
          const asset = foundryKit.find((p) => p.id === assetId)!,
            v = part.volume;
          [v.w, v.d, v.h].forEach((n, i) =>
            expect(asset.bounds.max[i]!).toBeLessThanOrEqual(n + 1e-5),
          );
        }
      }
  });
});
