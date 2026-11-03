import { createCityStore } from '../../application/city-store';
import type { CityCommand } from '../../domain/city/commands';
import { availableStock } from '../../domain/city/progression';
import {
  MAX_BATCH_SOURCES,
  type LiveCityCommand,
  type StockSource,
} from '../../../shared/city/live-protocol';
import type { BuildingDraft, Position } from '../../domain/city/model';
import {
  LiveReadModel,
  collectLiveRows,
  type LiveRows,
} from './live-read-model';
import { SpacetimeGateway } from './sdk-gateway';

type Intent = LiveCityCommand extends infer C
  ? C extends LiveCityCommand
    ? Omit<C, 'protocolVersion' | 'contentVersion' | 'requestId' | 'sequence'>
    : never
  : never;
export interface LiveStoreOptions {
  uri: string;
  database: string;
  token?: string;
  tokenProvider?: () => Promise<string | undefined>;
  signedIn: boolean;
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
  signIn(): Promise<void>;
  signOut(): Promise<void>;
}
export function createLiveCityStore(options: LiveStoreOptions) {
  const model = new LiveReadModel();
  let current: LiveRows | null = null,
    identity: string | null = null,
    disposed = false;
  const store = createCityStore({
    load: () => ({
      world: { version: 3, buildings: [], appearances: [], citizens: [] },
      readOnly: true,
    }),
    save: () => {
      throw Error('Live snapshots must never write a local city save.');
    },
  });
  const gateway = new SpacetimeGateway({
    ...options,
    onStatus(status) {
      if (disposed) return;
      store.setState({
        connectionStatus: status,
        warning:
          status === 'ready'
            ? null
            : status === 'error'
              ? 'The live city could not synchronize. Reconnect to try again.'
              : status === 'reconnecting'
                ? 'Connection lost. Viewing the last synchronized city; editing is paused.'
                : null,
      });
    },
    onSnapshot(rows, actor) {
      if (disposed) return;
      current = rows;
      identity = actor;
      const world = model.project(rows);
      store.setState({
        world,
        liveRevision: rows.world?.revision.toString(),
        suggestedName:
          rows.citizens.find((c) => c.identity.toHexString() === actor)?.name ??
          store.getState().suggestedName,
        approvedBillboards: rows.assets.map((a) => ({
          id: a.id.toString(),
          url: a.url,
        })),
        livePresence: new Map(
          rows.presence.map((p) => [
            p.identity.toHexString(),
            { x: p.x, y: p.y, online: p.online },
          ]),
        ),
      });
    },
  });
  const ready = () => {
    if (!current || !identity || gateway.status !== 'ready')
      throw Error('Wait for the live city to synchronize.');
    return current;
  };
  const joined = () => {
    ready();
    if (!store.getState().citizenId || !options.signedIn)
      throw Error('Sign in and join the city before contributing.');
  };
  const send = async (intent: Intent) => {
    ready();
    if (store.getState().pending)
      throw Error('Wait for your current contribution to be confirmed.');
    store.setState({ pending: true });
    try {
      const command = {
        ...intent,
        protocolVersion: 1,
        contentVersion: 1,
        requestId: crypto.randomUUID(),
        sequence: (await gateway.commandCursor()) + 1n,
      } as LiveCityCommand;
      const result = await gateway.send(command);
      if (!result.accepted) throw Error(result.reason);
      if (gateway.connection?.identity) {
        const rows = collectLiveRows(gateway.connection);
        current = rows;
        store.setState({ world: model.project(rows) });
      }
    } finally {
      store.setState({ pending: false });
    }
  };
  const building = (id: number) => {
    const row = ready().buildings.find((b) => b.id === model.ids.live(id));
    if (!row) throw Error('Structure no longer exists.');
    return row;
  };
  const source = (id: number, amount?: number): StockSource => {
    const b = building(id),
      s = ready().stock.find((s) => s.buildingId === b.id);
    if (!s) throw Error('Warehouse stock is unavailable.');
    return {
      buildingId: b.id,
      amount: amount === undefined ? s.metal : BigInt(amount),
      expectedBuildingRevision: b.revision,
      expectedStockRevision: s.revision,
    };
  };
  const appearance = (draft: BuildingDraft) => ({
    height: draft.height,
    layoutSeed: Math.round(draft.seed * 1_000_000),
    shape: draft.design.shape,
    balcony: draft.design.balcony,
    display: draft.design.display,
  });
  const intentFor = (c: CityCommand): Intent => {
    joined();
    if (c.type === 'place')
      return {
        kind: 'place-building',
        buildingKind: c.draft.kind,
        modules: c.draft.modules ?? [],
        position: c.position,
        appearance: appearance(c.draft),
      };
    if (c.type === 'contribute') {
      const p = ready().projects.find((p) => p.id === c.projectId);
      if (!p) throw Error('Project no longer exists.');
      return {
        kind: 'contribute-project',
        projectId: c.projectId,
        expectedProjectRevision: p.revision,
        sources: c.sources.map((s) => source(s.warehouseId, s.amount)),
      };
    }
    if (c.type === 'dispatch-all') {
      const powered = store
        .getState()
        .world.buildings.filter((b) => b.type === 'warehouse' && b.on);
      const stocks = availableStock(store.getState().world).filter((s) =>
        powered.some((b) => b.id === s.buildingId),
      );
      if (stocks.length > MAX_BATCH_SOURCES)
        throw Error(
          'Coordinate up to 64 warehouses per contribution. Dispatch individual warehouses first.',
        );
      return {
        kind: 'dispatch-metal-batch',
        sources: stocks.map((s) => source(s.buildingId, s.metal)),
      };
    }
    const b = building(c.buildingId);
    if (c.type === 'configure')
      return {
        kind: 'configure-modules',
        buildingId: b.id,
        expectedBuildingRevision: b.revision,
        modules: c.modules,
      };
    if (c.type === 'toggle')
      return {
        kind: 'set-operating',
        buildingId: b.id,
        expectedBuildingRevision: b.revision,
        enabled: !b.enabled,
      };
    return { kind: 'dispatch-metal', source: source(c.buildingId) };
  };
  const perform = async (c: CityCommand) => send(intentFor(c));
  const setGuideView = store.getState().setGuideView;
  store.setState({
    mode: 'live',
    connectionStatus: 'disconnected',
    signedIn: options.signedIn,
    setGuideView(view) {
      setGuideView(view);
      if (
        view === 'history' &&
        store.getState().citizenId &&
        current &&
        !store.getState().pending
      ) {
        const lastSeenEventId = current.events.reduce(
          (id, e) => (e.id > id ? e.id : id),
          0n,
        );
        void send({ kind: 'mark-seen', lastSeenEventId }).catch(() => {
          /* A later visit can acknowledge history again. */
        });
      }
    },
    perform,
    tick() {},
    signIn: options.signIn,
    signOut: options.signOut,
    captureCommand(c) {
      const intent = intentFor(c),
        revision = current!.world!.revision.toString();
      return { revision, perform: () => send(intent) };
    },
    async reconnect() {
      gateway.disconnect();
      await gateway.connect();
    },
    async join(name) {
      if (!options.signedIn) {
        await options.signIn();
        return;
      }
      ready();
      await send({
        kind: 'register-profile',
        name: name.trim(),
        avatarSeed: 0,
      });
      if (!identity) throw Error('Sign-in identity is unavailable.');
      store.setState({
        citizenId: identity,
        guideOpen: true,
        guideView: 'needs',
        joinPrompt: false,
        selectedId: null,
        selectedPedestrian: null,
      });
    },
    async place(position: Position) {
      const s = store.getState();
      if (s.tool === 'inspect') return;
      await perform({
        type: 'place',
        position,
        draft: { ...s.draft, kind: s.tool },
      });
      store.setState({ tool: 'inspect' });
    },
    configure(id, modules) {
      return perform({ type: 'configure', buildingId: id, modules });
    },
    dispatch(id) {
      return perform({ type: 'dispatch', buildingId: id });
    },
    toggle(id) {
      return perform({ type: 'toggle', buildingId: id });
    },
    contribute(projectId, sources) {
      return perform({ type: 'contribute', projectId, sources: [...sources] });
    },
    dispatchAll() {
      return perform({ type: 'dispatch-all' });
    },
    async billboard(id, asset) {
      joined();
      const b = building(id);
      if (asset !== undefined && !/^\d+$/.test(asset))
        throw Error('Choose approved city artwork.');
      await send({
        kind: 'set-billboard',
        buildingId: b.id,
        expectedBuildingRevision: b.revision,
        assetId: asset === undefined ? null : BigInt(asset),
      });
    },
    async publishPresence(x, y) {
      if (gateway.status === 'ready' && store.getState().citizenId)
        await gateway.connection?.reducers.updatePresence({ x, y });
    },
  });
  return {
    store,
    gateway,
    async start() {
      disposed = false;
      try {
        await gateway.connect();
      } catch (error) {
        if (!disposed)
          store.setState({
            warning:
              error instanceof Error
                ? error.message
                : 'The live city could not be reached.',
          });
      }
    },
    dispose() {
      disposed = true;
      gateway.disconnect();
    },
    get rows() {
      return current;
    },
    model,
  };
}
