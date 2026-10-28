import type { Palette } from '../palette';
import { compileWfcKit, type GeneratedBay } from './wfc-kit';
import { WFC_STYLES, type WfcBuilding } from './wfc';

export type Point = [number, number, number];
export interface WfcView {
  floors: number;
  structure: boolean;
  lights: boolean;
  accent?: string;
  ground?: boolean;
  fine?: boolean;
  lineScale?: number;
  bays?: GeneratedBay[];
  roofOccupied?: Set<number>;
  loading?: boolean;
  afterBay?: (bay: GeneratedBay) => void;
}

/** Fixed isometric projection. Shared faces are removed before facade decoration. */
export function drawWfc(
  ctx: CanvasRenderingContext2D,
  building: WfcBuilding,
  p: Palette,
  width: number,
  height: number,
  view: WfcView,
) {
  const maximum = WFC_STYLES[building.style].height;
  const scale = Math.min(
    (width - 28) / 370,
    (height - 40) / (200 + maximum * 28),
  );
  ctx.save();
  ctx.fillStyle = p.background;
  ctx.fillRect(0, 0, width, height);
  ctx.translate(width / 2, (height + maximum * 28 * scale) / 2 - 80 * scale);
  ctx.scale(scale, scale);
  const project = ([x, y, z]: Point) => [(x - y) * 32, (x + y) * 16 - z * 28];
  paintWfcKit(ctx, building, p, project, { ...view, ground: true });
  ctx.restore();
}

// Shared modular artwork: the lab and city supply their own coordinate projection.
export function paintWfcKit(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  building: WfcBuilding,
  p: Palette,
  project: (point: Point) => number[],
  view: WfcView,
) {
  const accent = view.accent ?? p.materials;
  const lineScale = view.lineScale ?? 1;
  function polygon(points: Point[], color: string, stroke = p.ink) {
    ctx.beginPath();
    points.forEach((point, i) => {
      const [x, y] = project(point);
      if (i) ctx.lineTo(x!, y!);
      else ctx.moveTo(x!, y!);
    });
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 0.65 * lineScale;
    ctx.stroke();
  }
  function line(a: Point, b: Point, color: string, weight = 1) {
    const start = project(a),
      end = project(b);
    ctx.beginPath();
    ctx.moveTo(start[0]!, start[1]!);
    ctx.lineTo(end[0]!, end[1]!);
    ctx.strokeStyle = color;
    ctx.lineWidth = weight * lineScale;
    ctx.stroke();
  }
  if (view.ground) {
    polygon(
      [
        [-0.25, -0.25, -0.12],
        [5.25, -0.25, -0.12],
        [5.25, 5.25, -0.12],
        [-0.25, 5.25, -0.12],
      ],
      p.ground,
    );
    for (let i = 0; i <= 5; i++) {
      line([i, 0, 0], [i, 5, 0], p.edge + '55');
      line([0, i, 0], [5, i, 0], p.edge + '55');
    }
    // The approach stays outside the footprint, aligned with the pinned doorway.
    polygon(
      [
        [2.15, 5, 0],
        [2.85, 5, 0],
        [2.85, 5.25, 0],
        [2.15, 5.25, 0],
      ],
      p.concrete,
    );
  }
  const sliced = {
    ...building,
    heights: building.heights.map((h) => Math.min(h, view.floors)),
  };
  for (const bay of view.bays ?? compileWfcKit(sliced)) {
    const { x, y, floor: z } = bay;
    const top = z + 1;
    const actualRoof = top === building.heights[x + y * building.size];
    function face(right: boolean, u: number, v: number): Point {
      return right ? [x + 1, y + u, z + v] : [x + u, y + 1, z + v];
    }
    function panel(
      right: boolean,
      u0: number,
      u1: number,
      v0: number,
      v1: number,
      color: string,
    ) {
      polygon(
        [
          face(right, u0, v0),
          face(right, u1, v0),
          face(right, u1, v1),
          face(right, u0, v1),
        ],
        color,
      );
    }
    for (const right of [false, true]) {
      if (!(right ? bay.right : bay.front) && !view.structure) continue;
      if (!view.structure) {
        panel(
          right,
          0,
          1,
          0,
          1,
          bay.facade === 'ribs'
            ? right
              ? p.steel
              : p['concrete-shadow']
            : right
              ? p.surface
              : p.steel,
        );
        if (
          !right &&
          (bay.entrance ||
            (view.loading && z === 0 && y === 4 && x > 0 && x < 4))
        ) {
          panel(right, 0.27, 0.73, 0.03, 0.78, p.ink);
          line(
            face(right, 0.27, 0.8),
            face(right, 0.73, 0.8),
            view.lights ? accent : p.edge,
            2,
          );
        } else if (bay.facade === 'louvers') {
          // Recessed air intake, framed by the load-bearing bay edges.
          panel(right, 0.13, 0.87, 0.18, 0.85, p.surface);
          for (let v = 0.25; v < 0.85; v += view.fine === false ? 0.25 : 0.14) {
            panel(right, 0.15, 0.85, v, v + 0.045, p['concrete-shadow']);
            line(
              face(right, 0.15, v - 0.025),
              face(right, 0.85, v - 0.025),
              p.ink,
              0.8,
            );
          }
          if (view.lights && bay.lit)
            line(face(right, 0.2, 0.9), face(right, 0.45, 0.9), accent, 0.7);
        } else if (bay.facade === 'ribs') {
          // Solid insulated enclosure with standing seams and a narrow inspection window.
          for (const u of view.fine === false ? [0.5] : [0.2, 0.4, 0.6, 0.8]) {
            line(face(right, u, 0.12), face(right, u, 0.9), p.surface, 1.5);
            line(
              face(right, u + 0.025, 0.12),
              face(right, u + 0.025, 0.9),
              p.concrete,
              0.6,
            );
          }
          panel(
            right,
            0.22,
            0.78,
            0.68,
            0.83,
            view.lights && bay.lit ? accent + '77' : p.surface,
          );
        } else if (bay.facade === 'clerestory') {
          panel(
            right,
            0.08,
            0.92,
            0.63,
            0.87,
            view.lights && bay.lit ? accent + '99' : p.surface,
          );
          panel(right, 0.1, 0.9, 0.15, 0.52, p['concrete-shadow']);
          line(face(right, 0.5, 0.63), face(right, 0.5, 0.87), p.steel, 1.5);
        } else {
          panel(right, 0.1, 0.9, 0.24, 0.78, p.ink);
          for (let pane = 0; pane < (view.fine === false ? 1 : 4); pane++) {
            const lit = view.lights && bay.lit && (pane + z) % 3 !== 0;
            panel(
              right,
              0.12 + pane * 0.195,
              (view.fine === false ? 0.88 : 0.28) + pane * 0.195,
              0.28,
              0.73,
              lit
                ? (bay.core ? p.power : accent) + (right ? '66' : '99')
                : p.surface,
            );
            if (lit)
              line(
                face(right, 0.13 + pane * 0.195, 0.69),
                face(right, 0.27 + pane * 0.195, 0.69),
                bay.core ? p.power : accent,
                0.7,
              );
          }
          // Solid sill and head panels share the same storey datum.
          line(
            face(right, 0.1, 0.14),
            face(right, 0.9, 0.14),
            p['concrete-shadow'],
            1,
          );
        }
      }
      panel(right, 0, 1, 0, 0.09, p['concrete-shadow']);
      panel(
        right,
        0,
        1,
        0.94,
        1,
        bay.facade === 'glazing' ? p.steel : p['concrete-shadow'],
      );
      for (const u of [0, 1])
        line(face(right, u, 0), face(right, u, 1), p['concrete-shadow'], 2);
      if ((bay.braced || bay.core) && view.fine !== false && z > 0) {
        const brace = bay.core ? p.power : p['concrete-shadow'];
        line(face(right, 0.05, 0.1), face(right, 0.95, 0.92), brace, 1.6);
        if (!bay.core)
          line(face(right, 0.95, 0.1), face(right, 0.05, 0.92), brace, 1.6);
      }
    }
    if (bay.roof || view.structure) {
      polygon(
        [
          [x, y, top],
          [x + 1, y, top],
          [x + 1, y + 1, top],
          [x, y + 1, top],
        ],
        bay.core ? p.steel : p['concrete-shadow'],
        p.edge,
      );
      if (
        bay.roof &&
        actualRoof &&
        !view.roofOccupied?.has(x + y * building.size)
      ) {
        if (bay.roofFinish === 'daylight') {
          // Folded northlight panels admit daylight to the process floor below.
          polygon(
            [
              [x + 0.15, y + 0.15, top + 0.01],
              [x + 0.85, y + 0.15, top + 0.01],
              [x + 0.85, y + 0.6, top + 0.19],
              [x + 0.15, y + 0.6, top + 0.19],
            ],
            p.steel,
            p.edge,
          );
          polygon(
            [
              [x + 0.15, y + 0.6, top + 0.19],
              [x + 0.85, y + 0.6, top + 0.19],
              [x + 0.85, y + 0.85, top + 0.01],
              [x + 0.15, y + 0.85, top + 0.01],
            ],
            view.lights ? accent + '88' : p.surface,
            p.concrete,
          );
        } else if (bay.roofFinish === 'deck') {
          for (let u = 0.2; u < 0.9; u += 0.2)
            line(
              [x + 0.12, y + u, top + 0.01],
              [x + 0.88, y + u, top + 0.01],
              p.steel,
              0.7,
            );
        } else {
          polygon(
            [
              [x + 0.16, y + 0.16, top + 0.01],
              [x + 0.84, y + 0.16, top + 0.01],
              [x + 0.84, y + 0.84, top + 0.01],
              [x + 0.16, y + 0.84, top + 0.01],
            ],
            p.steel,
            p.edge,
          );
        }
      }
      // A perimeter cap and rails only where the adjacent stack ends below this terrace.
      if (
        bay.roof &&
        actualRoof &&
        !view.roofOccupied?.has(x + y * building.size)
      )
        for (const right of [false, true]) {
          if (!(right ? bay.right : bay.front)) continue;
          for (const u of [0.06, 0.5, 0.94])
            line(face(right, u, 1.02), face(right, u, 1.22), p.concrete, 0.85);
          line(
            face(right, 0.06, 1.22),
            face(right, 0.94, 1.22),
            p.concrete,
            0.85,
          );
        }
      if (bay.core) {
        // The stair landing remains visible in a section through the core.
        for (let step = 0; step < 5; step++)
          line(
            [x + 0.25, y + 0.2 + step * 0.12, top + 0.01],
            [x + 0.72, y + 0.2 + step * 0.12, top + 0.01],
            p.power,
            1.4,
          );
      }
    }
    view.afterBay?.(bay);
  }
}
