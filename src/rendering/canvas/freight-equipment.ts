import {
  KIT_SIZE,
  KIT_Z,
  type AssemblyPart,
  type Volume,
} from '../assembly/model';
import { iso, type Geometry, type Material } from './geometry';

type Point3 = [number, number, number];

/** Static freight surfaces inside existing kit bays. The caller owns caching,
 * stock/module presence, and the gantry trolley/hoist animation. */
export function paintFreightEquipment(
  g: Geometry,
  part: AssemblyPart,
  origin: { x: number; y: number },
  active: boolean,
  fine: boolean,
): boolean {
  if (!['cargo', 'solar', 'gantry'].includes(part.kind)) return false;
  const { ctx, p } = g;
  const { x, y, z, w, d, h } = part.volume;
  const point = ([x, y, z]: Point3) =>
    iso(origin.x + x / KIT_SIZE, origin.y + y / KIT_SIZE, z * KIT_Z);
  const polygon = (points: Point3[], fill: string, stroke = p.ink) => {
    ctx.beginPath();
    points.forEach((p, i) =>
      i ? ctx.lineTo(...point(p)) : ctx.moveTo(...point(p)),
    );
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.lineWidth = 0.12;
    ctx.strokeStyle = stroke;
    ctx.stroke();
  };
  const line = (a: Point3, b: Point3, color = p.edge, width = 0.14) =>
    g.line(point(a), point(b), color, width);
  const v = (
    x: number,
    y: number,
    z: number,
    w: number,
    d: number,
    h: number,
  ): Volume => ({ x, y, z, w, d, h });
  const box = (volume: Volume, m: Material = g.steel) => {
    const { x, y, z, w, d, h } = volume;
    polygon(
      [
        [x + w, y, z],
        [x + w, y + d, z],
        [x + w, y + d, z + h],
        [x + w, y, z + h],
      ],
      m[2],
    );
    polygon(
      [
        [x, y + d, z],
        [x + w, y + d, z],
        [x + w, y + d, z + h],
        [x, y + d, z + h],
      ],
      m[1],
    );
    polygon(
      [
        [x, y, z + h],
        [x + w, y, z + h],
        [x + w, y + d, z + h],
        [x, y + d, z + h],
      ],
      m[0],
    );
  };

  if (part.kind === 'cargo') {
    // Steel pallet: two runners leave forklift pockets; a continuous deck
    // carries the billets. Upper inventory tiers reuse the same part recipe.
    const pallet = h * 0.17;
    for (const xx of [x + w * 0.07, x + w * 0.76])
      box(v(xx, y + d * 0.04, z, w * 0.17, d * 0.92, pallet * 0.6), g.dark);
    box(
      v(
        x + w * 0.025,
        y + d * 0.025,
        z + pallet * 0.6,
        w * 0.95,
        d * 0.95,
        pallet * 0.4,
      ),
      g.steel,
    );
    const layers = fine ? 3 : 2,
      rows = 3;
    const rowDepth = (d * 0.92) / rows;
    const layerHeight = (h - pallet) / layers;
    for (let layer = 0; layer < layers; layer++)
      for (let row = 0; row < rows; row++) {
        const bottom = z + pallet + layer * layerHeight;
        const gap = layer === layers - 1 ? 0 : h * 0.018;
        box(
          v(
            x + w * 0.045,
            y + d * 0.04 + row * rowDepth,
            bottom,
            w * 0.91,
            rowDepth - d * 0.025,
            layerHeight - gap,
          ),
          [p['concrete-shadow'], p.steel, p.surface],
        );
      }
    // Binding bands wrap the top and near cut ends, rather than hovering
    // above the bundle. Their physical material cue persists while idle.
    for (const u of [0.24, 0.76]) {
      const xx = x + w * u,
        band = w * 0.055;
      polygon(
        [
          [xx, y + d * 0.04, z + h],
          [xx + band, y + d * 0.04, z + h],
          [xx + band, y + d * 0.935, z + h],
          [xx, y + d * 0.935, z + h],
        ],
        p.surface,
        p.edge,
      );
      polygon(
        [
          [xx, y + d * 0.935, z + pallet],
          [xx + band, y + d * 0.935, z + pallet],
          [xx + band, y + d * 0.935, z + h],
          [xx, y + d * 0.935, z + h],
        ],
        p.surface,
        p.edge,
      );
      if (fine)
        line(
          [xx + band * 0.5, y + d * 0.935, z + pallet + h * 0.08],
          [xx + band * 0.5, y + d * 0.935, z + h * 0.94],
          p['concrete-shadow'],
          0.1,
        );
    }
    // Small inventory marker is paint on the pallet edge, not a powered lamp.
    line(
      [x + w * 0.1, y + d * 0.975, z + pallet * 0.83],
      [x + w * 0.3, y + d * 0.975, z + pallet * 0.83],
      p.materials,
      0.22,
    );
    return true;
  }

  if (part.kind === 'solar') {
    const rear = y + d * 0.08,
      front = y + d * 0.92;
    const low = z + h * 0.46,
      high = z + h * 0.92;
    const heightAt = (yy: number) =>
      high + ((low - high) * (yy - rear)) / (front - rear);
    // Continuous mounting rails and four height-matched feet support the
    // inclined modules; all hardware remains in the declared roof bay.
    for (const yy of [rear, front - d * 0.06]) {
      box(v(x + w * 0.035, yy, z, w * 0.93, d * 0.06, h * 0.13), g.dark);
      for (const xx of [x + w * 0.08, x + w * 0.85]) {
        const X = xx + w * 0.065,
          back = yy + d * 0.015,
          front = yy + d * 0.045;
        const bottom = z + h * 0.13,
          backTop = heightAt(back) - h * 0.055,
          frontTop = heightAt(front) - h * 0.055;
        polygon(
          [
            [X, back, bottom],
            [X, front, bottom],
            [X, front, frontTop],
            [X, back, backTop],
          ],
          p.surface,
        );
        polygon(
          [
            [xx, front, bottom],
            [X, front, bottom],
            [X, front, frontTop],
            [xx, front, frontTop],
          ],
          p.steel,
        );
        polygon(
          [
            [xx, back, backTop],
            [X, back, backTop],
            [X, front, frontTop],
            [xx, front, frontTop],
          ],
          p['concrete-shadow'],
        );
      }
    }
    const columns = w > 3 ? 3 : 2,
      modulePitch = (w * 0.94) / columns;
    for (let column = 0; column < columns; column++) {
      const left = x + w * 0.03 + column * modulePitch,
        right = left + modulePitch - w * 0.018;
      const face = (xx: number, yy: number, lift = 0): Point3 => [
        xx,
        yy,
        heightAt(yy) + lift,
      ];
      polygon(
        [
          face(left, rear),
          face(right, rear),
          face(right, front),
          face(left, front),
        ],
        p['concrete-shadow'],
      );
      polygon(
        [
          face(left, front, -h * 0.055),
          face(right, front, -h * 0.055),
          face(right, front),
          face(left, front),
        ],
        p.steel,
      );
      polygon(
        [
          face(right, rear, -h * 0.055),
          face(right, front, -h * 0.055),
          face(right, front),
          face(right, rear),
        ],
        p.surface,
      );
      const border = (right - left) * 0.075;
      const leftCell = left + border,
        rightCell = right - border;
      const rearCell = rear + d * 0.035,
        frontCell = front - d * 0.035;
      polygon(
        [
          face(leftCell, rearCell, h * 0.003),
          face(rightCell, rearCell, h * 0.003),
          face(rightCell, frontCell, h * 0.003),
          face(leftCell, frontCell, h * 0.003),
        ],
        p.ink,
        p.steel,
      );
      // Real cell subdivisions on the tilted plane, with quiet dark fields.
      const cellColumns = fine ? 3 : 2,
        cellRows = fine ? 4 : 2;
      for (let row = 0; row < cellRows; row++)
        for (let cell = 0; cell < cellColumns; cell++) {
          const a =
            leftCell + ((rightCell - leftCell) * (cell + 0.035)) / cellColumns;
          const b =
            leftCell + ((rightCell - leftCell) * (cell + 0.965)) / cellColumns;
          const c =
            rearCell + ((frontCell - rearCell) * (row + 0.035)) / cellRows;
          const e =
            rearCell + ((frontCell - rearCell) * (row + 0.965)) / cellRows;
          polygon(
            [
              face(a, c, h * 0.004),
              face(b, c, h * 0.004),
              face(b, e, h * 0.004),
              face(a, e, h * 0.004),
            ],
            (cell + row) % 3 === 0 ? p.steel : p.surface,
            p.ink,
          );
        }
      line(
        face(leftCell, rearCell, h * 0.006),
        face(rightCell, rearCell, h * 0.006),
        p.materials,
        0.1,
      );
      if (fine)
        for (const yy of [rear + d * 0.02, front - d * 0.02])
          for (const xx of [left + border * 0.45, right - border * 0.45])
            line(
              face(xx, yy, h * 0.006),
              face(xx + (right - left) * 0.025, yy, h * 0.006),
              p.concrete,
              0.11,
            );
    }
    return true;
  }

  // The actual solid recipe defines the open span. No braces or equipment
  // cross the existing trolley travel beneath the beam.
  const top = z + h;
  for (const solid of part.solids) box(solid, g.steel);
  const legs = part.solids.filter(
    (s) => Math.abs(s.z - z) < 1e-6 && s.h > h * 0.5,
  );
  for (const leg of legs) {
    const front = leg.y + leg.d - 0.002,
      right = leg.x + leg.w - 0.002;
    polygon(
      [
        [leg.x + leg.w * 0.22, front, z + 0.12],
        [leg.x + leg.w * 0.78, front, z + 0.12],
        [leg.x + leg.w * 0.78, front, top - 0.4],
        [leg.x + leg.w * 0.22, front, top - 0.4],
      ],
      p.surface,
    );
    line(
      [leg.x + leg.w * 0.1, front, z + 0.12],
      [leg.x + leg.w * 0.1, front, top - 0.42],
      p.concrete,
      0.16,
    );
    // Depth-plane crossbracing lives entirely within each leg footprint.
    const bands = Math.max(1, Math.min(4, Math.floor(h / 2.4)));
    for (let band = 0; band < bands; band++) {
      const low = z + 0.2 + ((h - 0.75) * band) / bands,
        high = z + 0.2 + ((h - 0.75) * (band + 1)) / bands;
      const back = leg.y + leg.d * 0.08,
        near = leg.y + leg.d * 0.92,
        t = 0.055;
      polygon(
        [
          [right, back, low],
          [right, back, low + t],
          [right, near, high],
          [right, near, high - t],
        ],
        p['concrete-shadow'],
      );
      polygon(
        [
          [right, near, low],
          [right, near, low + t],
          [right, back, high],
          [right, back, high - t],
        ],
        p.steel,
      );
    }
    box(
      v(
        leg.x + leg.w * 0.07,
        leg.y + leg.d * 0.04,
        z + leg.h - 0.43,
        leg.w * 0.86,
        leg.d * 0.92,
        0.33,
      ),
      g.steel,
    );
    if (fine)
      for (const xx of [leg.x + leg.w * 0.23, leg.x + leg.w * 0.65])
        for (const zz of [z + 0.3, top - 0.24])
          line(
            [xx, front, zz],
            [xx + leg.w * 0.08, front, zz],
            p.concrete,
            0.15,
          );
  }
  const beam = part.solids.find((s) => s.z > z + h * 0.5);
  if (beam) {
    const front = beam.y + beam.d - 0.002;
    polygon(
      [
        [beam.x, front, top - 0.31],
        [beam.x + beam.w, front, top - 0.31],
        [beam.x + beam.w, front, top - 0.11],
        [beam.x, front, top - 0.11],
      ],
      p.surface,
    );
    line(
      [beam.x, front, top - 0.38],
      [beam.x + beam.w, front, top - 0.38],
      p['concrete-shadow'],
      0.2,
    );
    line(
      [beam.x, front, top - 0.055],
      [beam.x + beam.w, front, top - 0.055],
      p.concrete,
      0.13,
    );
    for (const xx of [beam.x + beam.w * 0.12, beam.x + beam.w * 0.88])
      line([xx, front, top - 0.3], [xx, front, top - 0.13], p.materials, 0.22);
    // A small status element belongs to the end drive, not the lifting cable.
    line(
      [beam.x + beam.w * 0.04, front, top - 0.2],
      [beam.x + beam.w * 0.08, front, top - 0.2],
      active ? p.materials : p.ink,
      0.22,
    );
  }
  return true;
}
