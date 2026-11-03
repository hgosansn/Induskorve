import {
  defaultDraft,
  draftSchema,
  type BuildingDraft,
  type BuildingModule,
} from '../domain/city/model';
import { create } from 'zustand';
import { relocateFoundingStation } from '../domain/city/plots';
import { advanceProduction } from '../domain/city/production';
import { type MaterialContribution } from '../domain/city/progression';
import { applyCityCommand, type CityCommand } from '../domain/city/commands';
import type { ProjectId } from '../domain/city/technology';
import type { CityRepository } from './city-repository';
import type { ConnectionStatus } from './live-city';
import {
  createFoundingWorld,
  joinLocalCity,
  setBillboard,
} from '../domain/city/world';
import type {
  BuildingKind,
  NetworkLayer,
  Position,
  Tool,
  WorldSnapshot,
} from '../domain/city/model';

export interface CityState {
  mode: 'local' | 'live';
  connectionStatus: ConnectionStatus;
  pending: boolean;
  signedIn: boolean;
  joinPrompt: boolean;
  liveRevision?: string;
  suggestedName?: string;
  captureCommand?(command: CityCommand): {
    revision: string;
    perform(): Promise<void>;
  };
  signIn(): Promise<void>;
  signOut(): Promise<void>;
  reconnect(): Promise<void>;
  approvedBillboards: { id: string; url: string }[];
  livePresence?: ReadonlyMap<string, { x: number; y: number; online: boolean }>;
  publishPresence?(x: number, y: number): Promise<void>;
  perform(command: CityCommand): void | Promise<void>;
  guideOpen: boolean;
  guideView: 'needs' | 'projects' | 'history';
  setGuideView(view: 'needs' | 'projects' | 'history'): void;
  previewPosition: Position | null;
  setPreviewPosition(position: Position | null): void;
  setGuideOpen(open: boolean): void;
  contribute(
    projectId: ProjectId,
    sources: readonly MaterialContribution[],
  ): void | Promise<void>;
  dispatchAll(): void | Promise<void>;
  configure(id: number, modules: BuildingModule[]): void | Promise<void>;
  dispatch(id: number): void | Promise<void>;
  tick(): void;
  draft: BuildingDraft;
  prepare(draft: BuildingDraft): void;
  world: WorldSnapshot;
  citizenId: string | null;
  selectedId: number | null;
  selectedPedestrian: string | null;
  selectPedestrian(key: string | null): void;
  tool: Tool;
  layer: NetworkLayer;
  grid: boolean;
  warning: string | null;
  join(name: string): void | Promise<void>;
  leave(): void;
  select(id: number | null): void;
  setTool(tool: Tool): void;
  setLayer(layer: NetworkLayer): void;
  toggleGrid(): void;
  cancel(): void;
  place(position: Position): void | Promise<void>;
  toggle(id: number): void | Promise<void>;
  billboard(id: number, source?: string): void | Promise<void>;
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
      mode: 'local',
      connectionStatus: 'ready',
      pending: false,
      signedIn: false,
      joinPrompt: false,
      approvedBillboards: [],
      async signIn() {
        throw Error('Authentication is available in the live city.');
      },
      async signOut() {
        get().leave();
      },
      async reconnect() {},
      perform(command) {
        commit(applyCityCommand(get().world, get().citizenId, command));
      },
      guideOpen: false,
      guideView: 'projects',
      setGuideView(guideView) {
        set({ guideView });
      },
      previewPosition: null,
      setPreviewPosition(previewPosition) {
        set({ previewPosition });
      },
      setGuideOpen(guideOpen) {
        set({
          guideOpen,
          ...(guideOpen && !get().citizenId
            ? { guideView: 'projects' as const }
            : {}),
          ...(guideOpen
            ? {
                selectedId: null,
                selectedPedestrian: null,
                tool: 'inspect' as const,
              }
            : {}),
        });
      },
      contribute(projectId, sources) {
        get().perform({ type: 'contribute', projectId, sources: [...sources] });
      },
      dispatchAll() {
        get().perform({ type: 'dispatch-all' });
      },
      configure(id, modules) {
        get().perform({ type: 'configure', buildingId: id, modules });
      },
      dispatch(id) {
        get().perform({ type: 'dispatch', buildingId: id });
      },
      tick() {
        if (get().citizenId) commit(advanceProduction(get().world));
      },
      draft: defaultDraft,
      prepare(draft) {
        const parsed = draftSchema.parse(draft);
        if (!get().citizenId) throw new Error('Join the city first.');
        set({
          draft: parsed,
          tool: parsed.kind,
          selectedId: null,
          selectedPedestrian: null,
          guideOpen: false,
        });
      },
      world: loaded.world
        ? relocateFoundingStation(loaded.world)
        : createFoundingWorld(),
      citizenId: null,
      selectedId: null,
      selectedPedestrian: null,
      selectPedestrian(key) {
        set({ selectedPedestrian: key, selectedId: null, guideOpen: false });
      },
      tool: 'inspect',
      layer: 'all',
      grid: false,
      warning: loaded.warning ?? null,
      join(name) {
        const result = joinLocalCity(get().world, name, crypto.randomUUID());
        commit(result.world);
        set({
          citizenId: result.citizen.id,
          guideOpen: true,
          guideView: 'needs',
          selectedId: null,
          selectedPedestrian: null,
        });
      },
      leave() {
        set({
          citizenId: null,
          guideOpen: false,
          tool: 'inspect',
          selectedId: null,
          selectedPedestrian: null,
        });
      },
      select(selectedId) {
        set({ selectedId, selectedPedestrian: null, guideOpen: false });
      },
      setTool(tool) {
        set({
          tool: get().citizenId ? tool : 'inspect',
          draft:
            tool === 'inspect' ? get().draft : { ...get().draft, kind: tool },
        });
      },
      setLayer(layer) {
        set({ layer });
      },
      toggleGrid() {
        set({ grid: !get().grid });
      },
      cancel() {
        set({
          tool: 'inspect',
          selectedId: null,
          selectedPedestrian: null,
          guideOpen: false,
        });
      },
      place(position) {
        const s = get();
        if (s.tool !== 'inspect')
          get().perform({
            type: 'place',
            position,
            draft: { ...s.draft, kind: s.tool as BuildingKind },
          });
        set({ tool: 'inspect' });
      },
      toggle(id) {
        get().perform({ type: 'toggle', buildingId: id });
      },
      billboard(id, source) {
        const s = get();
        commit(setBillboard(s.world, s.citizenId, id, source));
      },
    };
  });
}
export type CityStore = ReturnType<typeof createCityStore>;
