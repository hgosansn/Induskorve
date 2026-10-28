import { describe, expect, it } from 'vitest';
import {
  createFoundingWorld,
  joinLocalCity,
  placeBuilding,
  toggleBuilding,
  setBillboard,
} from '../../src/domain/city/world';
import { worldSchema, type WorldSnapshot } from '../../src/domain/city/model';
import { calculateNetworks } from '../../src/domain/city/networks';
import { revealedTerrain } from '../../src/domain/city/terrain';
import {
  LocalCityRepository,
  LEGACY_KEY,
  SAVE_KEY,
} from '../../src/infrastructure/persistence/local-city-repository';
import { createCityStore } from '../../src/application/city-store';
import {
  chunkKey,
  mapBuildingRow,
  liveConfigurationSchema,
} from '../../src/infrastructure/spacetimedb/contracts';

function chain(): WorldSnapshot {
  return {
    version: 3,
    citizens: [{ id: 'alice', name: 'Alice' }],
    buildings: [
      { id: 0, x: 0, y: 0, type: 'power', on: true },
      { id: 1, x: 1, y: 0, type: 'warehouse', on: true },
      { id: 2, x: 2, y: 0, type: 'factory', on: true },
    ],
    appearances: [0, 1, 2].map((buildingId) => ({
      buildingId,
      height: 35,
      seed: 0.5,
    })),
  };
}
describe('city domain', () => {
  it('preserves a deterministic founding city and valid separate appearances', () => {
    expect(createFoundingWorld()).toEqual(createFoundingWorld());
    expect(worldSchema.safeParse(createFoundingWorld()).success).toBe(true);
    expect(createFoundingWorld().buildings[0]).not.toHaveProperty('height');
  });
  it('reveals a union of local disks, never the intervening global circle', () => {
    const terrain = revealedTerrain([
      { x: 0, y: 0 },
      { x: 30, y: 0 },
    ]);
    expect(terrain.has('30,1')).toBe(true);
    expect(terrain.has('15,0')).toBe(false);
    expect(terrain.has('3,0')).toBe(false);
  });
  it('powers a storage/production chain and propagates an outage', () => {
    const world = chain();
    const n = calculateNetworks(world.buildings);
    expect(n.services.get(0)?.load).toBe(18);
    expect(n.services.get(2)?.active).toBe(true);
    const paused = toggleBuilding(world, 'alice', 0);
    expect(calculateNetworks(paused.buildings).services.get(2)?.active).toBe(
      false,
    );
  });
  it('stops a powered foundry without storage', () => {
    const world = chain();
    world.buildings = world.buildings.filter((b) => b.type !== 'warehouse');
    const n = calculateNetworks(world.buildings).services.get(2);
    expect(n?.powered).toBe(true);
    expect(n?.active).toBe(false);
  });
  it('enforces plant capacity and distance', () => {
    const world = chain();
    world.buildings = world.buildings.filter((b) => b.id !== 2);
    for (let i = 2; i < 12; i++)
      world.buildings.push({
        id: i,
        x: (i % 3) + 1,
        y: Math.floor(i / 3) - 1,
        type: 'factory',
        on: true,
      });
    world.buildings.push({ id: 99, x: 50, y: 50, type: 'warehouse', on: true });
    const n = calculateNetworks(world.buildings);
    expect(n.services.get(0)!.load).toBeLessThanOrEqual(80);
    expect(n.services.get(99)?.powered).toBe(false);
  });
  it('requires a joined citizen and empty revealed ground for construction', () => {
    const world = chain();
    expect(() => placeBuilding(world, null, 'factory', { x: 0, y: 1 })).toThrow(
      'Join',
    );
    expect(() =>
      placeBuilding(world, 'alice', 'power', { x: 0, y: 0 }),
    ).toThrow('empty');
    expect(() =>
      placeBuilding(world, 'alice', 'power', { x: 100, y: 0 }),
    ).toThrow('empty');
    const next = placeBuilding(world, 'alice', 'power', { x: 0, y: 1 });
    expect(next.buildings.at(-1)?.creatorId).toBe('alice');
    expect(world.buildings).toHaveLength(3);
  });
  it('keeps visual changes separate from gameplay', () => {
    const world = chain();
    const next = setBillboard(
      world,
      'alice',
      0,
      'data:image/png;base64,aGVsbG8=',
    );
    expect(next.buildings).toBe(world.buildings);
    expect(next.appearances[0]?.billboard).toContain('data:image/png');
    expect(() =>
      setBillboard(world, 'alice', 0, 'javascript:alert(1)'),
    ).toThrow();
  });
  it('validates coordinates and citizen names at the command boundary', () => {
    expect(() =>
      placeBuilding(chain(), 'alice', 'power', { x: NaN, y: 0 }),
    ).toThrow();
    expect(() => joinLocalCity(chain(), '   ', 'new')).toThrow();
    expect(joinLocalCity(chain(), 'ALICE', 'new').citizen.id).toBe('alice');
  });
  it('rejects duplicate identities, cells and missing appearance records', () => {
    const w = chain();
    expect(worldSchema.safeParse({ ...w, appearances: [] }).success).toBe(
      false,
    );
    expect(
      worldSchema.safeParse({
        ...w,
        buildings: [...w.buildings, w.buildings[0]],
      }).success,
    ).toBe(false);
  });
});
function storage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
  };
}
describe('save integrity', () => {
  it('migrates the old key without deleting or overwriting it', () => {
    const raw = JSON.stringify({
      buildings: [
        {
          id: 0,
          x: 0,
          y: 0,
          type: 'power',
          h: 85,
          on: true,
          variant: 0.6,
          adImage: 'data:image/png;base64,aGVsbG8=',
        },
      ],
      citizens: [{ id: 'a', name: 'Alice' }],
    });
    const memory = storage({ [LEGACY_KEY]: raw });
    const repo = new LocalCityRepository(memory);
    const loaded = repo.load();
    expect(loaded.world?.appearances[0]?.height).toBe(85);
    repo.save(loaded.world!);
    expect(memory.getItem(LEGACY_KEY)).toBe(raw);
    expect(memory.getItem(SAVE_KEY)).not.toBeNull();
  });
  it('preserves corrupt data and prevents autosave over it', () => {
    const memory = storage({ [SAVE_KEY]: 'broken' });
    const store = createCityStore(new LocalCityRepository(memory));
    expect(store.getState().warning).toContain('preserved');
    store.getState().join('Alice');
    expect(memory.getItem(SAVE_KEY)).toBe('broken');
  });
  it('handles a storage quota error while keeping the session usable', () => {
    const store = createCityStore({
      load: () => ({ world: chain() }),
      save: () => {
        throw new Error('quota');
      },
    });
    store.getState().join('Bob');
    expect(store.getState().world.citizens).toHaveLength(2);
    expect(store.getState().warning).toContain('full');
  });
  it('never restores edit authority from a saved name', () => {
    const store = createCityStore({
      load: () => ({ world: chain() }),
      save: () => {},
    });
    expect(store.getState().citizenId).toBeNull();
    store.getState().setTool('power');
    expect(store.getState().tool).toBe('inspect');
    expect(() => store.getState().toggle(0)).toThrow('Join');
  });
});
describe('live integration contracts', () => {
  it('uses floor division for negative chunk positions', () => {
    expect(chunkKey(-1, -17)).toBe('-1,-2');
  });
  it('retains bigint IDs beyond the JS safe integer limit', () => {
    const id = 9_007_199_254_740_993n;
    const mapped = mapBuildingRow({
      id,
      x: -1,
      y: 0,
      cellKey: '-1,0',
      chunkKey: '-1,0',
      kind: 'factory',
      enabled: true,
      creator: 'a'.repeat(64),
      revision: 1n,
    });
    expect(mapped.id).toBe(id);
  });
  it('rejects invalid spatial keys', () => {
    expect(() =>
      mapBuildingRow({
        id: 1n,
        x: 0,
        y: 0,
        cellKey: '1,0',
        chunkKey: '0,0',
        kind: 'factory',
        enabled: true,
        creator: 'a'.repeat(64),
        revision: 1n,
      }),
    ).toThrow();
  });
  it('requires TLS outside local development', () => {
    expect(
      liveConfigurationSchema.safeParse({
        uri: 'ws://example.com',
        database: 'city',
      }).success,
    ).toBe(false);
    expect(
      liveConfigurationSchema.safeParse({
        uri: 'http://localhost:3000',
        database: 'city',
      }).success,
    ).toBe(true);
  });
});
