import { defaultDraft } from '../../src/domain/city/model';
import { describe, expect, it, vi } from 'vitest';
import { buildStreets, walkingRoute } from '../../src/domain/city/streets';
import {
  tileKey,
  type Building,
  type Position,
} from '../../src/domain/city/model';
import { createFoundingWorld } from '../../src/domain/city/world';
import { projectWorld } from '../../src/rendering/canvas/view-model';
import {
  advanceWalkers,
  syncWalkers,
} from '../../src/rendering/canvas/pedestrians';
import { composeBuilding } from '../../src/rendering/assembly/compose';
vi.mock('../../src/rendering/palette', () => ({
  readPalette: () => ({
    concrete: 'coat',
    power: 'coat',
    materials: 'coat',
    production: 'coat',
  }),
}));
function terrain(size = 5) {
  const result = new Map<string, Position>();
  for (let y = -size; y <= size; y++)
    for (let x = -size; x <= size; x++) result.set(tileKey(x, y), { x, y });
  return result;
}
const plot = (x: number, y: number, id = 1): Building => ({
  x,
  y,
  id,
  type: 'factory',
  on: true,
  creatorId: 'owner',
});

describe('streets and pedestrians', () => {
  it('connects four-way and negative-coordinate junctions, straight sidewalks and blocked road ends', () => {
    const open = buildStreets(new Map(), terrain());
    expect(open.roads.get('0,0')!.arms).toEqual([true, true, true, true]);
    expect(open.roads.get('-4,-4')!.crossings).toEqual([
      true,
      true,
      true,
      true,
    ]);
    expect(open.roads.get('1,0')!.crossings).toEqual([
      false,
      false,
      false,
      false,
    ]);
    expect(open.neighbors.get('1,0:c0')).not.toContain('1,0:c3');
    const blocked = buildStreets(new Map([['1,0', plot(1, 0)]]), terrain());
    expect(blocked.roads.has('1,0')).toBe(false);
    expect(blocked.roads.get('0,0')!.arms).toEqual([true, false, true, true]);
    expect(blocked.roads.get('2,0')!.arms).toEqual([false, true, false, false]);
    expect(blocked.nodes.has('1,0:c0')).toBe(false);
    expect(blocked.neighbors.get('0,0:s1')).toContain('1,0:p8');
  });
  it('uses crossings to change sidewalk sides and routes into interior plots', () => {
    const buildings = new Map([
      ['1,1', plot(1, 1)],
      ['2,1', plot(2, 1, 2)],
      ['2,2', plot(2, 2, 3)],
    ]);
    const layout = buildStreets(buildings, terrain());
    const route = walkingRoute(layout, '1,0:c0', '1,0:c3');
    expect(route.length).toBeGreaterThan(1);
    const journey = ['1,0:c0', ...route];
    expect(
      journey.some((a, i) =>
        layout.edges.some(
          (e) =>
            e.kind === 'crossing' &&
            ((e.a === a && e.b === journey[i + 1]) ||
              (e.b === a && e.a === journey[i + 1])),
        ),
      ),
    ).toBe(true);
    expect(walkingRoute(layout, '1,0:c0', '2,2:stop').at(-1)).toBe('2,2:stop');
    expect(walkingRoute(layout, '1,0:c0', 'missing')).toEqual([]);
    for (const e of layout.edges) {
      const a = layout.nodes.get(e.a)!,
        b = layout.nodes.get(e.b)!;
      expect(Math.min(Math.abs(a.x - b.x), Math.abs(a.y - b.y))).toBeLessThan(
        1e-9,
      );
    }
  });
  it('keeps plot paths clear of every family and installed ground machinery', () => {
    for (const type of ['power', 'factory', 'warehouse'] as const)
      for (const shape of ['block', 'stepped', 'tower'] as const) {
        const b = { ...plot(1, 1), type };
        const layout = buildStreets(new Map([['1,1', b]]), terrain());
        const assembly = composeBuilding({
          ...b,
          h: 85,
          design: { ...defaultDraft.design, shape },
          variant: 0.5,
          stock: 400,
          modules:
            type === 'power'
              ? ['turbine', 'heat-exchanger']
              : type === 'factory'
                ? ['furnace', 'scrubber']
                : ['loading-bay', 'solar-roof'],
        });
        for (const e of layout.edges.filter((e) => e.kind === 'plot')) {
          const a = layout.nodes.get(e.a)!,
            c = layout.nodes.get(e.b)!;
          for (let t = 0; t <= 1; t += 0.05) {
            const x = (a.x + (c.x - a.x) * t - 1) * 12,
              y = (a.y + (c.y - a.y) * t - 1) * 12;
            for (const s of assembly.parts
              .flatMap((p) => p.solids)
              .filter((s) => s.z < 2.5)) {
              expect(
                x > s.x + 1e-6 &&
                  x < s.x + s.w - 1e-6 &&
                  y > s.y + 1e-6 &&
                  y < s.y + s.d - 1e-6,
                `${type} route ${e.a} -> ${e.b}`,
              ).toBe(false);
            }
          }
        }
      }
  });
  it('walks exclusively along graph edges and waits at plot destinations', () => {
    const world = projectWorld(createFoundingWorld());
    const walkers = syncWalkers([], [], world);
    let stopped = false;
    for (let tick = 0; tick < 2400; tick++) {
      advanceWalkers(walkers, world, 0.05);
      for (const w of walkers) {
        const a = world.streets.nodes.get(w.node!)!;
        const b = w.target ? world.streets.nodes.get(w.target)! : a;
        expect(
          Math.hypot(w.x - a.x, w.y - a.y) + Math.hypot(w.x - b.x, w.y - b.y),
        ).toBeCloseTo(Math.hypot(a.x - b.x, a.y - b.y), 7);
        if (a.stop && (w.wait ?? 0) > 0) {
          expect(w.moving).toBe(false);
          stopped = true;
        }
      }
    }
    expect(stopped).toBe(true);
  });
  it('spawns owners on their plot, preserves topology across ticks and repairs paths after placement', () => {
    const snapshot = {
      ...createFoundingWorld(),
      citizens: [{ id: 'owner', name: 'Owner', joinedAt: 0 }],
    };
    snapshot.buildings[0]!.creatorId = 'owner';
    const before = projectWorld(snapshot);
    const walkers = syncWalkers([], snapshot.citizens, before);
    expect(
      before.streets.nodes.get(walkers.find((w) => w.person)!.node!)!.owner,
    ).toBe('owner');
    const next = projectWorld(
      { ...snapshot, economy: { cycle: 1, stockpiles: [] } },
      before,
    );
    expect(next.streets).toBe(before.streets);
    const w = walkers.find((w) => w.ambient)!;
    const n = before.streets.nodes.get(w.node!)!;
    const x = Math.floor(n.x),
      y = Math.floor(n.y);
    const after = projectWorld(
      { ...snapshot, buildings: [...snapshot.buildings, plot(x, y, 999)] },
      next,
    );
    expect(after.streets).not.toBe(next.streets);
    syncWalkers(walkers, snapshot.citizens, after);
    expect(after.streets.nodes.has(w.node!)).toBe(true);
    expect(after.streets.roads.has(tileKey(x, y))).toBe(false);
  });
});
