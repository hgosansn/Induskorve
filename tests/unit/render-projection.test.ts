import { describe, it, expect } from 'vitest';
import { projectWorld } from '../../src/rendering/canvas/view-model';
import type { WorldSnapshot } from '../../src/domain/city/model';
const world: WorldSnapshot = {
  version: 3,
  citizens: [],
  buildings: [
    { id: 0, x: 0, y: 0, type: 'power', on: true },
    { id: 1, x: 1, y: 0, type: 'warehouse', on: true },
  ],
  appearances: [
    { buildingId: 0, height: 70, seed: 0.5 },
    { buildingId: 1, height: 48, seed: 0.4 },
  ],
  economy: { cycle: 0, stockpiles: [{ buildingId: 1, metal: 0 }] },
};
describe('render projection cache lifetime', () => {
  it('retains unchanged buildings across stock ticks while refreshing inventory geometry', () => {
    const before = projectWorld(world);
    const next = projectWorld(
      {
        ...world,
        economy: { cycle: 1, stockpiles: [{ buildingId: 1, metal: 100 }] },
      },
      before,
    );
    expect(next.buildings.get('0,0')).toBe(before.buildings.get('0,0'));
    expect(next.buildings.get('1,0')).not.toBe(before.buildings.get('1,0'));
    expect(next.buildings.get('1,0')!.stock).toBe(100);
    expect(before.buildings.get('1,0')!.stock).toBe(0);
    expect(next.net.get(next.buildings.get('1,0')!)!.power).toBe(
      next.buildings.get('0,0'),
    );
  });
  it('invalidates edited appearances and refreshes dependent activity after an outage', () => {
    const before = projectWorld(world);
    const after = projectWorld(
      {
        ...world,
        buildings: world.buildings.map((b) =>
          b.id === 0 ? { ...b, on: false } : b,
        ),
        appearances: world.appearances.map((a) =>
          a.buildingId === 0 ? { ...a, seed: 0.9 } : a,
        ),
      },
      before,
    );
    expect(after.buildings.get('0,0')).not.toBe(before.buildings.get('0,0'));
    expect(after.buildings.get('0,0')!.variant).toBe(0.9);
    expect(after.buildings.get('1,0')).toBe(before.buildings.get('1,0'));
    expect(after.net.get(after.buildings.get('1,0')!)!.active).toBe(false);
    expect(before.buildings.get('0,0')!.on).toBe(true);
  });
});
