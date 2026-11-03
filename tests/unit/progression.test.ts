import { describe, expect, it } from 'vitest';
import { applyCityCommand } from '../../src/domain/city/commands';
import { validateContentDefinitions } from '../../src/domain/city/content-validation';
import {
  BUILDINGS,
  acceptsExchange,
  buildingStats,
} from '../../src/domain/city/catalog';
import { compatiblePorts } from '../../src/domain/city/exchanges';
import { cityOverview } from '../../src/domain/city/guidance';
import { worldSchema, type WorldSnapshot } from '../../src/domain/city/model';
import {
  availableStock,
  contributeToProject,
  dispatchAllMetal,
  hasCapability,
  projectStatus,
} from '../../src/domain/city/progression';
import {
  LocalCityRepository,
  SAVE_KEY,
} from '../../src/infrastructure/persistence/local-city-repository';
import { createCityStore } from '../../src/application/city-store';

function city(): WorldSnapshot {
  return {
    version: 3,
    citizens: [
      { id: 'mira', name: 'Mira' },
      { id: 'sol', name: 'Sol' },
    ],
    buildings: [
      { id: 0, x: 1, y: 1, type: 'power', on: true },
      {
        id: 1,
        x: 2,
        y: 1,
        type: 'warehouse',
        on: true,
        modules: ['loading-bay'],
      },
      { id: 2, x: 3, y: 1, type: 'factory', on: true },
      { id: 3, x: 2, y: 2, type: 'warehouse', on: true },
    ],
    appearances: [0, 1, 2, 3].map((buildingId) => ({
      buildingId,
      height: 40,
      seed: 0.5,
    })),
    economy: {
      cycle: 5,
      shippedMetal: 11,
      stockpiles: [
        { buildingId: 1, metal: 300 },
        { buildingId: 3, metal: 190 },
      ],
    },
  };
}
const balance = (w: WorldSnapshot) =>
  (w.economy?.stockpiles.reduce((sum, s) => sum + s.metal, 0) ?? 0) +
  (w.economy?.shippedMetal ?? 0) +
  (w.progression?.projects.reduce((sum, p) => sum + p.delivered, 0) ?? 0);

describe('content contracts and guided city progression', () => {
  it('rejects single-warehouse dispatch overflow without losing stock', () => {
    const world = city();
    world.economy!.shippedMetal = Number.MAX_SAFE_INTEGER - 1;
    expect(() =>
      applyCityCommand(world, 'mira', { type: 'dispatch', buildingId: 1 }),
    ).toThrow('limit');
    expect(world.economy!.stockpiles[0]!.metal).toBe(300);
  });
  it('validates catalog references, ports and technology prerequisites', () => {
    expect(() => validateContentDefinitions()).not.toThrow();
    expect(acceptsExchange('power', 'factory', 'power')).toBe(true);
    expect(acceptsExchange('warehouse', 'factory', 'materials')).toBe(false);
    expect(
      compatiblePorts(
        { id: 'a', exchange: 'power', direction: 'output' },
        {
          id: 'b',
          exchange: 'materials',
          direction: 'input',
          resource: 'metal',
        },
      ),
    ).toBe(false);
    expect(
      buildingStats({ ...city().buildings[2]!, modules: ['furnace'] }).output,
    ).toBe(BUILDINGS.factory.output + 6);
  });
  it('previews through the same pure command, preserves material and attributes partial contributions', () => {
    const world = city(),
      copy = structuredClone(world);
    const command = {
      type: 'contribute' as const,
      projectId: 'freight-coordination' as const,
      sources: [{ warehouseId: 1, amount: 60 }],
    };
    const preview = applyCityCommand(world, 'mira', command);
    expect(world).toEqual(copy);
    expect(balance(preview)).toBe(balance(world));
    expect(projectStatus(preview, 'freight-coordination').contributors).toEqual(
      [{ citizenId: 'mira', amount: 60 }],
    );
    const store = createCityStore({ load: () => ({ world }), save: () => {} });
    store.getState().join('Mira');
    store.getState().perform(command);
    expect(store.getState().world).toEqual(preview);
    const next = contributeToProject(preview, 'sol', 'freight-coordination', [
      { warehouseId: 3, amount: 100 },
    ]);
    expect(hasCapability(next, 'pooled-funding')).toBe(true);
    expect(
      projectStatus(next, 'freight-coordination').contributors,
    ).toHaveLength(2);
    expect(() =>
      contributeToProject(next, 'mira', 'freight-coordination', [
        { warehouseId: 1, amount: 1 },
      ]),
    ).toThrow('already complete');
  });
  it('rejects unauthorized, unavailable, duplicate, excessive and fractional transfers atomically', () => {
    const world = city(),
      before = JSON.stringify(world);
    for (const sources of [
      [],
      [{ warehouseId: 1, amount: -1 }],
      [{ warehouseId: 1, amount: 0.5 }],
      [{ warehouseId: 2, amount: 1 }],
      [{ warehouseId: 1, amount: 161 }],
      [
        { warehouseId: 1, amount: 1 },
        { warehouseId: 1, amount: 1 },
      ],
    ])
      expect(() =>
        contributeToProject(world, 'mira', 'freight-coordination', sources),
      ).toThrow();
    expect(() =>
      contributeToProject(world, null, 'freight-coordination', [
        { warehouseId: 1, amount: 1 },
      ]),
    ).toThrow('Join');
    expect(() =>
      contributeToProject(world, 'mira', 'materials-exchange', [
        { warehouseId: 1, amount: 1 },
      ]),
    ).toThrow('prerequisite');
    expect(() =>
      contributeToProject(world, 'mira', 'freight-coordination', [
        { warehouseId: 1, amount: 1 },
        { warehouseId: 3, amount: 1 },
      ]),
    ).toThrow('Shared procurement');
    const paused = {
      ...world,
      buildings: world.buildings.map((b) =>
        b.id === 0 ? { ...b, on: false } : b,
      ),
    };
    expect(availableStock(paused)).toEqual([]);
    expect(() =>
      contributeToProject(paused, 'mira', 'freight-coordination', [
        { warehouseId: 1, amount: 1 },
      ]),
    ).toThrow('powered warehouse');
    expect(JSON.stringify(world)).toBe(before);
  });
  it('unlocks pooled funding then coordinated dispatch without creating metal', () => {
    let world = city();
    expect(() => dispatchAllMetal(world, 'mira')).toThrow('unlock');
    world = contributeToProject(world, 'mira', 'freight-coordination', [
      { warehouseId: 1, amount: 160 },
    ]);
    world = contributeToProject(world, 'sol', 'materials-exchange', [
      { warehouseId: 1, amount: 140 },
      { warehouseId: 3, amount: 180 },
    ]);
    expect(hasCapability(world, 'dispatch-all')).toBe(true);
    const dispatched = dispatchAllMetal(world, 'mira');
    expect(dispatched.economy?.shippedMetal).toBe(21);
    expect(balance(dispatched)).toBe(balance(city()));
    expect(availableStock(dispatched)).toHaveLength(0);
    expect(worldSchema.safeParse(dispatched).success).toBe(true);
  });
  it('rejects a stale forecast when another contribution completes the project', () => {
    const world = city();
    const stale = {
      type: 'contribute' as const,
      projectId: 'freight-coordination' as const,
      sources: [{ warehouseId: 3, amount: 150 }],
    };
    expect(() => applyCityCommand(world, 'sol', stale)).not.toThrow();
    const changed = contributeToProject(world, 'mira', 'freight-coordination', [
      { warehouseId: 1, amount: 160 },
    ]);
    expect(() => applyCityCommand(changed, 'sol', stale)).toThrow('complete');
    expect(changed.economy?.stockpiles[1]?.metal).toBe(190);
  });
  it('uses actual available warehouse space in next-cycle forecasts', () => {
    const world = city();
    world.economy!.stockpiles[0]!.metal = 398;
    expect(cityOverview(world).nextCycleMetal).toBe(2);
  });
  it('roundtrips optional progression while preserving old and corrupt saves', () => {
    const memory = new Map<string, string>();
    const repository = new LocalCityRepository({
      getItem: (key) => memory.get(key) ?? null,
      setItem: (key, value) => {
        memory.set(key, value);
      },
    });
    repository.save(city());
    expect(repository.load().world?.progression).toBeUndefined();
    const world = contributeToProject(city(), 'mira', 'freight-coordination', [
      { warehouseId: 1, amount: 160 },
    ]);
    repository.save(world);
    expect(repository.load().world).toEqual(world);
    const broken = structuredClone(world);
    broken.progression!.projects[0]!.contributors[0]!.amount = 159;
    const raw = JSON.stringify(broken);
    memory.set(SAVE_KEY, raw);
    const store = createCityStore(repository);
    store.getState().join('Temporary');
    store.getState().tick();
    expect(memory.get(SAVE_KEY)).toBe(raw);
    expect(store.getState().warning).toContain('preserved');
  });
  it('keeps a bounded ordered history without duplicating unlock rewards', () => {
    const store = createCityStore({
      load: () => ({ world: city() }),
      save: () => {},
    });
    store.getState().join('Mira');
    for (let i = 0; i < 125; i++) store.getState().toggle(2);
    const world = store.getState().world;
    expect(world.progression?.events).toHaveLength(120);
    expect(world.progression?.events[0]?.id).toBe(5);
    expect(worldSchema.safeParse(world).success).toBe(true);
  });
});
