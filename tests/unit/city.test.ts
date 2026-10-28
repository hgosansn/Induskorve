import { advanceProduction } from '../../src/domain/city/production';
import {
  projectWorld,
  projectPlacement,
} from '../../src/rendering/canvas/view-model';
import { describe, expect, it } from 'vitest';
import {
  createFoundingWorld,
  joinLocalCity,
  placeBuilding,
  toggleBuilding,
  setBillboard,
  configureModules,
  dispatchMetal,
} from '../../src/domain/city/world';
import {
  worldSchema,
  defaultDraft,
  draftSchema,
  type WorldSnapshot,
} from '../../src/domain/city/model';
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
    expect(() =>
      placeBuilding(world, 'alice', 'power', { x: 0, y: 1 }),
    ).toThrow('roads');
    const next = placeBuilding(world, 'alice', 'power', { x: 1, y: 1 });
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

describe('composable industry', () => {
  it('makes furnace demand and nearby recovered heat change actual production', () => {
    let world = chain();
    world.buildings[2] = { ...world.buildings[2]!, x: 1, y: 1 };
    world = configureModules(world, 'alice', 0, ['heat-exchanger']);
    world = configureModules(world, 'alice', 2, ['furnace']);
    const network = calculateNetworks(world.buildings);
    expect(network.services.get(2)).toMatchObject({
      demand: 18,
      output: 22,
      heatId: 0,
    });
    expect(advanceProduction(world).economy?.stockpiles).toEqual([
      { buildingId: 1, metal: 22 },
    ]);
    const far = {
      ...world,
      buildings: world.buildings.map((b) =>
        b.id === 2 ? { ...b, x: 2, y: 1 } : b,
      ),
    };
    expect(calculateNetworks(far.buildings).services.get(2)?.output).toBe(18);
    expect(
      advanceProduction(toggleBuilding(world, 'alice', 0)).economy
        ?.stockpiles[0]?.metal,
    ).toBe(0);
  });
  it('allocates added turbine capacity and prioritizes logistics', () => {
    const world = chain();
    world.buildings = [
      world.buildings[0]!,
      ...Array.from({ length: 8 }, (_, i) => ({
        id: i + 1,
        x: (i % 3) + 1,
        y: Math.floor(i / 3),
        type: 'factory' as const,
        on: true,
      })),
      { id: 20, x: 0, y: 1, type: 'warehouse', on: true },
    ];
    const base = calculateNetworks(world.buildings);
    expect(base.services.get(20)?.powered).toBe(true);
    expect(base.services.get(0)?.load).toBe(78);
    const expanded = calculateNetworks(
      configureModules(world, 'alice', 0, ['turbine']).buildings,
    );
    expect(expanded.services.get(0)?.load).toBe(102);
    expect(expanded.services.get(8)?.active).toBe(true);
  });
  it('stores bounded production, stops when full, dispatches and resumes without losing saves', () => {
    let world = chain();
    for (let i = 0; i < 20; i++) world = advanceProduction(world);
    expect(world.economy?.stockpiles[0]?.metal).toBe(200);
    expect(
      calculateNetworks(
        world.buildings,
        world.economy?.stockpiles,
      ).services.get(2),
    ).toMatchObject({ active: false, storageFull: true, output: 0 });
    expect(() => dispatchMetal(world, null, 1)).toThrow('Join');
    const restored = worldSchema.parse(JSON.parse(JSON.stringify(world)));
    const shipped = dispatchMetal(restored, 'alice', 1);
    expect(shipped.economy?.shippedMetal).toBe(200);
    expect(advanceProduction(shipped).economy?.stockpiles[0]?.metal).toBe(12);
    expect(world.economy?.stockpiles[0]?.metal).toBe(200);
  });
  it('does not discard inventory when removing a loading bay', () => {
    let world = configureModules(chain(), 'alice', 1, ['loading-bay']);
    for (let i = 0; i < 20; i++) world = advanceProduction(world);
    expect(() => configureModules(world, 'alice', 1, [])).toThrow('Dispatch');
    expect(
      configureModules(dispatchMetal(world, 'alice', 1), 'alice', 1, [])
        .buildings[1]?.modules,
    ).toEqual([]);
  });
  it('rejects incompatible or duplicate machinery while retaining old worlds', () => {
    expect(worldSchema.safeParse(chain()).success).toBe(true);
    expect(() => configureModules(chain(), 'alice', 2, ['turbine'])).toThrow();
    expect(() =>
      configureModules(chain(), 'alice', 0, ['turbine', 'turbine']),
    ).toThrow();
    expect(
      draftSchema.safeParse({ ...defaultDraft, modules: ['solar-roof'] })
        .success,
    ).toBe(false);
    const world = chain();
    world.buildings[2]!.modules = ['loading-bay'];
    expect(worldSchema.safeParse(world).success).toBe(false);
  });
  it('reduces the local ground footprint with a scrubber and removes it during outages', () => {
    const world = chain();
    const raw = projectWorld(world).terrain.get('2,0')!.exposure!;
    const scrubbed = projectWorld(
      configureModules(world, 'alice', 2, ['scrubber']),
    ).terrain.get('2,0')!.exposure!;
    expect(raw - scrubbed).toBeCloseTo(3);
    expect(
      projectWorld(toggleBuilding(world, 'alice', 0)).terrain.get('2,0')
        ?.exposure ?? 0,
    ).toBe(0);
  });
  it('forecasts the same services as placement without changing the saved world', () => {
    const world = chain();
    const before = JSON.stringify(world);
    const draft = { ...defaultDraft, modules: ['furnace' as const] };
    const forecast = projectPlacement(world, draft, { x: 1, y: 1 });
    const placed = placeBuilding(
      world,
      'alice',
      'factory',
      { x: 1, y: 1 },
      draft,
    );
    const actual = calculateNetworks(placed.buildings).services.get(
      forecast!.building.id,
    );
    expect(forecast?.service.output).toBe(actual?.output);
    expect(forecast?.service.demand).toBe(18);
    expect(JSON.stringify(world)).toBe(before);
    expect(projectPlacement(world, draft, { x: 0, y: 0 })).toBeUndefined();
  });
});
