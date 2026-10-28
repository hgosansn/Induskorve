import type { Palette } from '../palette';
import type { RenderFrame } from './view-model';
import { createGeometry, iso } from './geometry';

export function createTerrainRenderer(
  ctx: CanvasRenderingContext2D,
  p: Palette,
) {
  const { polygon, line, glow } = createGeometry(ctx, p);
  return ({ terrain, buildings, net, grid, study }: RenderFrame) => {
    for (const { x, y, exposure } of [...terrain.values()].sort(
      (a, b) => a.x + a.y - b.x - b.y,
    )) {
      const a = iso(x, y),
        b = iso(x + 1, y),
        c = iso(x + 1, y + 1),
        d = iso(x, y + 1);
      const street =
        (x % 4 === 0 || y % 4 === 0) && !buildings.has(`${x},${y}`) && !study;
      const noise = Math.abs(Math.sin(x * 127.1 + y * 311.7));
      // Cut edges reveal an engineered ground slab; interior cells merge visually.
      if (!terrain.has(`${x + 1},${y}`))
        polygon(
          [b, c, iso(x + 1, y + 1, -7), iso(x + 1, y, -7)],
          p.ink,
          p.surface,
        );
      if (!terrain.has(`${x},${y + 1}`))
        polygon(
          [d, c, iso(x + 1, y + 1, -7), iso(x, y + 1, -7)],
          p.surface,
          p.edge,
        );
      polygon(
        [a, b, c, d],
        street ? p.road : noise > 0.5 ? p.ground : p['ground-alt'],
        grid ? p.edge : undefined,
      );
      if (exposure) {
        ctx.save();
        ctx.globalAlpha = Math.min(0.45, exposure * 0.045);
        polygon([a, b, c, d], p.soot);
        ctx.restore();
      }
      if (street) {
        const horizontal = y % 4 === 0;
        if (horizontal) {
          for (const offset of [0.28, 0.72])
            line(iso(x, y + offset), iso(x + 1, y + offset), p.steel, 0.45);
          line(
            iso(x + 0.15, y + 0.5),
            iso(x + 0.38, y + 0.5),
            p['concrete-shadow'],
            0.6,
          );
        } else {
          for (const offset of [0.28, 0.72])
            line(iso(x + offset, y), iso(x + offset, y + 1), p.steel, 0.45);
          line(
            iso(x + 0.5, y + 0.15),
            iso(x + 0.5, y + 0.38),
            p['concrete-shadow'],
            0.6,
          );
        }
      }
      // A seam and two fixing points add scale without outlining every grid cell.
      if (noise > 0.75 && !street)
        line(iso(x + 0.08, y + 0.1), iso(x + 0.8, y + 0.1), p.surface, 0.5);
      if (!terrain.has(`${x},${y + 1}`)) {
        line(
          iso(x + 0.12, y + 1, -2),
          iso(x + 0.32, y + 1, -2),
          p['concrete-shadow'],
          1,
        );
      }
    }
    // Grounded cast shadows precede structures. They never alter revealed tiles.
    for (const b of buildings.values()) {
      if (!study?.exploded) {
        const base = iso(b.x + 0.5, b.y + 0.7),
          length = b.h * 0.28;
        ctx.save();
        ctx.globalAlpha = 0.25;
        polygon(
          [
            [base[0] - 19, base[1]],
            [base[0] + 19, base[1]],
            [base[0] + length + 16, base[1] + length * 0.4],
            [base[0] + length - 16, base[1] + length * 0.4],
          ],
          p.ink,
        );
        ctx.restore();
      }
      if (net.get(b)?.active)
        glow(
          iso(b.x + 0.5, b.y + 0.75),
          b.type === 'factory'
            ? p.production
            : b.type === 'power'
              ? p.power
              : p.materials,
          24,
          0.1,
        );
    }
  };
}
