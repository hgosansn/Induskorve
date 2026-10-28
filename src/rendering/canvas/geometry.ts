import type { Palette } from '../palette';

export type Point = [number, number];
export type Material = [string, string, string];
export const iso = (x: number, y: number, z = 0): Point => [
  (x - y) * 27,
  (x + y) * 13.5 - z,
];

// Small Canvas drawing vocabulary shared by all building families. Coordinates
// are tile units horizontally and screen units vertically; no gameplay state.
export function createGeometry(ctx: CanvasRenderingContext2D, p: Palette) {
  const concrete: Material = [
    p['concrete-light'],
    p.concrete,
    p['concrete-shadow'],
  ];
  const steel: Material = [p['concrete-shadow'], p.steel, p.surface];
  const dark: Material = [p.steel, p.surface, p.ink];
  function polygon(points: Point[], fill: string, stroke?: string) {
    ctx.beginPath();
    points.forEach((point, i) =>
      i ? ctx.lineTo(...point) : ctx.moveTo(...point),
    );
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) {
      ctx.lineWidth = 0.45;
      ctx.strokeStyle = stroke;
      ctx.stroke();
    }
  }
  function line(a: Point, b: Point, color: string, width = 0.65) {
    ctx.beginPath();
    ctx.moveTo(...a);
    ctx.lineTo(...b);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
  }
  function box(
    x: number,
    y: number,
    w: number,
    d: number,
    z: number,
    h: number,
    m = steel,
  ) {
    const a = iso(x, y, z + h),
      b = iso(x + w, y, z + h),
      c = iso(x + w, y + d, z + h),
      e = iso(x, y + d, z + h);
    polygon([iso(x + w, y, z), iso(x + w, y + d, z), c, b], m[2], p.ink);
    polygon([iso(x, y + d, z), iso(x + w, y + d, z), c, e], m[1], p.ink);
    polygon([a, b, c, e], m[0], p.edge);
  }
  function taper(
    x: number,
    y: number,
    bottom: number,
    top: number,
    z: number,
    h: number,
    m = concrete,
    cap = true,
  ) {
    const rings = [bottom, top].map((r, k) =>
      Array.from({ length: 8 }, (_, i) => {
        const angle = (i * Math.PI) / 4;
        return iso(x + Math.cos(angle) * r, y + Math.sin(angle) * r, z + k * h);
      }),
    );
    // Front-facing octagon segments only. Back faces are occluded by the shell.
    for (const i of [7, 0, 1, 2, 3]) {
      const j = (i + 1) % 8;
      polygon(
        [rings[0]![i]!, rings[0]![j]!, rings[1]![j]!, rings[1]![i]!],
        i < 2 || i === 7 ? m[2] : m[1],
        p.edge,
      );
    }
    if (cap) polygon(rings[1]!, m[0], p.edge);
  }
  function glow(point: Point, color: string, radius: number, strength = 0.2) {
    ctx.save();
    ctx.globalAlpha *= strength;
    const g = ctx.createRadialGradient(...point, 0, ...point, radius);
    g.addColorStop(0, color);
    g.addColorStop(1, color + '00');
    ctx.fillStyle = g;
    ctx.fillRect(point[0] - radius, point[1] - radius, radius * 2, radius * 2);
    ctx.restore();
  }
  function lamp(point: Point, color: string, active: boolean, size = 1.4) {
    if (active) glow(point, color, 6, 0.25);
    ctx.fillStyle = active ? color : p.ink;
    ctx.fillRect(point[0] - size / 2, point[1] - size / 2, size, size);
  }
  function railing(x: number, y: number, w: number, z: number) {
    line(iso(x, y, z + 3), iso(x + w, y, z + 3), p.concrete, 0.55);
    for (let i = 0; i <= 4; i++)
      line(
        iso(x + (w * i) / 4, y, z),
        iso(x + (w * i) / 4, y, z + 3),
        p['concrete-shadow'],
        0.55,
      );
  }
  return {
    ctx,
    p,
    box,
    taper,
    polygon,
    line,
    glow,
    lamp,
    railing,
    concrete,
    steel,
    dark,
  };
}
export type Geometry = ReturnType<typeof createGeometry>;
