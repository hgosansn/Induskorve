import { describe, expect, it } from 'vitest';
import { buildStreets } from '../../src/domain/city/streets';
import type { Building, Position } from '../../src/domain/city/model';
import {
  footprintClear,
  streetScenery,
} from '../../src/rendering/canvas/street-scenery';

function layout(reverse = false) {
  const terrain: Position[] = [];
  for (let x = -8; x <= 8; x++)
    for (let y = -8; y <= 8; y++) terrain.push({ x, y });
  if (reverse) terrain.reverse();
  // A preserved legacy road occupant caps the junction; furniture must not enter it.
  const b = { id: 71, x: 0, y: 0, type: 'power', on: true } as Building;
  return buildStreets(
    new Map([['0,0', b]]),
    new Map(terrain.map((p) => [`${p.x},${p.y}`, p])),
  );
}
describe('sparse topology-derived street scenery', () => {
  it('keeps all raised feet on corner pavement and clear of walking routes and other fixtures', () => {
    const l = layout(),
      s = streetScenery(l);
    expect(s.props.length).toBeGreaterThan(5);
    expect(s.props.length).toBeLessThan(l.roads.size * 0.3);
    expect(new Set(s.lamps.map((p) => p.kind)).size).toBe(3);
    expect(new Set(s.props.map((p) => p.kind)).size).toBe(3);
    for (const item of [...s.lamps, ...s.props]) {
      expect(footprintClear(item.footprint, l)).toBe(true);
      const { x, y, w, d } = item.footprint;
      expect(l.roads.has(`${Math.floor(item.x)},${Math.floor(item.y)}`)).toBe(
        true,
      );
      for (const v of [x, x + w, y, y + d]) {
        const f = v - Math.floor(v);
        expect(
          (f >= 0.17 - 1e-6 && f <= 0.23) || (f >= 0.77 && f <= 0.83 + 1e-6),
        ).toBe(true);
      }
    }
    for (const prop of s.props)
      for (const lamp of s.lamps) {
        const a = prop.footprint,
          b = lamp.footprint;
        expect(
          a.x < b.x + b.w + 0.019 &&
            a.x + a.w > b.x - 0.019 &&
            a.y < b.y + b.d + 0.019 &&
            a.y + a.d > b.y - 0.019,
        ).toBe(false);
      }
  });
  it('is order-independent, cached and uses fixture head definitions for real ground targets', () => {
    const l = layout(),
      a = streetScenery(l),
      b = streetScenery(layout(true));
    const sorted = (v: typeof a) =>
      JSON.stringify({
        lamps: [...v.lamps].sort((a, b) => a.x - b.x || a.y - b.y),
        props: [...v.props].sort((a, b) => a.x - b.x || a.y - b.y),
      });
    expect(sorted(a)).toBe(sorted(b));
    expect(streetScenery(l)).toBe(a);
    for (const lamp of a.lamps) {
      expect(lamp.heads).toHaveLength(lamp.kind === 'twin' ? 2 : 1);
      for (const head of lamp.heads) {
        expect(Number.isFinite(lamp.x + head.x)).toBe(true);
        expect(Math.abs(head.x)).toBeLessThanOrEqual(0.26);
        expect(Math.abs(head.y)).toBeLessThanOrEqual(0.26);
      }
    }
  });
});
