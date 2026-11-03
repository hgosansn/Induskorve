import type { AssemblyPart, Volume } from '../assembly/model';
import { iso, type Geometry, type Material } from './geometry';

/** Dimension-aware construction fitted inside declared contact solids. */
export function paintServiceEquipment(
  g: Geometry,
  part: AssemblyPart,
  origin: { x: number; y: number },
  active: boolean,
  fine: boolean,
) {
  const { p } = g;
  const { x, y, z, w, d, h } = part.volume;
  const point = (a: number, b: number, c: number) =>
    iso(origin.x + a / 12, origin.y + b / 12, c * 3);
  const box = (v: Volume, material: Material = g.steel) => {
    const { x, y, z, w, d, h } = v;
    const face = (pts: number[][], fill: string) => {
      g.ctx.beginPath();
      pts.forEach((q, i) =>
        i
          ? g.ctx.lineTo(...point(q[0]!, q[1]!, q[2]!))
          : g.ctx.moveTo(...point(q[0]!, q[1]!, q[2]!)),
      );
      g.ctx.closePath();
      g.ctx.fillStyle = fill;
      g.ctx.fill();
      g.ctx.strokeStyle = p.ink;
      g.ctx.lineWidth = 0.08;
      g.ctx.stroke();
    };
    face(
      [
        [x + w, y, z],
        [x + w, y + d, z],
        [x + w, y + d, z + h],
        [x + w, y, z + h],
      ],
      material[2],
    );
    face(
      [
        [x, y + d, z],
        [x + w, y + d, z],
        [x + w, y + d, z + h],
        [x, y + d, z + h],
      ],
      material[1],
    );
    face(
      [
        [x, y, z + h],
        [x + w, y, z + h],
        [x + w, y + d, z + h],
        [x, y + d, z + h],
      ],
      material[0],
    );
  };
  const b = (
    xx: number,
    yy: number,
    zz: number,
    ww: number,
    dd: number,
    hh: number,
    m: Material = g.steel,
  ) => box({ x: xx, y: yy, z: zz, w: ww, d: dd, h: hh }, m);
  const line = (a: number[], b: number[], color = p.edge, weight = 0.15) =>
    g.line(
      point(a[0]!, a[1]!, a[2]!),
      point(b[0]!, b[1]!, b[2]!),
      color,
      weight,
    );
  if (part.kind === 'foundation') {
    // Retain only the real contact solids. Ground-colored bearing removes the
    // repeated framed plinth/cap/bolt treatment without floating the machinery.
    for (const foot of part.solids) box(foot, [p.ground, p.surface, p.ground]);
    return true;
  }
  if (part.kind === 'catwalk') {
    b(x, y, z, w, d, 0.12, g.dark);
    for (const yy of [y + 0.03, y + d - 0.07])
      b(x, yy, z + 0.12, w, 0.04, 0.11);
    const posts = Math.max(2, Math.ceil(w / 0.9));
    for (let i = 0; i <= posts; i++)
      b(
        x + 0.025 + ((w - 0.09) * i) / posts,
        y + d - 0.07,
        z + 0.12,
        0.04,
        0.05,
        h - 0.12,
      );
    for (const zz of [z + h * 0.57, z + h - 0.045])
      b(x + 0.025, y + d - 0.07, zz, w - 0.05, 0.05, 0.035, [
        p['concrete-shadow'],
        p.steel,
        p.surface,
      ]);
    if (fine)
      for (let xx = x + 0.18; xx < x + w - 0.1; xx += 0.25)
        line(
          [xx, y + 0.07, z + 0.122],
          [xx, y + d - 0.1, z + 0.122],
          p.edge,
          0.1,
        );
    return true;
  }
  if (part.kind === 'ladder') {
    for (const xx of [x + 0.015, x + w - 0.075])
      b(xx, y + 0.01, z, 0.06, d - 0.02, h, [
        p.concrete,
        p['concrete-shadow'],
        p.steel,
      ]);
    for (let zz = z + 0.18; zz < z + h - 0.06; zz += 0.38)
      b(x + 0.075, y + 0.015, zz, w - 0.15, d - 0.03, 0.035, [
        p.concrete,
        p['concrete-shadow'],
        p.steel,
      ]);
    for (const zz of [z + 0.15, z + h * 0.5, z + h - 0.12])
      for (const xx of [x + 0.015, x + w - 0.075])
        b(xx, y, zz, 0.06, d, 0.065, g.dark);
    return true;
  }
  if (part.kind === 'skylights') {
    b(x, y, z, w, d, 0.1, g.dark);
    const ridge = y + d * 0.62,
      top = z + h;
    const face = (points: number[][], color: string) =>
      g.polygon(
        points.map((q) => point(q[0]!, q[1]!, q[2]!)),
        color,
        p.ink,
      );
    face(
      [
        [x + 0.07, y + 0.07, z + 0.1],
        [x + w - 0.07, y + 0.07, z + 0.1],
        [x + w - 0.07, ridge, top],
        [x + 0.07, ridge, top],
      ],
      p.steel,
    );
    face(
      [
        [x + 0.07, ridge, top],
        [x + w - 0.07, ridge, top],
        [x + w - 0.07, y + d - 0.07, z + 0.13],
        [x + 0.07, y + d - 0.07, z + 0.13],
      ],
      active ? p.production : p.surface,
    );
    for (const xx of [x + 0.07, x + w - 0.07]) {
      face(
        [
          [xx, y + 0.07, z + 0.1],
          [xx, ridge, top],
          [xx, y + d - 0.07, z + 0.13],
        ],
        p.surface,
      );
      line(
        [xx, ridge, top],
        [xx, y + d - 0.07, z + 0.13],
        p['concrete-shadow'],
        0.19,
      );
    }
    for (let i = 1; i < 5; i++) {
      const xx = x + 0.07 + ((w - 0.14) * i) / 5;
      line([xx, y + 0.07, z + 0.1], [xx, ridge, top], p.edge, 0.17);
      line([xx, ridge, top], [xx, y + d - 0.07, z + 0.13], p.steel, 0.2);
    }
    line(
      [x + 0.07, ridge, top],
      [x + w - 0.07, ridge, top],
      p['concrete-shadow'],
      0.25,
    );
    line(
      [x + 0.07, y + d - 0.07, z + 0.13],
      [x + w - 0.07, y + d - 0.07, z + 0.13],
      p['concrete-shadow'],
      0.25,
    );
    return true;
  }
  return false;
}
