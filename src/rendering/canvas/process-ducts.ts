import {
  routeSolids,
  KIT_SIZE,
  KIT_Z,
  type Route,
  type Volume,
} from '../assembly/model';
import { iso, type Geometry } from './geometry';

export function ductBounds(route: Route): Volume {
  const radius = (route.diameter ?? 0.12) / 2 + 0.06;
  const min = ([0, 1, 2] as const).map(
    (i) => Math.min(...route.points.map((p) => p[i])) - radius,
  );
  const max = ([0, 1, 2] as const).map(
    (i) => Math.max(...route.points.map((p) => p[i])) + radius,
  );
  return {
    x: min[0]!,
    y: min[1]!,
    z: min[2]!,
    w: max[0]! - min[0]!,
    d: max[1]! - min[1]!,
    h: max[2]! - min[2]!,
  };
}

// Closed sheet-metal ducts, not glowing centreline indicators. End flanges
// sit on the same port coordinates used by the assembly validator.
export function paintProcessDuct(
  g: Geometry,
  route: Route,
  origin: { x: number; y: number },
) {
  const { ctx, p } = g;
  const project = (x: number, y: number, z: number) =>
    iso(origin.x + x / KIT_SIZE, origin.y + y / KIT_SIZE, z * KIT_Z);
  const box = (v: Volume) => {
    const { x, y, z, w, d, h } = v;
    const polygon = (pts: number[][], fill: string) => {
      ctx.beginPath();
      pts.forEach((q, i) =>
        i
          ? ctx.lineTo(...project(q[0]!, q[1]!, q[2]!))
          : ctx.moveTo(...project(q[0]!, q[1]!, q[2]!)),
      );
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.strokeStyle = p.ink;
      ctx.lineWidth = 0.1;
      ctx.stroke();
    };
    polygon(
      [
        [x + w, y, z],
        [x + w, y + d, z],
        [x + w, y + d, z + h],
        [x + w, y, z + h],
      ],
      route.service === 'heat' ? p.soot : p.surface,
    );
    polygon(
      [
        [x, y + d, z],
        [x + w, y + d, z],
        [x + w, y + d, z + h],
        [x, y + d, z + h],
      ],
      route.service === 'heat'
        ? p.production
        : route.service === 'power'
          ? p.power
          : p.steel,
    );
    polygon(
      [
        [x, y, z + h],
        [x + w, y, z + h],
        [x + w, y + d, z + h],
        [x, y + d, z + h],
      ],
      route.service === 'heat' ? p.production : p['concrete-shadow'],
    );
  };
  for (const solid of routeSolids(route)) box(solid);
}
