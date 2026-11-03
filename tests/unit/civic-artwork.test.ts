import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  civicHallPlan,
  createCivicHallRenderer,
} from '../../src/rendering/canvas/civic-buildings';
import { composeCivicBuilding } from '../../src/rendering/assembly/civic';
import type { RenderBuilding } from '../../src/rendering/canvas/view-model';
import type { Palette } from '../../src/rendering/palette';
import { iso } from '../../src/rendering/canvas/geometry';
import { KIT_SIZE, KIT_Z } from '../../src/rendering/assembly/model';

const palette = Object.fromEntries(
  [
    ...readFileSync('src/app/palette.css', 'utf8').matchAll(
      /--([\w-]+):\s*([^;]+);/g,
    ),
  ].map((m) => [m[1], m[2]!.trim()]),
) as Palette;
const building = (
  type: RenderBuilding['type'],
  shape: 'block' | 'stepped' | 'tower' = 'stepped',
  h = 100,
): RenderBuilding =>
  ({
    id: 37,
    x: 2,
    y: 3,
    type,
    h,
    variant: 0.47,
    owner: null,
    on: true,
    design: { shape, stacks: false, balcony: true, display: 'animated' },
  }) as RenderBuilding;
const hall = (b: RenderBuilding) =>
  composeCivicBuilding(b).parts.find((p) => p.id === 'hall')!.volume;
afterEach(() => vi.unstubAllGlobals());

describe('native civic architecture', () => {
  it('renders finite palette-only depth surfaces inside the projected occupied envelope', () => {
    const points: number[][] = [],
      colors: string[] = [];
    const target = new Proxy(
      {},
      {
        get:
          (_o, key) =>
          (...args: number[]) => {
            if (key === 'moveTo' || key === 'lineTo') points.push(args);
          },
        set: (_o, key, value: unknown) => {
          if (key === 'fillStyle' || key === 'strokeStyle')
            colors.push(String(value));
          return true;
        },
      },
    );
    vi.stubGlobal(
      'OffscreenCanvas',
      class {
        width: number;
        height: number;
        constructor(w: number, h: number) {
          this.width = w;
          this.height = h;
        }
        getContext() {
          return target;
        }
      },
    );
    const draw = createCivicHallRenderer(
      target as unknown as CanvasRenderingContext2D,
      palette,
    );
    for (const type of ['residential', 'skyscraper', 'shop'] as const)
      for (const shape of ['block', 'stepped', 'tower'] as const)
        for (const h of [0, 1000]) {
          const b = building(type, shape, h),
            v = hall(b);
          const corners = [v.x, v.x + v.w].flatMap((x) =>
            [v.y, v.y + v.d].flatMap((y) =>
              [v.z, v.z + v.h].map((z) =>
                iso(x / KIT_SIZE, y / KIT_SIZE, z * KIT_Z),
              ),
            ),
          );
          const start = points.length;
          draw(b, v, true, 2, () => {});
          for (const point of points.slice(start))
            for (const axis of [0, 1]) {
              expect(Number.isFinite(point[axis])).toBe(true);
              expect(point[axis]).toBeGreaterThanOrEqual(
                Math.min(...corners.map((c) => c[axis]!)) - 1e-7,
              );
              expect(point[axis]).toBeLessThanOrEqual(
                Math.max(...corners.map((c) => c[axis]!)) + 1e-7,
              );
            }
        }
    expect(points.length).toBeGreaterThan(1000);
    expect(colors.every((c) => Object.values(palette).includes(c))).toBe(true);
  });
  it('keeps tiers contained, supported and continuous behind the animated screen for every recipe', () => {
    for (const type of ['residential', 'skyscraper', 'shop'] as const)
      for (const shape of ['block', 'stepped', 'tower'] as const)
        for (const h of [0, 40, 100, 1000]) {
          const b = building(type, shape, h),
            v = hall(b),
            plan = civicHallPlan(b, v);
          for (const [i, q] of plan.tiers.entries()) {
            expect(q.w).toBeGreaterThan(0);
            expect(q.d).toBeGreaterThan(0);
            expect(q.h).toBeGreaterThan(0);
            expect(q.x).toBeGreaterThanOrEqual(v.x - 1e-8);
            expect(q.y).toBeGreaterThanOrEqual(v.y - 1e-8);
            expect(q.z).toBeGreaterThanOrEqual(v.z - 1e-8);
            expect(q.x + q.w).toBeLessThanOrEqual(v.x + v.w + 1e-8);
            expect(q.y + q.d).toBeLessThanOrEqual(v.y + v.d + 1e-8);
            expect(q.z + q.h).toBeLessThanOrEqual(v.z + v.h + 1e-8);
            if (i) {
              const below = plan.tiers[i - 1]!;
              expect(q.z).toBeCloseTo(below.z + below.h);
              expect(q.x).toBeGreaterThanOrEqual(below.x - 1e-8);
              expect(q.y).toBeGreaterThanOrEqual(below.y - 1e-8);
              expect(q.x + q.w).toBeLessThanOrEqual(below.x + below.w + 1e-8);
              expect(q.y + q.d).toBeLessThanOrEqual(below.y + below.d + 1e-8);
            }
          }
          const s = plan.screen;
          for (let i = 0; i <= 20; i++) {
            const z = s.z + (s.height * i) / 20;
            expect(
              plan.tiers.some(
                (q) =>
                  Math.abs(q.x + q.w - s.x) < 1e-8 &&
                  z >= q.z - 1e-8 &&
                  z <= q.z + q.h + 1e-8 &&
                  s.y >= q.y &&
                  s.y + s.width <= q.y + q.d + 1e-8,
              ),
              `${type}/${shape}/${h} screen at ${z}`,
            ).toBe(true);
          }
        }
  });
  it('separates tall shaft, apartment terraces and low shop architecture', () => {
    const sky = building('skyscraper'),
      home = building('residential'),
      shop = building('shop');
    expect(civicHallPlan(sky, hall(sky)).tiers).toHaveLength(4);
    expect(civicHallPlan(home, hall(home)).tiers).toHaveLength(3);
    expect(hall(sky).h).toBeGreaterThan(hall(home).h * 1.5);
    expect(hall(shop).h).toBeLessThanOrEqual(5.5);
    expect(civicHallPlan(home, hall(home))).toEqual(
      civicHallPlan({ ...home, x: 77, y: -20 }, hall(home)),
    );
  });
  it('reuses static images and calls the live advert between them; honors screen and balcony toggles', () => {
    const calls: unknown[][] = [];
    const target = new Proxy(
      { drawImage: (...args: unknown[]) => calls.push(['image', ...args]) },
      {
        get: (o, k) =>
          k in o
            ? o[k as keyof typeof o]
            : (...args: unknown[]) => calls.push([String(k), ...args]),
        set: () => true,
      },
    );
    let allocated = 0;
    vi.stubGlobal(
      'OffscreenCanvas',
      class {
        width: number;
        height: number;
        constructor(w: number, h: number) {
          this.width = w;
          this.height = h;
          allocated++;
        }
        getContext() {
          return target;
        }
      },
    );
    const draw = createCivicHallRenderer(
        target as unknown as CanvasRenderingContext2D,
        palette,
      ),
      b = building('residential'),
      v = hall(b);
    const display = vi.fn(() => calls.push(['display']));
    draw(b, v, true, 2, display);
    const previous = calls.length;
    draw(b, v, true, 2, display);
    expect(allocated).toBe(2);
    expect(display).toHaveBeenCalledTimes(2);
    expect(calls.slice(previous).map((c) => c[0])).toEqual([
      'image',
      'display',
      'image',
    ]);
    b.design = { ...b.design!, display: 'none', balcony: false };
    draw(b, v, true, 2, display);
    expect(allocated).toBe(4);
    expect(display).toHaveBeenCalledTimes(2);
    expect(civicHallPlan(b, v).balcony).toBe(false);
    b.adImage = 'local-upload';
    draw(b, v, true, 2, display);
    expect(display).toHaveBeenCalledTimes(3);
    draw(b, v, false, 2, display);
    expect(allocated).toBe(8);
  });
});
