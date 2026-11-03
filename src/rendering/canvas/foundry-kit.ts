import catalog from '../assets/foundry-kit-01/catalog.json';
import {
  paintReusablePart,
  readyReusablePart,
  type ReusablePart,
} from '../assets/sprite-runtime';
import { assemblyDimensions } from '../assembly/mounts';
import type { AssemblyPart, Route } from '../assembly/model';
import type { RenderBuilding } from './view-model';
import { iso } from './geometry';
import { readPalette } from '../palette';

export const foundryKit: readonly ReusablePart[] = catalog.parts;
const parts = new Map(foundryKit.map((part) => [part.id, part]));

function paint(
  ctx: CanvasRenderingContext2D,
  id: string,
  position: [number, number, number],
  scale = 1,
) {
  const part = parts.get(id)!;
  if (!part) return false;
  const image = readyReusablePart(part);
  if (!image) return false;
  ctx.save();
  // Native origin translation precedes uniform fitting of a panel variant.
  ctx.translate(
    (position[0] - position[1]) * 2.25,
    (position[0] + position[1]) * 1.125 - position[2] * 3,
  );
  ctx.scale(scale, scale);
  paintReusablePart(ctx, part, image, [0, 0, 0]);
  ctx.restore();
  return true;
}

export function paintFoundryKitPart(
  ctx: CanvasRenderingContext2D,
  part: AssemblyPart,
  b: RenderBuilding,
  active: boolean,
) {
  const v = part.volume;
  const at: [number, number, number] = [b.x * 12 + v.x, b.y * 12 + v.y, v.z];
  if (part.id === 'grid') return paint(ctx, 'city-grid', at);
  if (part.id === 'terminal') {
    if (!paint(ctx, 'city-terminal', at)) return false;
    const p = readPalette();
    const a = iso(
      (at[0] + 0.17) / 12,
      (at[1] + 0.572) / 12,
      (at[2] + 0.86) * 3,
    );
    const b = iso(
      (at[0] + 0.39) / 12,
      (at[1] + 0.572) / 12,
      (at[2] + 0.86) * 3,
    );
    ctx.beginPath();
    ctx.moveTo(...a);
    ctx.lineTo(...b);
    ctx.strokeStyle = active ? p.materials : p.ink;
    ctx.lineWidth = 0.17;
    ctx.stroke();
    return true;
  }
  if (part.id === 'roof-hatch')
    return paint(ctx, 'city-hatch', [
      at[0] + (v.w - 0.7) / 2,
      at[1] + (v.d - 1.1) / 2,
      at[2],
    ]);
  if (part.id === 'exhaust-plenum') return paint(ctx, 'city-plenum', at);
  if (part.id === 'exhaust-stand') return paint(ctx, 'city-saddle', at);
  if (part.id === 'second-furnace') {
    if (!paint(ctx, 'city-furnace', at)) return false;
    if (active) {
      const p = readPalette();
      for (const [x0, x1, z0, z1, color] of [
        [0.61, 1.69, 0.87, 1.34, p.production],
        [0.67, 1.63, 0.98, 1.08, p['concrete-light']],
      ] as const) {
        ctx.beginPath();
        for (const [i, [x, z]] of [
          [x0, z0],
          [x1, z0],
          [x1, z1],
          [x0, z1],
        ].entries()) {
          const pt = iso(
            (at[0] + x!) / 12,
            (at[1] + 2.3) / 12,
            (at[2] + z!) * 3,
          );
          if (i) ctx.lineTo(...pt);
          else ctx.moveTo(...pt);
        }
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
      }
    }
    return true;
  }
  return false;
}

export function paintFoundryLouver(
  ctx: CanvasRenderingContext2D,
  part: AssemblyPart,
  b: RenderBuilding,
) {
  const v = part.volume;
  return paint(
    ctx,
    'louver-side',
    [
      b.x * 12 + v.x + v.w - 0.17 * 1.4 - 0.12,
      b.y * 12 + v.y + 0.42,
      v.z + 0.75,
    ],
    1.4,
  );
}

export function paintFoundryKitRoute(
  ctx: CanvasRenderingContext2D,
  route: Route,
  b: RenderBuilding,
) {
  const { equipmentX, floor } = assemblyDimensions(b);
  return paint(ctx, `route-${route.id}`, [
    b.x * 12 + equipmentX,
    b.y * 12,
    floor,
  ]);
}
