import type { Palette } from '../palette';
import type { RenderFrame } from './view-model';
import { createStreetPainter } from './streets';
import { createGeometry, iso } from './geometry';

function createTerrainPainter(ctx: CanvasRenderingContext2D, p: Palette) {
  const { polygon, glow } = createGeometry(ctx, p);
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
      // One continuous ground material; tile boundaries are an optional tool,
      // not a repeated pedestal beneath every structure and street fixture.
      polygon(
        [a, b, c, d],
        street ? p.road : p.ground,
        grid ? p.edge : undefined,
      );
      if (exposure) {
        glow(iso(x + 0.5, y + 0.5), p.soot, 32, Math.min(0.3, exposure * 0.03));
      }
      if (street) streetsPainter.road(street);
    }
    // Soft operating light only; no repeated polygon shadow pads beneath assets.
    for (const b of buildings.values()) {
      if (net.get(b)?.active)
        glow(
          iso(b.x + 0.5, b.y + 0.75),
          b.type === 'factory'
            ? p.production
            : b.type === 'power'
              ? p.power
              : b.type === 'warehouse' || b.type === 'skyscraper'
                ? p.materials
                : b.type === 'shop'
                  ? p.production
                  : p.power,
          28,
          0.16,
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
    if (frame.W <= 0 || frame.H <= 0) return;
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
