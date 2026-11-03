import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { composeBuilding } from '../../src/rendering/assembly/compose';
import {
  KIT_SIZE,
  KIT_Z,
  type AssemblyPart,
} from '../../src/rendering/assembly/model';
import { defaultDraft } from '../../src/domain/city/model';
import { createGeometry, iso } from '../../src/rendering/canvas/geometry';
import { paintFreightEquipment } from '../../src/rendering/canvas/freight-equipment';
import type { Palette } from '../../src/rendering/palette';

const palette = Object.fromEntries(
  [
    ...readFileSync('src/app/palette.css', 'utf8').matchAll(
      /--([\w-]+):\s*([^;]+);/g,
    ),
  ].map((m) => [m[1], m[2]!.trim()]),
) as Palette;
function record(part: AssemblyPart, active = true, fine = true) {
  const points: [number, number][] = [],
    colors: string[] = [];
  const ctx = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    beginPath() {},
    closePath() {},
    moveTo(x: number, y: number) {
      points.push([x, y]);
    },
    lineTo(x: number, y: number) {
      points.push([x, y]);
    },
    fill() {
      colors.push(String(this.fillStyle));
    },
    stroke() {
      colors.push(String(this.strokeStyle));
    },
  };
  const handled = paintFreightEquipment(
    createGeometry(ctx as unknown as CanvasRenderingContext2D, palette),
    part,
    { x: 0, y: 0 },
    active,
    fine,
  );
  return { points, colors, handled };
}
describe('freight static artwork contracts', () => {
  it('keeps all emitted vertices finite and inside the existing sprite bounds across warehouse profiles', () => {
    for (const shape of ['block', 'stepped', 'tower'] as const)
      for (const h of [24, 48, 85])
        for (const variant of [0, 0.5, 0.999]) {
          const a = composeBuilding({
            type: 'warehouse',
            h,
            variant,
            stock: 400,
            design: { ...defaultDraft.design, shape },
            modules: ['loading-bay', 'solar-roof'],
          });
          for (const part of a.parts.filter((p) =>
            ['cargo', 'solar', 'gantry'].includes(p.kind),
          )) {
            const v = part.volume;
            const corners = [0, 1].flatMap((x) =>
              [0, 1].flatMap((y) =>
                [0, 1].map((z) =>
                  iso(
                    (v.x + x * v.w) / KIT_SIZE,
                    (v.y + y * v.d) / KIT_SIZE,
                    (v.z + z * v.h) * KIT_Z,
                  ),
                ),
              ),
            );
            for (const fine of [false, true]) {
              const result = record(part, true, fine);
              expect(result.handled).toBe(true);
              expect(result.points.length).toBeGreaterThan(10);
              for (const [x, y] of result.points) {
                expect(Number.isFinite(x) && Number.isFinite(y)).toBe(true);
                expect(x).toBeGreaterThanOrEqual(
                  Math.min(...corners.map((p) => p[0])) - 1e-6,
                );
                expect(x).toBeLessThanOrEqual(
                  Math.max(...corners.map((p) => p[0])) + 1e-6,
                );
                expect(y).toBeGreaterThanOrEqual(
                  Math.min(...corners.map((p) => p[1])) - 1e-6,
                );
                expect(y).toBeLessThanOrEqual(
                  Math.max(...corners.map((p) => p[1])) + 1e-6,
                );
              }
            }
          }
        }
  });
  it('retains physical inventory and solar geometry while idle and never draws another part kind', () => {
    const a = composeBuilding({
      type: 'warehouse',
      h: 48,
      variant: 0.5,
      stock: 150,
      design: defaultDraft.design,
      modules: ['loading-bay', 'solar-roof'],
    });
    for (const part of a.parts.filter((p) =>
      ['cargo', 'solar'].includes(p.kind),
    ))
      expect(record(part, false)).toEqual(record(part, true));
    const hall = a.parts.find((p) => p.kind === 'hall')!;
    expect(record(hall)).toEqual({ points: [], colors: [], handled: false });
    const empty = composeBuilding({
      type: 'warehouse',
      h: 48,
      variant: 0.5,
      stock: 0,
      design: defaultDraft.design,
      modules: [],
    });
    expect(
      empty.parts.filter((p) =>
        paintFreightEquipment(
          createGeometry({} as CanvasRenderingContext2D, palette),
          p,
          { x: 0, y: 0 },
          false,
          false,
        ),
      ),
    ).toHaveLength(0);
  });
});
