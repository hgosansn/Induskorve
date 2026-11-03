import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { defaultDraft } from '../../src/domain/city/model';
import { composeBuilding } from '../../src/rendering/assembly/compose';
import { KIT_SIZE, KIT_Z } from '../../src/rendering/assembly/model';
import { createGeometry, iso } from '../../src/rendering/canvas/geometry';
import { paintFoundryEquipment } from '../../src/rendering/canvas/foundry-equipment';
import type { Palette } from '../../src/rendering/palette';

const palette = Object.fromEntries(
  [
    ...readFileSync('src/app/palette.css', 'utf8').matchAll(
      /--([\w-]+):\s*([^;]+);/g,
    ),
  ].map((m) => [m[1], m[2]!.trim()]),
) as Palette;
function recording() {
  const points: [number, number][] = [];
  const colors: string[] = [];
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
  return {
    g: createGeometry(ctx as unknown as CanvasRenderingContext2D, palette),
    points,
    colors,
  };
}
describe('fixed-camera foundry equipment', () => {
  it('keeps detailed surface vertices inside the projected reserved bay across supported recipes', () => {
    for (const shape of ['block', 'stepped', 'tower'] as const)
      for (const h of [24, 48, 85])
        for (const variant of [0, 0.5, 0.999])
          for (const scrubber of [false, true]) {
            const assembly = composeBuilding({
              type: 'factory',
              h,
              variant,
              design: { ...defaultDraft.design, shape },
              modules: scrubber ? ['furnace', 'scrubber'] : ['furnace'],
            });
            for (const part of assembly.parts.filter((p) =>
              [
                'furnace',
                'stack',
                'scrubber',
                'plenum',
                'duct-support',
                'hatch',
              ].includes(p.kind),
            )) {
              const { g, points } = recording();
              paintFoundryEquipment(g, part, { x: 0, y: 0 }, true, true);
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
              const minX = Math.min(...corners.map((p) => p[0])),
                maxX = Math.max(...corners.map((p) => p[0]));
              const minY = Math.min(...corners.map((p) => p[1])),
                maxY = Math.max(...corners.map((p) => p[1]));
              expect(points.length).toBeGreaterThan(20);
              for (const [x, y] of points) {
                expect(Number.isFinite(x) && Number.isFinite(y)).toBe(true);
                expect(x).toBeGreaterThanOrEqual(minX - 0.001);
                expect(x).toBeLessThanOrEqual(maxX + 0.001);
                expect(y).toBeGreaterThanOrEqual(minY - 0.001);
                expect(y).toBeLessThanOrEqual(maxY + 0.001);
              }
            }
          }
  });
  it('extinguishes furnace and scrubber instrumentation light when idle', () => {
    const a = composeBuilding({
      type: 'factory',
      h: 78,
      variant: 0.5,
      design: defaultDraft.design,
      modules: ['furnace', 'scrubber'],
    });
    for (const part of a.parts.filter(
      (p) => p.kind === 'furnace' || p.kind === 'scrubber',
    )) {
      const lit = recording(),
        idle = recording();
      paintFoundryEquipment(lit.g, part, { x: 0, y: 0 }, true, true);
      paintFoundryEquipment(idle.g, part, { x: 0, y: 0 }, false, true);
      expect(lit.colors).toContain(palette.production);
      expect(idle.colors).not.toContain(palette.production);
    }
  });
});
