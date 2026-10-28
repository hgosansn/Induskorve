import type { StreetTile, StreetLayout } from '../../domain/city/streets';
import type { Position } from '../../domain/city/model';
import type { Palette } from '../palette';
import { createGeometry, iso } from './geometry';

export function createStreetPainter(ctx: CanvasRenderingContext2D, p: Palette) {
  const { polygon, line } = createGeometry(ctx, p);
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
  }
  function paths(layout: StreetLayout) {
    ctx.save();
    ctx.globalAlpha = 0.48;
    for (const edge of layout.edges)
      if (edge.kind === 'plot') {
        const a = layout.nodes.get(edge.a)!,
          b = layout.nodes.get(edge.b)!;
        line(iso(a.x, a.y), iso(b.x, b.y), p.steel, 1.7);
      }
    ctx.restore();
  }
  function lighting(layout: StreetLayout) {
    for (const lamp of layout.lamps) {
      const at = iso(lamp.x + 0.3, lamp.y + 0.3);
      ctx.save();
      ctx.translate(...at);
      ctx.scale(1, 0.5);
      const light = ctx.createRadialGradient(0, 0, 0, 0, 0, 24);
      light.addColorStop(0, p.power + '70');
      light.addColorStop(0.45, p.power + '26');
      light.addColorStop(1, p.power + '00');
      ctx.fillStyle = light;
      ctx.fillRect(-24, -24, 48, 48);
      ctx.restore();
    }
  }
  return { road, paths, lighting };
}

// Static luminous fixtures are rasterized once; no per-lamp gradients per frame.
export function createStreetLampRenderer(
  ctx: CanvasRenderingContext2D,
  p: Palette,
) {
  const image = document.createElement('canvas');
  image.width = 144;
  image.height = 144;
  const target = image.getContext('2d')!;
  target.scale(3, 3);
  target.translate(24, 28);
  const { line, glow } = createGeometry(target, p);
  line(iso(0, 0), iso(0, 0, 18), p.ink, 1.8);
  line(iso(0.015, 0, 1), iso(0.015, 0, 18), p['concrete-shadow'], 0.7);
  line(iso(0, 0, 18), iso(0.3, 0.3, 18), p.steel, 1.6);
  glow(iso(0.3, 0.3, 18), p.power, 6, 0.25);
  line(iso(0.23, 0.23, 18), iso(0.37, 0.37, 18), p['concrete-light'], 1.3);
  return (position: Position) => {
    const at = iso(position.x, position.y);
    ctx.drawImage(image, at[0] - 24, at[1] - 28, 48, 48);
  };
}
