import {
  KIT_SIZE,
  KIT_Z,
  type AssemblyPart,
  type Volume,
} from '../assembly/model';
import { iso, type Geometry, type Material } from './geometry';

type P = [number, number, number];

// City-camera equipment surfaces. Every fitting is contained by its existing
// conservative bay solid; this does not invent modules or process connections.
export function paintFoundryEquipment(
  g: Geometry,
  part: AssemblyPart,
  origin: { x: number; y: number },
  active: boolean,
  fine: boolean,
) {
  const { ctx, p } = g;
  const { x, y, z, w, d, h } = part.volume;
  const point = ([x, y, z]: P) =>
    iso(origin.x + x / KIT_SIZE, origin.y + y / KIT_SIZE, z * KIT_Z);
  const polygon = (points: P[], fill: string, stroke = p.ink) => {
    ctx.beginPath();
    points.forEach((p, i) =>
      i ? ctx.lineTo(...point(p)) : ctx.moveTo(...point(p)),
    );
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 0.12;
    ctx.stroke();
  };
  const line = (a: P, b: P, color = p['concrete-shadow'], width = 0.17) =>
    g.line(point(a), point(b), color, width);
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
  const v = (
    xx: number,
    yy: number,
    zz: number,
    ww: number,
    dd: number,
    hh: number,
  ): Volume => ({ x: xx, y: yy, z: zz, w: ww, d: dd, h: hh });
  const bolt = (at: P) => {
    line(at, [at[0], at[1], at[2] + 0.065], p.ink, 0.25);
    line(
      [at[0] - 0.018, at[1], at[2] + 0.065],
      [at[0] + 0.035, at[1], at[2] + 0.065],
      p.concrete,
      0.12,
    );
  };

  if (part.kind === 'hatch') {
    box(v(x, y, z, w, d, 0.12), g.dark);
    box(v(x + 0.04, y + 0.04, z + 0.12, w - 0.08, d - 0.08, 0.17), g.steel);
    line(
      [x + w * 0.28, y + d * 0.62, z + 0.3],
      [x + w * 0.65, y + d * 0.62, z + 0.3],
      p.concrete,
      0.19,
    );
    for (const xx of [x + w * 0.24, x + w * 0.74])
      box(v(xx, y + 0.03, z + 0.23, 0.08, 0.18, 0.08), g.dark);
    return;
  }
  if (part.kind === 'duct-support') {
    box(v(x, y, z, w, d, 0.12), g.dark);
    box(
      v(x + w * 0.38, y + d * 0.28, z + 0.12, w * 0.24, d * 0.44, h - 0.24),
      g.steel,
    );
    box(v(x, y, z + h - 0.12, w, d, 0.12), g.steel);
    return;
  }
  if (part.kind === 'plenum') {
    box(v(x, y, z, w, d, 0.18), g.dark);
    box(v(x + 0.06, y + 0.06, z + 0.18, w - 0.12, d - 0.12, h - 0.18), g.steel);
    for (const yy of [y + 0.25, y + 0.65])
      box(v(x, yy - 0.14, z + 0.96, 0.22, 0.28, 0.28), g.steel);
    // Bolted removable front cleanout cover; it is sealed, not a cooling grille.
    box(v(x + 0.2, y + d - 0.08, z + 0.42, w - 0.4, 0.06, h - 0.64), g.dark);
    if (fine)
      for (const xx of [x + 0.25, x + w - 0.25])
        for (const zz of [z + 0.53, z + h - 0.35])
          bolt([xx, y + d - 0.015, zz]);
    return;
  }

  if (part.kind === 'furnace') {
    // Cast plinth, recessed heat door and deep separate casing rails.
    box(v(x + 0.08, y + 0.08, z, w - 0.16, d - 0.16, 0.28), g.dark);
    box(v(x + 0.18, y + 0.18, z + 0.28, w - 0.36, d - 0.36, h - 0.43), g.dark);
    box(v(x + 0.12, y + 0.12, z + h - 0.28, w - 0.24, d - 0.24, 0.22), g.steel);
    const front = y + d - 0.12,
      right = x + w - 0.12;
    // Refractory mouth: dark throat, copper lining and an uneven white-hot centre.
    box(v(x + 0.32, front - 0.2, z + 0.65, w - 0.64, 0.16, 1.05), [
      p.steel,
      p['concrete-shadow'],
      p.surface,
    ]);
    polygon(
      [
        [x + 0.48, front - 0.025, z + 0.82],
        [x + w - 0.48, front - 0.025, z + 0.82],
        [x + w - 0.48, front - 0.025, z + 1.48],
        [x + 0.48, front - 0.025, z + 1.48],
      ],
      p.ink,
    );
    if (active) {
      polygon(
        [
          [x + 0.51, front - 0.018, z + 0.88],
          [x + w - 0.51, front - 0.018, z + 0.88],
          [x + w - 0.51, front - 0.018, z + 1.4],
          [x + 0.51, front - 0.018, z + 1.4],
        ],
        p.production,
      );
      polygon(
        [
          [x + 0.56, front - 0.012, z + 1.0],
          [x + w - 0.6, front - 0.012, z + 1.0],
          [x + w - 0.6, front - 0.012, z + 1.28],
          [x + 0.56, front - 0.012, z + 1.28],
        ],
        p['concrete-light'],
      );
    }
    for (const xx of [x + 0.16, x + w - 0.34])
      box(v(xx, front - 0.14, z + 0.29, 0.18, 0.14, h - 0.61), g.steel);
    box(v(x + 0.42, front - 0.1, z + 1.91, w - 0.84, 0.08, h - 2.27), g.steel);
    line(
      [x + w / 2, front - 0.012, z + 1.94],
      [x + w / 2, front - 0.012, z + h - 0.38],
      p.ink,
    );
    // Quiet top plates, with a folded perimeter and a single service seam.
    polygon(
      [
        [x + 0.35, y + 0.34, z + h - 0.052],
        [x + w - 0.35, y + 0.34, z + h - 0.052],
        [x + w - 0.35, y + d - 0.36, z + h - 0.052],
        [x + 0.35, y + d - 0.36, z + h - 0.052],
      ],
      p.steel,
      p.edge,
    );
    line(
      [x + 0.38, y + d * 0.48, z + h - 0.045],
      [x + w - 0.38, y + d * 0.48, z + h - 0.045],
      p.surface,
    );
    // A cooling bank sits within the visible side casing, away from the heat door.
    polygon(
      [
        [right - 0.02, y + 0.42, z + 0.64],
        [right - 0.02, y + d - 0.4, z + 0.64],
        [right - 0.02, y + d - 0.4, z + h - 0.48],
        [right - 0.02, y + 0.42, z + h - 0.48],
      ],
      p.ink,
    );
    for (let zz = z + 0.8; zz < z + h - 0.52; zz += fine ? 0.25 : 0.5)
      line(
        [right - 0.01, y + 0.48, zz],
        [right - 0.01, y + d - 0.46, zz],
        p['concrete-shadow'],
        0.24,
      );
    for (const yy of [y + 0.25, y + d - 0.38])
      box(v(right - 0.13, yy, z + 0.3, 0.13, 0.13, h - 0.64), g.steel);
    if (fine) {
      for (const xx of [x + 0.23, x + w - 0.25])
        for (const zz of [z + 0.45, z + 1.78, z + h - 0.4])
          bolt([xx, front + 0.003, zz]);
      for (const xx of [x + 0.53, x + w - 0.58])
        for (const zz of [z + 2.04, z + h - 0.52])
          bolt([xx, front - 0.005, zz]);
      // Clamped cooling line on the far side, still inside the casing envelope.
      const xx = right + 0.025,
        yy = y + 0.4;
      line([xx, yy, z + 0.48], [xx, yy, z + h - 0.44], p.ink, 0.42);
      line([xx, yy, z + 0.48], [xx, yy, z + h - 0.44], p.concrete, 0.18);
      for (const zz of [z + 0.7, z + h - 0.7])
        line([xx, yy - 0.07, zz], [xx, yy + 0.08, zz], p.steel, 0.32);
    }
    // Sealed side capture connection reaches the declared exhaust port.
    box(v(x, y + 0.76, z + 1.86, 0.28, 0.28, 0.28), g.steel);
    return;
  }

  const cx = x + w / 2,
    cy = y + d / 2;
  const ring = (r: number, zz: number): P[] =>
    Array.from({ length: 8 }, (_, i) => [
      cx + Math.cos((i * Math.PI) / 4) * r,
      cy + Math.sin((i * Math.PI) / 4) * r,
      zz,
    ]);
  const shell = (
    low: number,
    high: number,
    r0: number,
    r1: number,
    material: Material = g.steel,
  ) => {
    const a = ring(r0, low),
      b = ring(r1, high);
    // Back-to-front visible facets, avoiding the former opaque internal caps.
    for (const i of [7, 2, 0, 1]) {
      const j = (i + 1) % 8;
      polygon(
        [a[i]!, a[j]!, b[j]!, b[i]!],
        i === 7 ? material[2] : i === 2 ? material[1] : material[0],
      );
    }
  };
  const collar = (zz: number, radius: number, height = 0.13) => {
    shell(zz, zz + height, radius, radius, [
      p['concrete-shadow'],
      p.steel,
      p.surface,
    ]);
    polygon(ring(radius, zz + height), p['concrete-shadow']);
  };
  box(v(x + 0.08, y + 0.08, z, w - 0.16, d - 0.16, 0.3), g.dark);
  const scrubber = part.kind === 'scrubber';
  const bodyTop = z + (scrubber ? h * 0.4 : 1.65);
  const shoulderTop = bodyTop + (scrubber ? h * 0.09 : 0.35);
  const radius = w * (scrubber ? 0.42 : 0.3);
  // Build bottom-up. Collars precede the shell above them, leaving real annuli.
  collar(z + 0.28, radius + 0.06, 0.16);
  shell(z + 0.44, bodyTop, radius, radius, [
    p['concrete-shadow'],
    p.steel,
    p.surface,
  ]);
  {
    // Inset maintenance panels sit on the actual two near octagonal facets.
    const facet = (side: number, u: number, zz: number): P => {
      const a = (side * Math.PI) / 4,
        b = ((side + 1) * Math.PI) / 4;
      return [
        cx + radius * (Math.cos(a) * (1 - u) + Math.cos(b) * u),
        cy + radius * (Math.sin(a) * (1 - u) + Math.sin(b) * u),
        zz,
      ];
    };
    for (const side of [0, 1]) {
      polygon(
        [
          facet(side, 0.13, z + 0.6),
          facet(side, 0.87, z + 0.6),
          facet(side, 0.87, bodyTop - 0.3),
          facet(side, 0.13, bodyTop - 0.3),
        ],
        p.surface,
        p['concrete-shadow'],
      );
      if (fine)
        for (const u of [0.24, 0.76])
          for (const zz of [z + 0.9, bodyTop - 0.55]) bolt(facet(side, u, zz));
      // Low drain-door grille and a small powered instrumentation lamp.
      for (
        let zz = z + 0.78;
        zz < Math.min(z + 1.48, bodyTop - 0.4);
        zz += 0.18
      )
        line(facet(side, 0.26, zz), facet(side, 0.74, zz), p.edge, 0.14);
      line(
        facet(side, 0.28, bodyTop - 0.25),
        facet(side, 0.62, bodyTop - 0.25),
        active ? p.production : p.ink,
        0.23,
      );
    }
    // Standing seams belong to the vessel facets, not to arbitrary screen pixels.
    for (const angle of [0, Math.PI / 4, Math.PI / 2]) {
      const xx = cx + Math.cos(angle) * radius,
        yy = cy + Math.sin(angle) * radius;
      line([xx, yy, z + 0.5], [xx, yy, bodyTop - 0.12], p.edge, 0.16);
    }
  }
  collar(bodyTop - 0.13, radius + 0.055, 0.17);
  shell(bodyTop + 0.04, shoulderTop, radius, w * 0.2, [
    p.concrete,
    p['concrete-shadow'],
    p.steel,
  ]);
  const flueTop = z + h - 0.22;
  shell(shoulderTop, flueTop, w * 0.2, w * 0.175, [
    p['concrete-shadow'],
    p.steel,
    p.surface,
  ]);
  {
    for (const fraction of [0.28, 0.6]) {
      const zz = shoulderTop + (flueTop - shoulderTop) * fraction;
      shell(zz, zz + 0.1, w * 0.205, w * 0.205, [
        p.steel,
        p['concrete-shadow'],
        p.surface,
      ]);
    }
    // Medium-scale flue seams stay legible without tiny fasteners.
    for (const fraction of [0, 0.25, 0.5]) {
      const a = Math.PI * fraction;
      const r0 = w * 0.2,
        r1 = w * 0.175;
      line(
        [cx + Math.cos(a) * r0, cy + Math.sin(a) * r0, shoulderTop + 0.12],
        [cx + Math.cos(a) * r1, cy + Math.sin(a) * r1, flueTop - 0.08],
        p.edge,
        0.13,
      );
    }
    if (fine) {
      // A continuous maintenance ladder follows the body, shoulder and flue,
      // with short standoffs. All points remain inside the bay's solid envelope.
      const ladderPoint = (zz: number, offset: number): P => {
        const r =
          zz < bodyTop
            ? radius
            : zz < shoulderTop
              ? radius +
                ((w * 0.2 - radius) * (zz - bodyTop)) / (shoulderTop - bodyTop)
              : w *
                (0.2 - (0.025 * (zz - shoulderTop)) / (flueTop - shoulderTop));
        const a = Math.PI / 4,
          rr = r + 0.08;
        return [
          cx + Math.cos(a) * rr - Math.sin(a) * offset,
          cy + Math.sin(a) * rr + Math.cos(a) * offset,
          zz,
        ];
      };
      const levels = [z + 0.35, bodyTop, shoulderTop, flueTop - 0.12];
      for (const offset of [-w * 0.105, w * 0.105])
        for (let i = 1; i < levels.length; i++)
          line(
            ladderPoint(levels[i - 1]!, offset),
            ladderPoint(levels[i]!, offset),
            p.concrete,
            0.21,
          );
      for (let zz = z + 0.48; zz < flueTop - 0.12; zz += 0.43)
        line(
          ladderPoint(zz, -w * 0.105),
          ladderPoint(zz, w * 0.105),
          p['concrete-shadow'],
          0.17,
        );
      for (const zz of [bodyTop - 0.2, shoulderTop + 0.4, flueTop - 0.65]) {
        const at = ladderPoint(zz, w * 0.105);
        line(at, [at[0] - 0.1, at[1] - 0.1, at[2]], p.steel, 0.27);
      }
      for (const angle of [Math.PI / 8, (3 * Math.PI) / 8, (5 * Math.PI) / 8])
        bolt([
          cx + Math.cos(angle) * (radius + 0.02),
          cy + Math.sin(angle) * (radius + 0.02),
          bodyTop + 0.04,
        ]);
    }
  }
  collar(flueTop, w * 0.22, 0.17);
  polygon(ring(w * 0.155, z + h - 0.042), p.ink);
  // Owned intake reaches from the front bay face to the real vessel/flue skin.
  // The external duct stops at the bay face; this stub closes the former gap.
  box(v(x + 0.91, y + d - 1.15, z + 2.06, 0.28, 1.15, 0.28), g.steel);
}
