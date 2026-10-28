import { create } from 'zustand';
import type { CityRepository } from './city-repository';
import {
  createFoundingWorld,
  joinLocalCity,
  placeBuilding,
  setBillboard,
  toggleBuilding,
} from '../domain/city/world';
import type {
  BuildingKind,
  NetworkLayer,
  Position,
  Tool,
  WorldSnapshot,
} from '../domain/city/model';

export interface CityState {
  world: WorldSnapshot;
  citizenId: string | null;
  selectedId: number | null;
  tool: Tool;
  layer: NetworkLayer;
  grid: boolean;
  warning: string | null;
  join(name: string): void;
  leave(): void;
  select(id: number | null): void;
  setTool(tool: Tool): void;
  setLayer(layer: NetworkLayer): void;
  toggleGrid(): void;
  cancel(): void;
  place(position: Position): void;
  toggle(id: number): void;
  billboard(id: number, source?: string): void;
}
export function createCityStore(repository: CityRepository) {
  const loaded = repository.load();
  return create<CityState>((set, get) => {
    const commit = (world: WorldSnapshot) => {
      // Storage failure must never interrupt a city action or replace the previous save.
      let warning = get().warning;
      if (!loaded.readOnly) {
        try {
          repository.save(world);
        } catch {
          warning =
            'Browser storage unavailable or full. Changes last for this visit.';
        }
      }
      set({ world, warning });
    };
    return {
      world: loaded.world ?? createFoundingWorld(),
      citizenId: null,
      selectedId: null,
      tool: 'inspect',
      layer: 'all',
      grid: false,
      warning: loaded.warning ?? null,
      join(name) {
        const result = joinLocalCity(get().world, name, crypto.randomUUID());
        commit(result.world);
        set({ citizenId: result.citizen.id, selectedId: null });
      },
      leave() {
        set({ citizenId: null, tool: 'inspect', selectedId: null });
      },
      select(selectedId) {
        set({ selectedId });
      },
      setTool(tool) {
        set({ tool: get().citizenId ? tool : 'inspect' });
      },
      setLayer(layer) {
        set({ layer });
      },
      toggleGrid() {
        set({ grid: !get().grid });
      },
      cancel() {
        set({ tool: 'inspect', selectedId: null });
      },
      place(position) {
        const s = get();
        if (s.tool !== 'inspect')
          commit(
            placeBuilding(
              s.world,
              s.citizenId,
              s.tool as BuildingKind,
              position,
            ),
          );
      },
      toggle(id) {
        const s = get();
        commit(toggleBuilding(s.world, s.citizenId, id));
      },
      billboard(id, source) {
        const s = get();
        commit(setBillboard(s.world, s.citizenId, id, source));
      },
    };
  });
}
export type CityStore = ReturnType<typeof createCityStore>;
