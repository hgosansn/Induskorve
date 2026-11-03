import type { StreetLayout } from '../../domain/city/streets';
import type { Position } from '../../domain/city/model';

export type LampKind = 'cantilever' | 'twin' | 'capped';
export type PropKind = 'cabinet' | 'route-post' | 'bollard';
export interface Footprint {
  x: number;
  y: number;
  w: number;
  d: number;
}
export interface LampFixture extends Position {
  kind: LampKind;
  corner: number;
  height: number;
  heads: Position[];
  footprint: Footprint;
}
export interface StreetProp extends Position {
  kind: PropKind;
  corner: number;
  footprint: Footprint;
}
export interface StreetScenery {
  lamps: LampFixture[];
  props: StreetProp[];
}
export const WALK_CLEARANCE = 0.04;
const cache = new WeakMap<StreetLayout, StreetScenery>();
export function streetHash(x: number, y: number, salt = 0) {
  let h = Math.imul(x ^ 0x45d9f3b, 0x45d9f3b) ^ Math.imul(y ^ salt, 0x27d4eb2d);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  return (h ^ (h >>> 16)) >>> 0;
}
export function lampFixture(
  position: Position,
  layout: StreetLayout,
): LampFixture {
  const x = Math.floor(position.x),
    y = Math.floor(position.y);
  const road = layout.roads.get(`${x},${y}`);
  const degree = road?.arms.filter(Boolean).length ?? 0;
  const straight = degree === 2 && road?.arms[0] === road?.arms[2];
  const sx = position.x - x < 0.5 ? 1 : -1,
    sy = position.y - y < 0.5 ? 1 : -1;
  const corner = sx === 1 ? (sy === 1 ? 0 : 3) : sy === 1 ? 1 : 2;
  const kind: LampKind =
    degree >= 3
      ? 'twin'
      : degree <= 1 ||
          !straight ||
          streetHash(Math.floor(x / 4), Math.floor(y / 4), 73) % 3 === 0
        ? 'capped'
        : 'cantilever';
  const height = kind === 'twin' ? 19 : kind === 'capped' ? 13.5 : 17;
  const heads =
    kind === 'twin'
      ? [
          { x: sx * 0.24, y: 0 },
          { x: 0, y: sy * 0.24 },
        ]
      : kind === 'capped'
        ? [{ x: 0, y: 0 }]
        : road?.arms[0] || road?.arms[2]
          ? [{ x: sx * 0.26, y: 0 }]
          : [{ x: 0, y: sy * 0.26 }];
  return {
    ...position,
    kind,
    corner,
    height,
    heads,
    footprint: {
      x: position.x - 0.022,
      y: position.y - 0.022,
      w: 0.044,
      d: 0.044,
    },
  };
}
function segmentHits(a: Position, b: Position, r: Footprint, margin: number) {
  let low = 0,
    high = 1;
  for (const [v, d, min, max] of [
    [a.x, b.x - a.x, r.x - margin, r.x + r.w + margin],
    [a.y, b.y - a.y, r.y - margin, r.y + r.d + margin],
  ]) {
    if (Math.abs(d!) < 1e-9) {
      if (v! < min! || v! > max!) return false;
    } else {
      const t0 = (min! - v!) / d!,
        t1 = (max! - v!) / d!;
      low = Math.max(low, Math.min(t0, t1));
      high = Math.min(high, Math.max(t0, t1));
      if (low > high) return false;
    }
  }
  return true;
}
export function footprintClear(r: Footprint, layout: StreetLayout) {
  return !layout.edges.some((edge) =>
    segmentHits(
      layout.nodes.get(edge.a)!,
      layout.nodes.get(edge.b)!,
      r,
      WALK_CLEARANCE,
    ),
  );
}
const overlaps = (a: Footprint, b: Footprint, gap = 0.02) =>
  a.x < b.x + b.w + gap &&
  a.x + a.w > b.x - gap &&
  a.y < b.y + b.d + gap &&
  a.y + a.d > b.y - gap;

/** One topology-derived art layout; appearance/production updates reuse it. */
export function streetScenery(layout: StreetLayout): StreetScenery {
  const previous = cache.get(layout);
  if (previous) return previous;
  const lamps = layout.lamps.map((p) => lampFixture(p, layout));
  // Bucket path segments once; each candidate examines only its local cells.
  const buckets = new Map<string, typeof layout.edges>();
  for (const edge of layout.edges) {
    const a = layout.nodes.get(edge.a)!,
      b = layout.nodes.get(edge.b)!;
    for (
      let x = Math.floor(Math.min(a.x, b.x) - 0.1);
      x <= Math.floor(Math.max(a.x, b.x) + 0.1);
      x++
    )
      for (
        let y = Math.floor(Math.min(a.y, b.y) - 0.1);
        y <= Math.floor(Math.max(a.y, b.y) + 0.1);
        y++
      ) {
        const key = `${x},${y}`,
          list = buckets.get(key) ?? [];
        list.push(edge);
        buckets.set(key, list);
      }
  }
  const props: StreetProp[] = [];
  for (const road of layout.roads.values()) {
    const seed = streetHash(road.x, road.y, 107);
    if (seed % 5 !== 0) continue;
    const kind: PropKind = (['cabinet', 'route-post', 'bollard'] as const)[
      Math.floor(seed / 5) % 3
    ]!;
    for (let attempt = 0; attempt < 4; attempt++) {
      const corner = (Math.floor(seed / 17) + attempt) % 4;
      const [dx, dy] = [
        [0.195, 0.195],
        [0.805, 0.195],
        [0.805, 0.805],
        [0.195, 0.805],
      ][corner]!;
      const x = road.x + dx!,
        y = road.y + dy!,
        width = kind === 'cabinet' ? 0.045 : 0.032;
      const footprint = {
        x: x - width / 2,
        y: y - width / 2,
        w: width,
        d: width,
      };
      if (lamps.some((p) => overlaps(footprint, p.footprint))) continue;
      const edges = buckets.get(`${road.x},${road.y}`) ?? [];
      if (
        edges.some((e) =>
          segmentHits(
            layout.nodes.get(e.a)!,
            layout.nodes.get(e.b)!,
            footprint,
            WALK_CLEARANCE,
          ),
        )
      )
        continue;
      props.push({ x, y, kind, corner, footprint });
      break;
    }
  }
  const result = { lamps, props };
  cache.set(layout, result);
  return result;
}
