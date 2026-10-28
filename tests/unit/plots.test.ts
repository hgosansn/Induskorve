import { describe, expect, it } from 'vitest';
import {
  isRoadCorridor,
  relocateFoundingStation,
} from '../../src/domain/city/plots';
import { createFoundingWorld } from '../../src/domain/city/world';
import { createCityStore } from '../../src/application/city-store';
import {
  projectPlacement,
  projectWorld,
} from '../../src/rendering/canvas/view-model';
import { defaultDraft } from '../../src/domain/city/model';

describe('reserved roads and founding-station repair', () => {
  it('starts a new city with a clear origin crossroads and no building on a road', () => {
    const world = createFoundingWorld();
    expect(world.buildings.some(isRoadCorridor)).toBe(false);
    expect(projectWorld(world).streets.roads.get('0,0')?.arms).toEqual([
      true,
      true,
      true,
      true,
    ]);
  });
  it('relocates only the founding station into a free plot, preserves every record and is idempotent', () => {
    const initial = createFoundingWorld();
    const old = {
      ...initial,
      buildings: initial.buildings.map((b) =>
        b.id === 0
          ? { ...b, x: 0, y: 0, modules: ['turbine'] as 'turbine'[] }
          : b,
      ),
    };
    const repaired = relocateFoundingStation(old);
    const station = repaired.buildings.find((b) => b.id === 0)!;
    expect(isRoadCorridor(station)).toBe(false);
    expect(station.modules).toEqual(['turbine']);
    expect(repaired.buildings).toHaveLength(old.buildings.length);
    expect(new Set(repaired.buildings.map((b) => `${b.x},${b.y}`)).size).toBe(
      repaired.buildings.length,
    );
    expect(repaired.appearances).toBe(old.appearances);
    expect(repaired.buildings.filter((b) => b.id !== 0)).toEqual(
      old.buildings.filter((b) => b.id !== 0),
    );
    expect(old.buildings.find((b) => b.id === 0)).toMatchObject({ x: 0, y: 0 });
    expect(relocateFoundingStation(repaired)).toBe(repaired);
    const authored = {
      ...old,
      buildings: old.buildings.map((b) => ({ ...b, creatorId: 'citizen' })),
    };
    expect(relocateFoundingStation(authored)).toBe(authored);
  });
  it('repairs a loaded city without writing on read, then persists the repair on the next action', () => {
    const initial = createFoundingWorld();
    const old = {
      ...initial,
      buildings: initial.buildings.map((b) =>
        b.id === 0 ? { ...b, x: 0, y: 0 } : b,
      ),
    };
    const saves: unknown[] = [];
    const store = createCityStore({
      load: () => ({ world: old }),
      save: (w) => {
        saves.push(w);
      },
    });
    expect(saves).toEqual([]);
    expect(
      store.getState().world.buildings.some((b) => b.x === 0 && b.y === 0),
    ).toBe(false);
    store.getState().join('Builder');
    expect(saves).toHaveLength(1);
  });
  it('rejects road forecasts at positive and negative coordinates', () => {
    const world = createFoundingWorld();
    for (const p of [
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: -4, y: 1 },
    ])
      expect(projectPlacement(world, defaultDraft, p)).toBeUndefined();
  });
});
