import type { Palette } from '../palette';
import { createGeometry, iso, type Material } from './geometry';
import { KIT_SIZE, KIT_Z, volume, type Volume } from '../assembly/model';
import {
  composeFacade,
  type FacadeSurface,
  type HallFacade,
} from '../assembly/facade';
import type { RenderBuilding } from './view-model';

// Hall architecture is separate from machinery. All relief stays inside the hall envelope.
export function createHallRenderer(ctx: CanvasRenderingContext2D, p: Palette) {
  const g = createGeometry(ctx, p),
    cache = new WeakMap<RenderBuilding, HallFacade>();
  return (
    b: RenderBuilding,
    v: Volume,
    active: boolean,
    zoom: number,
    display?: (surface: FacadeSurface) => void,
  ) => {
    let f = cache.get(b);
    if (!f) {
      f = composeFacade(b, v);
      cache.set(b, f);
    }
    const accent =
      b.type === 'power'
        ? p.power
        : b.type === 'factory'
          ? p.production
          : p.materials;
    const fine = zoom > 1.3;
    const point = (x: number, y: number, z: number) =>
      iso(b.x + x / KIT_SIZE, b.y + y / KIT_SIZE, z * KIT_Z);
    const box = (q: Volume, m: Material = g.steel) =>
      g.box(
        b.x + q.x / KIT_SIZE,
        b.y + q.y / KIT_SIZE,
        q.w / KIT_SIZE,
        q.d / KIT_SIZE,
        q.z * KIT_Z,
        q.h * KIT_Z,
        m,
      );
    const line = (a: number[], c: number[], color = p.edge, width = 0.45) =>
      g.line(
        point(a[0]!, a[1]!, a[2]!),
        point(c[0]!, c[1]!, c[2]!),
        color,
        width,
      );
    const front = (
      x: number,
      y: number,
      z: number,
      w: number,
      h: number,
      color: string,
      edge?: string,
    ) =>
      g.polygon(
        [
          point(x, y, z),
          point(x + w, y, z),
          point(x + w, y, z + h),
          point(x, y, z + h),
        ],
        color,
        edge,
      );
    const right = (
      x: number,
      y: number,
      z: number,
      d: number,
      h: number,
      color: string,
      edge?: string,
    ) =>
      g.polygon(
        [
          point(x, y, z),
          point(x, y + d, z),
          point(x, y + d, z + h),
          point(x, y, z + h),
        ],
        color,
        edge,
      );
    for (const floor of f.floors) {
      const q = floor.body;
      box(q, b.type === 'factory' ? g.dark : g.steel);
      for (const bay of floor.bays) {
        const color = bay.glazing
          ? active && bay.lit
            ? p['concrete-light']
            : p.ink
          : [p.surface, p.steel, p['concrete-shadow']][bay.panel]!;
        if (bay.face === 'front') {
          const x = q.x + bay.start,
            y = q.y + q.d + 0.001;
          // A dark reveal around glazing gives the skin actual depth at floor scale.
          front(
            x - 0.04,
            y,
            bay.z - 0.07,
            bay.width + 0.08,
            bay.height + 0.14,
            p.ink,
          );
          front(x, y + 0.001, bay.z, bay.width, bay.height, color);
          if (bay.glazing && active && bay.lit) {
            ctx.save();
            ctx.globalAlpha *= 0.18;
            line(
              [x, y, bay.z - 0.1],
              [x + bay.width, y, bay.z - 0.1],
              accent,
              0.9,
            );
            ctx.restore();
          }
          if (fine) {
            line(
              [x + bay.width * 0.5, y + 0.002, bay.z],
              [x + bay.width * 0.5, y + 0.002, bay.z + bay.height],
              p.surface,
              0.35,
            );
            if (floor.index > 0)
              front(
                x,
                y,
                bay.z - 0.55,
                bay.width,
                0.28,
                bay.panel === 0 ? p.ink : p.surface,
                p.edge,
              );
          }
        } else {
          const x = q.x + q.w + 0.001,
            y = q.y + bay.start;
          right(
            x,
            y - 0.04,
            bay.z - 0.07,
            bay.width + 0.08,
            bay.height + 0.14,
            p.ink,
          );
          right(x + 0.001, y, bay.z, bay.width, bay.height, color);
          if (fine)
            line(
              [x + 0.002, y + bay.width * 0.5, bay.z],
              [x + 0.002, y + bay.width * 0.5, bay.z + bay.height],
              p.surface,
              0.35,
            );
        }
      }
      box(floor.slab, g.dark);
      // Floor-edge channels and outriggers connect the recessed mass to the exoskeleton.
      const z = floor.slab.z + 0.08;
      line(
        [v.x + 0.2, v.y + v.d - 0.12, z],
        [v.x + v.w - 0.2, v.y + v.d - 0.12, z],
        p['concrete-shadow'],
        0.7,
      );
      line(
        [v.x + v.w - 0.12, v.y + 0.2, z],
        [v.x + v.w - 0.12, v.y + v.d - 0.2, z],
        p.steel,
        0.7,
      );
      for (const xx of [v.x + 0.2, v.x + v.w - 0.2])
        line([xx, q.y + q.d, z], [xx, v.y + v.d - 0.12, z], p.steel, 0.7);
      // An external diagonal bay is outside the door and window fields.
      const x0 = v.x + v.w - 1.05,
        x1 = v.x + v.w - 0.24,
        y = v.y + v.d - 0.07;
      line([x0, y, q.z + 0.2], [x1, y, z - 0.12], p['concrete-shadow'], 0.85);
      if (f.profile === 'tower')
        line([x1, y, q.z + 0.2], [x0, y, z - 0.12], p.steel, 0.6);
    }
    const base = f.floors[0]!.body,
      frontY = base.y + base.d + 0.005;
    if (b.type === 'warehouse') {
      for (let i = 0; i < 3; i++) {
        const x = v.x + 1.1 + i * 3,
          h = Math.min(2.35, base.h - 0.35);
        front(x, frontY, v.z + 0.15, 2, h, p.ink, p.edge);
        line(
          [x, frontY, v.z + h + 0.2],
          [x + 2, frontY, v.z + h + 0.2],
          active ? accent : p.edge,
          0.8,
        );
        if (fine)
          for (let z = v.z + 0.55; z < v.z + h; z += 0.4)
            line(
              [x + 0.1, frontY + 0.001, z],
              [x + 1.9, frontY + 0.001, z],
              p.steel,
              0.4,
            );
      }
    } else {
      const x = v.x + 2,
        h = Math.min(2.25, base.h - 0.35);
      front(x, frontY, v.z + 0.2, 1.9, h, p.ink, p.edge);
      if (b.type === 'factory') {
        for (let i = 0; i < 4; i++)
          line(
            [x + 0.2, frontY + 0.001, v.z + 0.5 + i * 0.42],
            [x + 1.7, frontY + 0.001, v.z + 0.5 + i * 0.42],
            active ? p.production : p.surface,
            1,
          );
        if (active)
          g.glow(point(x + 1, frontY, v.z + 1.2), p.production, 7, 0.2);
      } else {
        for (let i = 0; i < 4; i++)
          line(
            [x + 0.2, frontY + 0.001, v.z + 0.5 + i * 0.42],
            [x + 1.7, frontY + 0.001, v.z + 0.5 + i * 0.42],
            p.steel,
            0.55,
          );
      }
    }
    // Broad right-side service/display panel is a backed surface, not a floating image.
    box(f.spine, g.dark);
    for (let z = f.spine.z + 0.5; z < f.spine.z + f.spine.h - 0.1; z += 1.25) {
      right(
        f.display.x + 0.001,
        f.spine.y + 0.18,
        z,
        f.spine.d - 0.36,
        0.7,
        p.surface,
        p.edge,
      );
      if (fine)
        line(
          [f.display.x + 0.002, f.spine.y + 0.35, z + 0.1],
          [f.display.x + 0.002, f.spine.y + 0.35, z + 0.6],
          p.edge,
          0.35,
        );
    }
    display?.(f.display);
    for (const column of f.columns) box(column, g.steel);
    // Small active corner markers tie floors to purpose without lighting every edge.
    for (const floor of f.floors.slice(1)) {
      const z = floor.slab.z;
      line(
        [v.x + v.w - 0.22, v.y + v.d - 0.005, z - 0.2],
        [v.x + v.w - 0.22, v.y + v.d - 0.005, z + 0.1],
        active ? accent : p.edge,
        0.8,
      );
    }
    box(f.roof, g.steel);
    if (fine) {
      ctx.save();
      ctx.translate(...point(v.x + 0.7, v.y + v.d - 0.115, v.z + base.h - 0.7));
      ctx.transform(1, 0.5, 0, 1, 0, 0);
      ctx.font = 'bold 1.7px monospace';
      ctx.fillStyle = p.concrete;
      ctx.fillText(
        b.type === 'power'
          ? 'GEN / 01'
          : b.type === 'factory'
            ? 'MELT / 01'
            : 'FREIGHT',
        0,
        0,
      );
      ctx.restore();
      // One supported inset roof panel breaks the roof plane without inventing machinery.
      box(
        volume(
          v.x + v.w * 0.35,
          v.y + v.d * 0.4,
          v.z + v.h - 0.12,
          v.w * 0.24,
          v.d * 0.22,
          0.12,
        ),
        g.dark,
      );
    }
  };
}
