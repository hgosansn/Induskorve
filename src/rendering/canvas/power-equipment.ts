import {
  KIT_SIZE,
  KIT_Z,
  type AssemblyPart,
  type Volume,
} from '../assembly/model';
import { iso, type Geometry, type Material } from './geometry';

type Point3 = [number, number, number];

/** Native kit surfaces for the three power-machine bays. Called by the existing
 * static-part cache: no independent clock, image decode or animation lifecycle.
 * Small fittings are owned by the same conservative solid as their enclosure.
 */
export function paintPowerEquipment(
  g: Geometry,
  part: AssemblyPart,
  origin: { x: number; y: number },
  active: boolean,
  fine: boolean,
): boolean {
  if (!['cooler', 'turbine', 'exchanger'].includes(part.kind)) return false;
  const { ctx, p } = g;
  const { x, y, z, w, d, h } = part.volume;
  const top = z + h;
  const project = ([xx, yy, zz]: Point3) =>
    iso(origin.x + xx / KIT_SIZE, origin.y + yy / KIT_SIZE, zz * KIT_Z);
  const polygon = (points: Point3[], fill: string, edge = p.ink) => {
    ctx.beginPath();
    points.forEach((point, i) =>
      i ? ctx.lineTo(...project(point)) : ctx.moveTo(...project(point)),
    );
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = edge;
    ctx.lineWidth = 0.11;
    ctx.stroke();
  };
  const line = (a: Point3, b: Point3, color = p.edge, width = 0.16) =>
    g.line(project(a), project(b), color, width);
  const volume = (
    xx: number,
    yy: number,
    zz: number,
    ww: number,
    dd: number,
    hh: number,
  ): Volume => ({ x: xx, y: yy, z: zz, w: ww, d: dd, h: hh });
  const box = (v: Volume, material: Material = g.steel) => {
    const { x, y, z, w, d, h } = v;
    polygon(
      [
        [x + w, y, z],
        [x + w, y + d, z],
        [x + w, y + d, z + h],
        [x + w, y, z + h],
      ],
      material[2],
    );
    polygon(
      [
        [x, y + d, z],
        [x + w, y + d, z],
        [x + w, y + d, z + h],
        [x, y + d, z + h],
      ],
      material[1],
    );
    polygon(
      [
        [x, y, z + h],
        [x + w, y, z + h],
        [x + w, y + d, z + h],
        [x, y + d, z + h],
      ],
      material[0],
    );
  };
  const cross = (a: Point3, b: Point3): Point3 => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
  const unit = (a: Point3): Point3 => {
    const n = Math.hypot(...a);
    return [a[0] / n, a[1] / n, a[2] / n];
  };
  const cylinder = (
    start: Point3,
    end: Point3,
    radius: number,
    material: Material = g.steel,
  ) => {
    const axis = unit([
      end[0] - start[0],
      end[1] - start[1],
      end[2] - start[2],
    ]);
    const tangent = unit(
      cross(axis, Math.abs(axis[2]) > 0.9 ? [0, 1, 0] : [0, 0, 1]),
    );
    const up = cross(axis, tangent);
    const sides = fine ? 12 : 8;
    const ring = (center: Point3) =>
      Array.from({ length: sides }, (_, i): Point3 => {
        const angle = (i * Math.PI * 2) / sides;
        return [0, 1, 2].map(
          (j) =>
            center[j]! +
            radius * (tangent[j]! * Math.cos(angle) + up[j]! * Math.sin(angle)),
        ) as Point3;
      });
    const a = ring(start),
      b = ring(end);
    for (let i = 0; i < sides; i++) {
      const j = (i + 1) % sides;
      const angle = ((i + 0.5) * Math.PI * 2) / sides;
      const normal = [0, 1, 2].map(
        (k) => tangent[k]! * Math.cos(angle) + up[k]! * Math.sin(angle),
      );
      if (normal[0]! + normal[1]! + normal[2]! * 0.8 <= 0) continue;
      polygon(
        [a[i]!, a[j]!, b[j]!, b[i]!],
        i % 3 === 0 ? material[1] : material[2],
      );
    }
    polygon(axis[0] + axis[1] + axis[2] * 0.8 > 0 ? b : a, material[0]);
  };
  const bolt = (at: Point3) => {
    if (!fine) return;
    line(at, [at[0], at[1], at[2] + 0.035], p.ink, 0.23);
    line(
      [at[0] - 0.02, at[1], at[2] + 0.035],
      [at[0] + 0.025, at[1], at[2] + 0.035],
      p.concrete,
      0.13,
    );
  };
  const xFitting = (
    atY: number,
    atZ: number,
    length: number,
    right = false,
    copper = false,
  ) => {
    const a = right ? x + w - length : x;
    const b = right ? x + w : x + length;
    const material: Material = copper
      ? [p.production, p.production, p['concrete-shadow']]
      : [p['concrete-shadow'], p.steel, p.surface];
    cylinder([a, atY, atZ], [b, atY, atZ], 0.095, material);
    const flangeX = right ? b - 0.055 : a + 0.005;
    cylinder([flangeX, atY, atZ], [flangeX + 0.05, atY, atZ], 0.14, g.steel);
  };
  const sideIndicator = (
    atX: number,
    atY: number,
    atZ: number,
    length: number,
  ) =>
    polygon(
      [
        [atX, atY, atZ],
        [atX, atY + length, atZ],
        [atX, atY + length, atZ + 0.055],
        [atX, atY, atZ + 0.055],
      ],
      active ? p.power : p.ink,
    );

  if (part.kind === 'cooler') {
    // Water basin and an accessible header remain grounded. The air-intake
    // belt visibly carries the waisted shell; it is not a floating roof vase.
    box(volume(x + 0.05, y + 0.05, z, w - 0.1, d - 0.1, 0.28), g.dark);
    const cx = x + w / 2,
      cy = y + d / 2;
    const radius = Math.min(w, d) * 0.44;
    const intakeTop = z + Math.min(1.25, h * 0.2);
    const segments = fine ? 12 : 8;
    const ring = (r: number, zz: number) =>
      Array.from({ length: segments }, (_, i): Point3 => [
        cx + Math.cos((i * 2 * Math.PI) / segments) * r,
        cy + Math.sin((i * 2 * Math.PI) / segments) * r,
        zz,
      ]);
    const visible = Array.from({ length: segments }, (_, i) => i)
      .filter((i) => {
        const a = ((i + 0.5) * 2 * Math.PI) / segments;
        return Math.cos(a) + Math.sin(a) > 0.001;
      })
      .sort((a, b) => {
        const depth = (i: number) =>
          Math.cos(((i + 0.5) * 2 * Math.PI) / segments) +
          Math.sin(((i + 0.5) * 2 * Math.PI) / segments);
        return depth(a) - depth(b);
      });
    const shellBand = (r0: number, z0: number, r1: number, z1: number) => {
      const low = ring(r0, z0),
        high = ring(r1, z1);
      for (const i of visible) {
        const j = (i + 1) % segments;
        polygon(
          [low[i]!, low[j]!, high[j]!, high[i]!],
          i < segments / 4 ? p['concrete-shadow'] : p.concrete,
          p.edge,
        );
      }
    };
    const low = ring(radius * 0.94, z + 0.28),
      high = ring(radius * 0.94, intakeTop);
    for (const i of visible) {
      const j = (i + 1) % segments;
      polygon([low[i]!, low[j]!, high[j]!, high[i]!], p.ink);
      const a = low[i]!,
        b = low[j]!;
      for (let zz = z + 0.44; zz < intakeTop - 0.08; zz += fine ? 0.18 : 0.35)
        line([a[0], a[1], zz], [b[0], b[1], zz], p.steel, 0.2);
    }
    const pierVertices = [
      ...new Set(visible.flatMap((i) => [i, (i + 1) % segments])),
    ];
    pierVertices.sort(
      (a, b) => low[a]![0] + low[a]![1] - low[b]![0] - low[b]![1],
    );
    for (const i of pierVertices) {
      const at = low[i]!;
      box(
        volume(
          at[0] - 0.055,
          at[1] - 0.055,
          z + 0.28,
          0.11,
          0.11,
          intakeTop - z - 0.28,
        ),
        g.concrete,
      );
    }
    // Piecewise native surface rings establish the hyperbolic wall profile.
    const heights = [
      intakeTop,
      z + h * 0.33,
      z + h * 0.52,
      z + h * 0.68,
      z + h * 0.84,
      top - 0.18,
    ];
    const radii = [
      radius * 0.96,
      radius * 0.78,
      radius * 0.62,
      radius * 0.64,
      radius * 0.76,
      radius * 0.94,
    ];
    for (let i = 1; i < heights.length; i++)
      shellBand(radii[i - 1]!, heights[i - 1]!, radii[i]!, heights[i]!);
    // Closed annular top rim, with a dark inset air outlet and fixed drift grille.
    shellBand(radius * 0.94, top - 0.18, radius, top - 0.035);
    const outer = ring(radius, top - 0.035),
      inner = ring(radius * 0.76, top - 0.035);
    polygon(ring(radius * 0.76, top - 0.15), p.ink);
    if (fine)
      for (let i = 0; i < 4; i++) {
        const angle = (i * Math.PI) / 4;
        const dx = Math.cos(angle) * radius * 0.7,
          dy = Math.sin(angle) * radius * 0.7;
        line(
          [cx - dx, cy - dy, top - 0.13],
          [cx + dx, cy + dy, top - 0.13],
          p.steel,
          0.21,
        );
      }
    for (let i = 0; i < segments; i++) {
      const j = (i + 1) % segments;
      polygon(
        [outer[i]!, outer[j]!, inner[j]!, inner[i]!],
        p['concrete-shadow'],
        p.edge,
      );
    }
    // Panel seams follow the actual shell rings, not screen-space stripes.
    if (fine)
      for (const i of visible) {
        for (let k = 1; k < heights.length; k++) {
          const angle = (i * Math.PI * 2) / segments;
          line(
            [
              cx + Math.cos(angle) * radii[k - 1]!,
              cy + Math.sin(angle) * radii[k - 1]!,
              heights[k - 1]!,
            ],
            [
              cx + Math.cos(angle) * radii[k]!,
              cy + Math.sin(angle) * radii[k]!,
              heights[k]!,
            ],
            p.edge,
            0.12,
          );
        }
      }
    box(volume(x + 0.12, y + 1.28, z + 0.28, 0.27, 1.07, 1.12), g.steel);
    sideIndicator(x + 0.395, y + 1.52, z + 1.19, 0.35);
    xFitting(y + 1.5, z + 1.2, 0.3);
    xFitting(y + 2.2, z + 0.6, 0.3);
    return true;
  }

  if (part.kind === 'turbine') {
    box(volume(x + 0.05, y + 0.05, z, w - 0.1, d - 0.1, 0.22), g.dark);
    box(
      volume(x + 0.14, y + 0.14, z + 0.22, w - 0.28, d - 0.28, h - 0.42),
      g.dark,
    );
    const front = y + d - 0.08,
      right = x + w - 0.08;
    // Folded cap and standing casing rails, all carried by the ground skid.
    box(volume(x + 0.1, y + 0.1, top - 0.2, w - 0.2, d - 0.2, 0.13), g.steel);
    for (const xx of [x + 0.13, x + w - 0.25])
      box(volume(xx, front - 0.12, z + 0.22, 0.12, 0.12, h - 0.48), g.steel);
    box(
      volume(x + 0.36, front - 0.08, z + 0.46, w - 0.72, 0.06, h - 0.98),
      g.steel,
    );
    for (const zz of [z + 0.63, top - 0.65])
      for (const xx of [x + 0.45, x + w - 0.48]) bolt([xx, front - 0.014, zz]);
    line(
      [x + w * 0.5, front - 0.014, z + 0.49],
      [x + w * 0.5, front - 0.014, top - 0.55],
      p.surface,
      0.2,
    );
    box(
      volume(x + w * 0.52, front - 0.006, z + 1.05, 0.06, 0.025, 0.23),
      g.dark,
    );
    // A deep side cooling intake with actual slat thickness and frame members.
    polygon(
      [
        [right - 0.04, y + 0.37, z + 0.47],
        [right - 0.04, y + d - 0.37, z + 0.47],
        [right - 0.04, y + d - 0.37, top - 0.43],
        [right - 0.04, y + 0.37, top - 0.43],
      ],
      p.ink,
    );
    for (let zz = z + 0.6; zz < top - 0.5; zz += fine ? 0.25 : 0.45)
      box(volume(right - 0.04, y + 0.43, zz, 0.04, d - 0.86, 0.055), [
        p['concrete-shadow'],
        p.steel,
        p.surface,
      ]);
    for (const yy of [y + 0.24, y + d - 0.33])
      box(volume(right - 0.1, yy, z + 0.3, 0.1, 0.09, h - 0.64), g.steel);
    // Removable roof service plate, no separate rooftop machinery box.
    box(
      volume(x + 0.4, y + 0.4, top - 0.095, w - 0.8, d - 0.8, 0.055),
      g.steel,
    );
    for (const xx of [x + 0.52, x + w - 0.55])
      for (const yy of [y + 0.51, y + d - 0.54]) bolt([xx, yy, top - 0.04]);
    sideIndicator(right + 0.001, y + 0.43, top - 0.35, 0.35);
    // Existing left-hand electrical bus port: y=6.5 and z=floor+1.
    box(volume(x + 0.1, y + 1.18, z + 0.72, 0.27, 0.44, 0.56), g.steel);
    xFitting(y + 1.4, z + 1.0, 0.28);
    return true;
  }

  // Recoverable heat uses a compressed plate pack, not a decorative orange box.
  for (const yy of [y + 0.08, y + d - 0.25])
    box(volume(x + 0.08, yy, z, w - 0.16, 0.17, 0.17), g.dark);
  for (const xx of [x + 0.28, x + w - 0.46])
    box(volume(xx, y + 0.24, z + 0.17, 0.18, d - 0.48, 0.28), g.steel);
  const plates = fine ? 12 : 7;
  const start = x + 0.34,
    length = w - 0.68;
  box(volume(x + 0.18, y + 0.2, z + 0.34, 0.15, d - 0.4, h - 0.57), g.steel);
  for (let i = 0; i < plates; i++) {
    const xx = start + (length * i) / plates;
    box(
      volume(
        xx,
        y + 0.3,
        z + 0.45,
        (length / plates) * 0.46,
        d - 0.6,
        h - 0.86,
      ),
      [p['concrete-shadow'], p.steel, p.surface],
    );
  }
  box(
    volume(x + w - 0.33, y + 0.2, z + 0.34, 0.15, d - 0.4, h - 0.57),
    g.steel,
  );
  for (const yy of [y + 0.28, y + d - 0.28])
    for (const zz of [z + 0.58, top - 0.42]) {
      cylinder([x + 0.16, yy, zz], [x + w - 0.14, yy, zz], 0.026, g.dark);
      cylinder([x + w - 0.16, yy, zz], [x + w - 0.1, yy, zz], 0.06, g.steel);
    }
  sideIndicator(x + w - 0.175, y + 0.38, top - 0.32, 0.3);
  // Physical copper fittings stay copper while idle; only the indicator changes.
  xFitting(y + 0.8, z + 1.1, 0.23, false, true);
  xFitting(y + 0.8, z + 1.1, 0.23, true, true);
  return true;
}
