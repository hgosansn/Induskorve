import {
  KIT_SIZE,
  KIT_Z,
  type FacadeSurface,
  type Volume,
} from '../assembly/model';
import type { Palette } from '../palette';
import type { RenderBuilding } from './view-model';
import { iso } from './geometry';

type CivicKind = 'residential' | 'skyscraper' | 'shop';
type Point = [number, number, number];
type PaintContext =
  CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/** Occupied tiers, not an engineering or collision certificate. */
export function civicHallPlan(b: RenderBuilding, v: Volume) {
  const kind = b.type as CivicKind;
  const shape =
    b.design?.shape ??
    (b.variant < 0.34 ? 'block' : b.variant < 0.68 ? 'stepped' : 'tower');
  const balcony = b.design?.balcony ?? true;
  const tiers: Volume[] = [];
  if (kind === 'skyscraper') {
    const podium = Math.min(3.2, v.h * 0.16);
    tiers.push({ ...v, h: podium });
    const width =
      v.w * (shape === 'tower' ? 0.61 : shape === 'block' ? 0.85 : 0.74);
    const depth = v.d * 0.77;
    const shaft = {
      x: v.x + (v.w - width) / 2,
      y: v.y + (v.d - depth) / 2,
      z: v.z + podium,
      w: width,
      d: depth,
      h: (v.h - podium) * 0.77,
    };
    tiers.push(shaft);
    let top = shaft;
    for (const fraction of [0.65, 0.35]) {
      const inset = Math.min(top.w, top.d) * 0.11;
      top = {
        x: top.x + inset,
        y: top.y + inset,
        z: top.z + top.h,
        w: top.w - 2 * inset,
        d: top.d - 2 * inset,
        h: (v.h - podium) * 0.23 * fraction,
      };
      tiers.push(top);
    }
  } else if (kind === 'shop') {
    const reserve = balcony ? 0.65 : 0.12;
    tiers.push({
      ...v,
      d: v.d - reserve,
      h: v.h * (shape === 'stepped' ? 0.77 : 0.91),
    });
    const base = tiers[0]!;
    tiers.push({
      x: base.x + (shape === 'tower' ? base.w * 0.32 : 0.12),
      y: base.y + 0.12,
      z: base.z + base.h,
      w: base.w - (shape === 'tower' ? base.w * 0.32 : 0.24),
      d: base.d * 0.67,
      h: v.h - base.h,
    });
  } else {
    const reserve = balcony ? 0.55 : 0.12;
    const count = shape === 'stepped' ? 3 : shape === 'tower' ? 2 : 1;
    for (let i = 0; i < count; i++) {
      const inset = i * v.w * (shape === 'tower' ? 0.14 : 0.11);
      tiers.push({
        x: v.x + inset,
        y: v.y,
        z: v.z + (v.h * i) / count,
        w: v.w - inset,
        d: v.d - reserve,
        h: v.h / count,
      });
    }
  }
  const wall = tiers[kind === 'skyscraper' ? 1 : 0]!;
  // Positive-X face; texture width runs along Y. Keep the rectangle wholly on
  // one real tier, never stretched across a setback or open terrace.
  const screen: FacadeSurface = {
    x: wall.x + wall.w,
    y: wall.y + wall.d * 0.08,
    z: wall.z + wall.h * 0.12,
    width: wall.d * 0.84,
    height: wall.h * 0.77,
  };
  if (kind === 'residential') {
    screen.z = v.z + v.h * 0.12;
    screen.height = v.h * 0.76;
  }
  return { kind, shape, balcony, tiers, screen };
}

export function createCivicHallRenderer(
  ctx: CanvasRenderingContext2D,
  p: Palette,
) {
  type Tile = {
    back: OffscreenCanvas;
    front: OffscreenCanvas;
    left: number;
    top: number;
    resolution: number;
    key: string;
  };
  const cache = new WeakMap<RenderBuilding, Tile>();
  return (
    b: RenderBuilding,
    v: Volume,
    active: boolean,
    zoom: number,
    display?: (surface: FacadeSurface) => void,
  ) => {
    const plan = civicHallPlan(b, v);
    const hasDisplay =
      !!display && (b.design?.display === 'animated' || !!b.adImage);
    const resolution = Math.max(2, Math.min(8, Math.ceil(zoom * 1.5)));
    const key = JSON.stringify([
      plan,
      active,
      resolution,
      hasDisplay,
      b.variant,
    ]);
    let tile = cache.get(b);
    if (!tile || tile.key !== key) {
      const project = ([x, y, z]: Point) =>
        iso(x / KIT_SIZE, y / KIT_SIZE, z * KIT_Z);
      const corners = [v.x, v.x + v.w].flatMap((x) =>
        [v.y, v.y + v.d].flatMap((y) =>
          [v.z, v.z + v.h].map((z) => project([x, y, z])),
        ),
      );
      const left = Math.floor(Math.min(...corners.map((q) => q[0]))) - 2;
      const top = Math.floor(Math.min(...corners.map((q) => q[1]))) - 2;
      const width = Math.ceil(Math.max(...corners.map((q) => q[0])) - left) + 2;
      const height = Math.ceil(Math.max(...corners.map((q) => q[1])) - top) + 2;
      const canvas = () =>
        new OffscreenCanvas(width * resolution, height * resolution);
      const back = canvas(),
        front = canvas();
      const backCtx = back.getContext('2d')!,
        frontCtx = front.getContext('2d')!;
      for (const target of [backCtx, frontCtx]) {
        target.scale(resolution, resolution);
        target.translate(-left, -top);
      }
      const polygon = (
        target: PaintContext,
        points: Point[],
        color: string,
        alpha = 1,
      ) => {
        target.save();
        target.globalAlpha = alpha;
        target.fillStyle = color;
        target.beginPath();
        points.forEach((q, i) => {
          const s = project(q);
          if (i) target.lineTo(...s);
          else target.moveTo(...s);
        });
        target.closePath();
        target.fill();
        target.restore();
      };
      const line = (
        target: PaintContext,
        a: Point,
        c: Point,
        color = p.steel,
        weight = 0.22,
      ) => {
        target.strokeStyle = color;
        target.lineWidth = weight;
        target.beginPath();
        target.moveTo(...project(a));
        target.lineTo(...project(c));
        target.stroke();
      };
      const box = (
        target: PaintContext,
        q: Volume,
        light = p['concrete-shadow'],
        dark = p.steel,
        topColor = p.concrete,
      ) => {
        const { x, y, z, w, d, h } = q;
        polygon(
          target,
          [
            [x, y + d, z],
            [x + w, y + d, z],
            [x + w, y + d, z + h],
            [x, y + d, z + h],
          ],
          light,
        );
        polygon(
          target,
          [
            [x + w, y, z],
            [x + w, y + d, z],
            [x + w, y + d, z + h],
            [x + w, y, z + h],
          ],
          dark,
        );
        polygon(
          target,
          [
            [x, y, z + h],
            [x + w, y, z + h],
            [x + w, y + d, z + h],
            [x, y + d, z + h],
          ],
          topColor,
        );
      };
      const seed = Math.floor(b.variant * 100000);
      const lit = (floor: number, column: number, side: number) => {
        const hash =
          Math.sin(seed * 0.17 + floor * 47.1 + column * 13.7 + side * 81.3) *
          43758.5453;
        return active && hash - Math.floor(hash) > 0.43;
      };
      const window = (
        q: Volume,
        face: 'front' | 'right',
        u: number,
        z: number,
        w: number,
        h: number,
        on: boolean,
        commercial = false,
      ) => {
        // A dark opening, recessed glazing and four actual-depth reveals.
        // These are local XYZ surfaces, rather than a stroke around flat glass.
        const point = (a: number, b: number, depth = 0): Point =>
          face === 'front'
            ? [a, q.y + q.d - depth, b]
            : [q.x + q.w - depth, a, b];
        const depth = 0.16,
          rim = 0.075;
        polygon(
          backCtx,
          [point(u, z), point(u + w, z), point(u + w, z + h), point(u, z + h)],
          p.ink,
        );
        polygon(
          backCtx,
          [
            point(u + rim, z + rim, depth),
            point(u + w - rim, z + rim, depth),
            point(u + w - rim, z + h - rim, depth),
            point(u + rim, z + h - rim, depth),
          ],
          commercial
            ? p.surface
            : on
              ? [p.power, p.power, p.power, p.materials, p.production][
                  Math.abs(Math.floor(u * 7 + z * 3 + b.variant * 19)) % 5
                ]!
              : p.surface,
          commercial ? 0.8 : on ? 0.46 : 0.75,
        );
        polygon(
          backCtx,
          [
            point(u, z),
            point(u + rim, z + rim, depth),
            point(u + rim, z + h - rim, depth),
            point(u, z + h),
          ],
          p.soot,
        );
        polygon(
          backCtx,
          [
            point(u, z),
            point(u + w, z),
            point(u + w - rim, z + rim, depth),
            point(u + rim, z + rim, depth),
          ],
          p.concrete,
        );
        polygon(
          backCtx,
          [
            point(u + w, z),
            point(u + w, z + h),
            point(u + w - rim, z + h - rim, depth),
            point(u + w - rim, z + rim, depth),
          ],
          p['concrete-shadow'],
        );
        polygon(
          backCtx,
          [
            point(u, z + h),
            point(u + rim, z + h - rim, depth),
            point(u + w - rim, z + h - rim, depth),
            point(u + w, z + h),
          ],
          p.steel,
        );
        if (commercial) {
          for (const f of [0.28, 0.59])
            line(
              backCtx,
              point(u + 0.13, z + h * f, depth - 0.01),
              point(u + w - 0.13, z + h * f, depth - 0.01),
              on ? p.production : p.steel,
              0.22,
            );
          // Shelf stock silhouettes are broad, quiet interior cues, not exterior equipment.
          if (on)
            for (let c = 0; c < 3; c++)
              polygon(
                backCtx,
                [
                  point(u + w * (0.13 + c * 0.25), z + h * 0.31, depth - 0.02),
                  point(u + w * (0.28 + c * 0.25), z + h * 0.31, depth - 0.02),
                  point(u + w * (0.28 + c * 0.25), z + h * 0.48, depth - 0.02),
                  point(u + w * (0.13 + c * 0.25), z + h * 0.48, depth - 0.02),
                ],
                c % 2 ? p.concrete : p.materials,
                0.48,
              );
          line(
            backCtx,
            point(u, z + h * 0.8),
            point(u + w, z + h * 0.8),
            p.steel,
            0.28,
          );
        } else if (w > 1)
          line(
            backCtx,
            point(u + w * 0.52, z + 0.1, depth - 0.01),
            point(u + w * 0.52, z + h - 0.1, depth - 0.01),
            p.steel,
            0.17,
          );
      };
      // The full footprint bears on its foundation, including the recessed porch.
      box(backCtx, { ...v, h: 0.1 }, p.steel, p.soot, p['concrete-shadow']);
      plan.tiers.forEach((q, tier) => {
        box(
          backCtx,
          { ...q, h: q.h - 0.18 },
          plan.kind === 'skyscraper' ? p.steel : p['concrete-shadow'],
          p.steel,
          p.concrete,
        );
        const floorHeight = plan.kind === 'shop' ? 2.8 : 2.4;
        const floors =
          q.h < (plan.kind === 'shop' ? 1.2 : 0.8)
            ? 0
            : Math.max(1, Math.floor(q.h / floorHeight));
        const step = q.h / Math.max(1, floors);
        for (let f = 0; f < floors; f++) {
          const z = q.z + f * step + step * 0.22;
          const commercial = plan.kind === 'skyscraper' && tier === 0;
          const frontColumns = Math.max(
            2,
            Math.floor(q.w / (plan.kind === 'residential' ? 1.9 : 1.7)),
          );
          const rightColumns = Math.max(2, Math.floor(q.d / 1.6));
          if (!(plan.kind === 'shop' && tier === 0))
            for (let c = 0; c < frontColumns; c++) {
              const cell = q.w / frontColumns;
              window(
                q,
                'front',
                q.x + cell * (c + 0.13),
                z,
                cell * 0.74,
                step * (commercial ? 0.68 : 0.56),
                lit(f + tier * 9, c, 0),
                commercial,
              );
            }
          if (!hasDisplay || tier !== (plan.kind === 'skyscraper' ? 1 : 0)) {
            // Residential screen spans coplanar right walls of all tiers.
            if (!(hasDisplay && plan.kind === 'residential'))
              for (let c = 0; c < rightColumns; c++) {
                const cell = q.d / rightColumns;
                window(
                  q,
                  'right',
                  q.y + cell * (c + 0.13),
                  z,
                  cell * 0.74,
                  step * (commercial ? 0.68 : 0.56),
                  lit(f + tier * 9, c, 1),
                  commercial || (plan.kind === 'shop' && tier === 0),
                );
              }
          }
          if (plan.kind === 'skyscraper') {
            // Recessed spandrels and continuous mullion piers create a curtain
            // wall rhythm; the podium below retains broad commercial glazing.
            box(
              backCtx,
              {
                x: q.x,
                y: q.y + q.d - 0.1,
                z: q.z + f * step,
                w: q.w,
                d: 0.1,
                h: 0.16,
              },
              p['concrete-shadow'],
              p.steel,
              p.concrete,
            );
            if (!hasDisplay || tier !== 1)
              box(
                backCtx,
                {
                  x: q.x + q.w - 0.1,
                  y: q.y,
                  z: q.z + f * step,
                  w: 0.1,
                  d: q.d,
                  h: 0.16,
                },
                p['concrete-shadow'],
                p.steel,
                p.concrete,
              );
            for (let c = 0; c <= frontColumns; c++) {
              const x = q.x + Math.min(q.w - 0.07, (c * q.w) / frontColumns);
              box(
                backCtx,
                {
                  x,
                  y: q.y + q.d - 0.12,
                  z: q.z + f * step,
                  w: 0.07,
                  d: 0.12,
                  h: step - 0.2,
                },
                p.concrete,
                p.steel,
                p['concrete-shadow'],
              );
            }
            line(
              backCtx,
              [q.x, q.y + q.d, q.z + f * step],
              [q.x + q.w, q.y + q.d, q.z + f * step],
              p['concrete-shadow'],
            );
            line(
              backCtx,
              [q.x + q.w, q.y, q.z + f * step],
              [q.x + q.w, q.y + q.d, q.z + f * step],
              p.steel,
            );
          }
          if (
            plan.kind === 'residential' &&
            plan.balcony &&
            q.z + f * step > v.z + 1
          ) {
            const slab = {
              x: q.x + 0.14,
              y: q.y + q.d,
              z: q.z + f * step,
              w: q.w - 0.28,
              d: Math.min(0.5, v.y + v.d - q.y - q.d),
              h: 0.15,
            };
            box(frontCtx, slab, p.steel, p.soot, p['concrete-shadow']);
            const railZ = slab.z + 0.72,
              railY = slab.y + slab.d;
            box(
              frontCtx,
              {
                x: slab.x,
                y: railY - 0.065,
                z: railZ,
                w: slab.w,
                d: 0.065,
                h: 0.065,
              },
              p.concrete,
              p.steel,
              p.concrete,
            );
            for (const x of [slab.x, slab.x + slab.w - 0.065])
              box(
                frontCtx,
                { x, y: slab.y, z: railZ, w: 0.065, d: slab.d, h: 0.065 },
                p.concrete,
                p.steel,
                p.concrete,
              );
            for (let c = 0; c <= 4; c++) {
              const x = slab.x + (c * (slab.w - 0.055)) / 4;
              box(
                frontCtx,
                {
                  x,
                  y: railY - 0.055,
                  z: slab.z + 0.15,
                  w: 0.055,
                  d: 0.055,
                  h: railZ - slab.z - 0.15,
                },
                p.steel,
                p['concrete-shadow'],
                p.concrete,
              );
            }
          }
        }
        // Recess the roof into its existing envelope. Four coping solids have
        // visible inner faces; none adds an unsupported rooftop storey.
        const roofZ = q.z + q.h - 0.18;
        polygon(
          backCtx,
          [
            [q.x + 0.14, q.y + 0.14, roofZ],
            [q.x + q.w - 0.14, q.y + 0.14, roofZ],
            [q.x + q.w - 0.14, q.y + q.d - 0.14, roofZ],
            [q.x + 0.14, q.y + q.d - 0.14, roofZ],
          ],
          p.surface,
        );
        for (const coping of [
          { x: q.x, y: q.y, z: roofZ, w: q.w, d: 0.14, h: 0.18 },
          { x: q.x, y: q.y + q.d - 0.14, z: roofZ, w: q.w, d: 0.14, h: 0.18 },
          { x: q.x, y: q.y + 0.14, z: roofZ, w: 0.14, d: q.d - 0.28, h: 0.18 },
          {
            x: q.x + q.w - 0.14,
            y: q.y + 0.14,
            z: roofZ,
            w: 0.14,
            d: q.d - 0.28,
            h: 0.18,
          },
        ])
          box(backCtx, coping, p['concrete-shadow'], p.steel, p.concrete);
        if (tier === plan.tiers.length - 1 && q.w > 1.8 && q.d > 1.8) {
          const hatch = {
            x: q.x + 0.35,
            y: q.y + 0.35,
            z: roofZ,
            w: Math.min(0.85, q.w * 0.28),
            d: Math.min(1.05, q.d * 0.31),
            h: 0.09,
          };
          box(backCtx, hatch, p.steel, p['concrete-shadow'], p.concrete);
          line(
            backCtx,
            [hatch.x + 0.12, hatch.y + 0.16, hatch.z + hatch.h],
            [hatch.x + hatch.w - 0.12, hatch.y + 0.16, hatch.z + hatch.h],
            p.steel,
            0.18,
          );
        }
      });
      const base = plan.tiers[0]!;
      const doorX = base.x + base.w * (plan.kind === 'shop' ? 0.81 : 0.47);
      const doorH = Math.min(2, base.h * 0.77),
        doorW = Math.min(0.95, base.w * 0.12);
      window(base, 'front', doorX, base.z + 0.1, doorW, doorH, false);
      line(
        backCtx,
        [doorX + doorW * 0.8, base.y + base.d, base.z + 0.8],
        [doorX + doorW * 0.8, base.y + base.d, base.z + 1.1],
        p.concrete,
      );
      if (plan.kind === 'shop') {
        const frontY = base.y + base.d;
        // Broad street-level shop glass; inactive shops visibly close shutters.
        for (let c = 0; c < 3; c++) {
          const x = base.x + 0.22 + c * base.w * 0.25,
            w = base.w * 0.22,
            h = base.h * 0.67;
          window(base, 'front', x, base.z + 0.2, w, h, active, true);
          if (!active)
            for (let z = base.z + 0.35; z < base.z + h; z += 0.22)
              line(
                backCtx,
                [x, frontY, z],
                [x + w, frontY, z],
                p['concrete-shadow'],
                0.16,
              );
        }
        if (plan.balcony) {
          const z = base.z + base.h * 0.83,
            reach = Math.min(0.6, v.y + v.d - frontY);
          for (let c = 0; c < 8; c++) {
            const x = base.x + (c * base.w) / 8;
            polygon(
              frontCtx,
              [
                [x, frontY, z],
                [x + base.w / 8, frontY, z],
                [x + base.w / 8, frontY + reach, z - 0.24],
                [x, frontY + reach, z - 0.24],
              ],
              c % 2 ? p.steel : p['concrete-shadow'],
            );
            polygon(
              frontCtx,
              [
                [x, frontY + reach, z - 0.24],
                [x + base.w / 8, frontY + reach, z - 0.24],
                [x + base.w / 8, frontY + reach, z - 0.36],
                [x, frontY + reach, z - 0.36],
              ],
              c % 2 ? p.steel : p.concrete,
            );
          }
          line(
            frontCtx,
            [base.x, frontY + reach, z - 0.24],
            [base.x + base.w, frontY + reach, z - 0.24],
            p.concrete,
            0.25,
          );
        }
        const names = [
          'NIGHT MARKET',
          'KORVE GOODS',
          'SHIFT CAFE',
          'CORNER STORE',
        ];
        const position = project([
          base.x + 0.25,
          frontY,
          base.z + base.h * 0.9,
        ]);
        backCtx.save();
        backCtx.translate(...position);
        backCtx.transform(1, 0.5, 0, 1, 0, 0);
        backCtx.fillStyle = p.concrete;
        backCtx.font = 'bold 1.4px monospace';
        backCtx.fillText(
          names[Math.abs(seed) % names.length]!,
          0,
          0,
          ((base.w * 27) / KIT_SIZE) * 0.86,
        );
        backCtx.restore();
      } else {
        // Recessed entrance surround and a shallow supported porch, not a roof box.
        const porchD = Math.min(0.35, v.y + v.d - base.y - base.d);
        if (porchD > 0)
          box(
            frontCtx,
            {
              x: doorX - 0.1,
              y: base.y + base.d,
              z: base.z + doorH,
              w: doorW + 0.2,
              d: porchD,
              h: 0.1,
            },
            p.steel,
            p.soot,
            p.concrete,
          );
      }
      if (hasDisplay) {
        const s = plan.screen;
        // The screen is a physically framed inset panel; animated pixels remain
        // outside this raster cache and retain the existing facade coordinates.
        const casing = {
          x: s.x - 0.09,
          y: s.y - 0.07,
          z: s.z - 0.07,
          w: 0.09,
          d: s.width + 0.14,
          h: s.height + 0.14,
        };
        box(backCtx, casing, p.steel, p.ink, p.concrete);
        line(
          backCtx,
          [s.x, s.y - 0.07, s.z - 0.07],
          [s.x, s.y + s.width + 0.07, s.z - 0.07],
          p['concrete-shadow'],
          0.3,
        );
      }
      tile = { back, front, left, top, resolution, key };
      cache.set(b, tile);
    }
    const origin = iso(b.x, b.y);
    const paint = (image: OffscreenCanvas) =>
      ctx.drawImage(
        image,
        origin[0] + tile.left,
        origin[1] + tile.top,
        image.width / tile.resolution,
        image.height / tile.resolution,
      );
    paint(tile.back);
    if (hasDisplay) display!(plan.screen);
    paint(tile.front);
  };
}
