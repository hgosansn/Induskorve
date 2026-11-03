import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { defaultDraft } from '../../src/domain/city/model';
import { composeBuilding } from '../../src/rendering/assembly/compose';
import { KIT_SIZE, KIT_Z } from '../../src/rendering/assembly/model';
import { createGeometry, iso } from '../../src/rendering/canvas/geometry';
import { paintPowerEquipment } from '../../src/rendering/canvas/power-equipment';
import type { Palette } from '../../src/rendering/palette';

const palette = Object.fromEntries(
  [
    ...readFileSync('src/app/palette.css', 'utf8').matchAll(
      /--([\w-]+):\s*([^;]+);/g,
    ),
  ].map((match) => [match[1], match[2]!.trim()]),
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

describe('power equipment artwork', () => {
  it('keeps native surface vertices inside reserved projected bays across shape, height and seed variations', () => {
    let checked = 0;
    for (const shape of ['block', 'stepped', 'tower'] as const)
      for (const height of [8, 24, 85, 160])
        for (const seed of [0, 0.5, 0.999]) {
          const assembly = composeBuilding({
            type: 'power',
            h: height,
            variant: seed,
            design: { ...defaultDraft.design, shape },
            modules: ['turbine', 'heat-exchanger'],
          });
          for (const part of assembly.parts.filter((p) =>
            ['cooler', 'turbine', 'exchanger'].includes(p.kind),
          )) {
            const { g, points } = recording();
            expect(
              paintPowerEquipment(g, part, { x: 0, y: 0 }, true, true),
            ).toBe(true);
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
            expect(points.length).toBeGreaterThan(30);
            expect(points.every((point) => point.every(Number.isFinite))).toBe(
              true,
            );
            for (const axis of [0, 1]) {
              expect(
                Math.min(...points.map((p) => p[axis]!)),
              ).toBeGreaterThanOrEqual(
                Math.min(...corners.map((p) => p[axis]!)) - 0.001,
              );
              expect(
                Math.max(...points.map((p) => p[axis]!)),
              ).toBeLessThanOrEqual(
                Math.max(...corners.map((p) => p[axis]!)) + 0.001,
              );
            }
            checked++;
          }
        }
    expect(checked).toBe(108);
  });

  it('extinguishes electrical status indicators while retaining physical heat-recovery copper', () => {
    const assembly = composeBuilding({
      type: 'power',
      h: 78,
      variant: 0.5,
      design: defaultDraft.design,
      modules: ['turbine', 'heat-exchanger'],
    });
    for (const part of assembly.parts.filter((p) =>
      ['cooler', 'turbine', 'exchanger'].includes(p.kind),
    )) {
      const active = recording(),
        idle = recording();
      paintPowerEquipment(active.g, part, { x: 0, y: 0 }, true, true);
      paintPowerEquipment(idle.g, part, { x: 0, y: 0 }, false, true);
      expect(active.colors).toContain(palette.power);
      expect(idle.colors).not.toContain(palette.power);
      if (part.kind === 'exchanger')
        expect(idle.colors).toContain(palette.production);
    }
  });

  it('declines unrelated pieces without emitting geometry', () => {
    const hall = composeBuilding({
      type: 'power',
      h: 48,
      variant: 0.5,
    }).parts.find((p) => p.kind === 'hall')!;
    const { g, points } = recording();
    expect(paintPowerEquipment(g, hall, { x: 0, y: 0 }, true, true)).toBe(
      false,
    );
    expect(points).toEqual([]);
  });
});
