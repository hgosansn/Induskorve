import type { Palette } from '../palette';
import type { RenderFrame } from './view-model';
import { createStreetPainter } from './streets';
import { createGeometry, iso } from './geometry';

function createTerrainPainter(ctx: CanvasRenderingContext2D, p: Palette) {
  const { polygon, line, glow } = createGeometry(ctx, p);
  const streetsPainter = createStreetPainter(ctx, p);
  return ({ terrain, buildings, net, grid, study, streets }: RenderFrame) => {
    for (const { x, y, exposure } of [...terrain.values()].sort(
      (a, b) => a.x + a.y - b.x - b.y,
    )) {
      const a = iso(x, y),
        b = iso(x + 1, y),
        c = iso(x + 1, y + 1),
        d = iso(x, y + 1);
      const street = !study ? streets.roads.get(`${x},${y}`) : undefined;
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
      if (street) streetsPainter.road(street);
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
    if (!study) streetsPainter.paths(streets);
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
    if (!study) streetsPainter.lighting(streets);
  };
}

// Terrain, shadows and ground lighting change with topology/activity or camera, not time.
export function createTerrainRenderer(
  ctx: CanvasRenderingContext2D,
  p: Palette,
) {
  const surface = document.createElement('canvas');
  const target = surface.getContext('2d')!;
  const paint = createTerrainPainter(target, p);
  let previous: unknown[] = [];
  return (frame: RenderFrame) => {
    const keys = [
      frame.W,
      frame.H,
      frame.dpr,
      frame.zoom,
      frame.panX,
      frame.panY,
      frame.terrain,
      frame.buildings,
      frame.net,
      frame.grid,
      frame.study?.exploded,
    ];
    if (keys.some((key, i) => key !== previous[i])) {
      previous = keys;
      surface.width = Math.round(frame.W * frame.dpr);
      surface.height = Math.round(frame.H * frame.dpr);
      target.setTransform(frame.dpr, 0, 0, frame.dpr, 0, 0);
      target.translate(
        frame.W * 0.53 + frame.panX,
        frame.H * 0.53 + frame.panY,
      );
      target.scale(frame.zoom, frame.zoom);
      paint(frame);
    }
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(surface, 0, 0);
    ctx.restore();
  };
}
