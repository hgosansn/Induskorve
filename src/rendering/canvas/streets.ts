import type { StreetTile, StreetLayout } from '../../domain/city/streets';
import type { Palette } from '../palette';
import { createGeometry, iso } from './geometry';
import {
  streetHash,
  streetScenery,
  type LampFixture,
  type StreetProp,
} from './street-scenery';

export function createStreetPainter(ctx: CanvasRenderingContext2D, p: Palette) {
  const { polygon, line } = createGeometry(ctx, p);
  const pool = document.createElement('canvas');
  pool.width = 144;
  pool.height = 72;
  const lightContext = pool.getContext('2d')!;
  lightContext.scale(3, 3);
  lightContext.translate(24, 12);
  lightContext.scale(1, 0.5);
  const light = lightContext.createRadialGradient(0, 0, 0, 0, 0, 24);
  light.addColorStop(0, p.power + '88');
  light.addColorStop(0.45, p.power + '30');
  light.addColorStop(1, p.power + '00');
  lightContext.fillStyle = light;
  lightContext.fillRect(-24, -24, 48, 48);
  function road(tile: StreetTile) {
    const { x, y, arms, crossings } = tile;
    const rect = (u: number, v: number, w: number, d: number, color: string) =>
      polygon(
        [
          iso(x + u, y + v),
          iso(x + u + w, y + v),
          iso(x + u + w, y + v + d),
          iso(x + u, y + v + d),
        ],
        color,
      );
    rect(0, 0, 1, 1, p.steel);
    // A 3x3 surface stencil leaves curbs only where asphalt meets pavement.
    const cuts = [0, 0.23, 0.77, 1];
    const asphalt = (i: number, j: number) =>
      (i === 1 && j === 1) ||
      (i === 1 && j === 0 && arms[0]) ||
      (i === 2 && j === 1 && arms[1]) ||
      (i === 1 && j === 2 && arms[2]) ||
      (i === 0 && j === 1 && arms[3]);
    for (let j = 0; j < 3; j++)
      for (let i = 0; i < 3; i++)
        if (asphalt(i, j)) {
          const u = cuts[i]!,
            v = cuts[j]!,
            w = cuts[i + 1]! - u,
            d = cuts[j + 1]! - v;
          rect(u, v, w, d, p.road);
          if (j > 0 && !asphalt(i, j - 1))
            line(
              iso(x + u, y + v),
              iso(x + u + w, y + v),
              p['concrete-shadow'],
              0.65,
            );
          if (i < 2 && !asphalt(i + 1, j))
            line(
              iso(x + u + w, y + v),
              iso(x + u + w, y + v + d),
              p['concrete-shadow'],
              0.65,
            );
          if (j < 2 && !asphalt(i, j + 1))
            line(
              iso(x + u, y + v + d),
              iso(x + u + w, y + v + d),
              p['concrete-shadow'],
              0.65,
            );
          if (i > 0 && !asphalt(i - 1, j))
            line(
              iso(x + u, y + v),
              iso(x + u, y + v + d),
              p['concrete-shadow'],
              0.65,
            );
        }
    // Stripe bands align with the graph's four designated crossing edges.
    crossings.forEach((cross, i) => {
      if (!cross) return;
      for (let k = 0; k < 6; k++) {
        const s = 0.255 + k * 0.083;
        if (i === 0 || i === 2)
          rect(s, i === 0 ? 0.065 : 0.825, 0.045, 0.11, p.concrete);
        else rect(i === 3 ? 0.065 : 0.825, s, 0.11, 0.045, p.concrete);
      }
    });
    const straight = arms.filter(Boolean).length === 2 && arms[0] === arms[2];
    if (straight) {
      if (arms[1])
        line(
          iso(x + 0.35, y + 0.5),
          iso(x + 0.65, y + 0.5),
          p['concrete-shadow'],
          0.55,
        );
      else
        line(
          iso(x + 0.5, y + 0.35),
          iso(x + 0.5, y + 0.65),
          p['concrete-shadow'],
          0.55,
        );
    }
    const seed = streetHash(x, y, 13);
    if (seed % 5 === 0) {
      // Flush service cover, not a navigation obstacle or a raised plaza prop.
      polygon(
        Array.from({ length: 12 }, (_, i) =>
          iso(
            x + 0.5 + Math.cos((i * Math.PI) / 6) * 0.075,
            y + 0.5 + Math.sin((i * Math.PI) / 6) * 0.075,
          ),
        ),
        p.ink,
        p.edge,
      );
      for (const off of [-0.03, 0, 0.03])
        line(
          iso(x + 0.455, y + 0.5 + off),
          iso(x + 0.545, y + 0.5 + off),
          p.surface,
          0.22,
        );
    } else if (seed % 7 === 0) {
      rect(0.4, 0.43, 0.2, 0.14, p.surface);
      line(iso(x + 0.41, y + 0.45), iso(x + 0.57, y + 0.45), p.edge, 0.2);
    }
  }
  function lighting(layout: StreetLayout) {
    for (const lamp of streetScenery(layout).lamps)
      for (const head of lamp.heads) {
        const at = iso(lamp.x + head.x, lamp.y + head.y),
          scale =
            lamp.kind === 'capped' ? 0.65 : lamp.kind === 'twin' ? 0.85 : 1;
        ctx.drawImage(
          pool,
          at[0] - 24 * scale,
          at[1] - 12 * scale,
          48 * scale,
          24 * scale,
        );
      }
  }
  return { road, lighting };
}

// Static luminous fixtures are rasterized once; no per-lamp gradients per frame.
export function createStreetLampRenderer(
  ctx: CanvasRenderingContext2D,
  p: Palette,
) {
  const cache = new Map<string, HTMLCanvasElement>();
  const draw = (lamp: LampFixture) => {
    const key = `${lamp.kind}/${lamp.heads.map((h) => `${h.x},${h.y}`).join('/')}`;
    let image = cache.get(key);
    if (!image) {
      image = document.createElement('canvas');
      image.width = 144;
      image.height = 144;
      const target = image.getContext('2d')!;
      target.scale(3, 3);
      target.translate(24, 28);
      const g = createGeometry(target, p),
        height = lamp.height;
      g.box(-0.022, -0.022, 0.044, 0.044, 0, 0.45, g.dark);
      g.box(-0.009, -0.009, 0.018, 0.018, 0.45, height - 0.45, g.steel);
      for (const head of lamp.heads) {
        g.line(
          iso(0, 0, height - 0.7),
          iso(head.x, head.y, height),
          p.ink,
          1.0,
        );
        g.line(
          iso(0, 0, height - 0.65),
          iso(head.x, head.y, height),
          p['concrete-shadow'],
          0.45,
        );
        if (lamp.kind === 'capped') {
          g.box(-0.045, -0.045, 0.09, 0.09, height - 0.9, 0.6, g.dark);
          g.line(
            iso(-0.03, 0.04, height - 0.45),
            iso(0.03, 0.04, height - 0.45),
            p['concrete-light'],
            0.7,
          );
        } else {
          g.box(
            head.x - 0.035,
            head.y - 0.025,
            0.07,
            0.05,
            height - 0.65,
            0.5,
            g.dark,
          );
          g.line(
            iso(head.x - 0.025, head.y + 0.023, height - 0.62),
            iso(head.x + 0.025, head.y + 0.023, height - 0.62),
            p['concrete-light'],
            0.7,
          );
        }
        g.glow(iso(head.x, head.y, height - 0.45), p.power, 4, 0.18);
      }
      cache.set(key, image);
    }
    const at = iso(lamp.x, lamp.y);
    ctx.drawImage(image, at[0] - 24, at[1] - 28, 48, 48);
  };
  return Object.assign(draw, {
    stats: () => ({
      sprites: cache.size,
      rgbaBytes: cache.size * 144 * 144 * 4,
    }),
  });
}

export function createStreetPropRenderer(
  ctx: CanvasRenderingContext2D,
  p: Palette,
) {
  const cache = new Map<string, HTMLCanvasElement>();
  const draw = (prop: StreetProp) => {
    const key = `${prop.kind}/${prop.kind === 'route-post' && (prop.corner === 1 || prop.corner === 3) ? 1 : 0}`;
    let image = cache.get(key);
    if (!image) {
      image = document.createElement('canvas');
      image.width = 96;
      image.height = 96;
      const target = image.getContext('2d')!;
      target.scale(3, 3);
      target.translate(16, 20);
      const g = createGeometry(target, p);
      if (prop.kind === 'cabinet') {
        g.box(-0.022, -0.022, 0.044, 0.044, 0, 0.35, g.concrete);
        g.box(-0.019, -0.019, 0.038, 0.038, 0.35, 3.8, g.steel);
        g.line(iso(-0.012, 0.02, 0.8), iso(-0.012, 0.02, 3.65), p.ink, 0.17);
        g.line(
          iso(0.004, 0.021, 2.4),
          iso(0.012, 0.021, 2.4),
          p.concrete,
          0.25,
        );
        g.line(iso(-0.013, 0.021, 3.3), iso(0.013, 0.021, 3.3), p.edge, 0.18);
      } else if (prop.kind === 'bollard') {
        g.box(-0.016, -0.016, 0.032, 0.032, 0, 0.24, g.dark);
        g.box(-0.009, -0.009, 0.018, 0.018, 0.24, 2.2, g.steel);
        g.box(-0.01, -0.01, 0.02, 0.02, 1.85, 0.25, g.concrete);
      } else {
        g.box(-0.014, -0.014, 0.028, 0.028, 0, 0.25, g.dark);
        g.box(-0.006, -0.006, 0.012, 0.012, 0.25, 10.2, g.steel);
        const mirrored = prop.corner === 1 || prop.corner === 3;
        g.box(
          mirrored ? -0.01 : -0.065,
          mirrored ? -0.065 : -0.01,
          mirrored ? 0.02 : 0.13,
          mirrored ? 0.13 : 0.02,
          9,
          1.5,
          g.dark,
        );
        g.line(
          iso(mirrored ? 0.012 : -0.05, mirrored ? -0.05 : 0.012, 9.75),
          iso(mirrored ? 0.012 : 0.05, mirrored ? 0.05 : 0.012, 9.75),
          p.concrete,
          0.35,
        );
      }
      cache.set(key, image);
    }
    const at = iso(prop.x, prop.y);
    ctx.drawImage(image, at[0] - 16, at[1] - 20, 32, 32);
  };
  return Object.assign(draw, {
    stats: () => ({ sprites: cache.size, rgbaBytes: cache.size * 96 * 96 * 4 }),
  });
}
