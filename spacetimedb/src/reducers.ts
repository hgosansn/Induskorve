import { SenderError, t, type ReducerCtx } from 'spacetimedb/server';
import { ScheduleAt } from 'spacetimedb';
import database, { productionSchedule, tables } from './schema';
import {
  BUILDINGS,
  MODULES,
  RULES,
  buildingStats,
} from '../../shared/city/catalog';
import {
  CONTENT_VERSION,
  type BuildingKind,
  type BuildingModule,
  type ProjectId,
  type TechnologyId,
} from '../../shared/city/ids';
import { PROJECTS, TECHNOLOGIES } from '../../shared/city/technology';
import {
  calculateNetworks,
  type NetworkBuilding,
} from '../../shared/city/networks';
import { cellKey, chunkKey, contributionKey } from '../../shared/city/keys';
import { revealedCells, isRoad } from '../../shared/city/terrain';
import { decodeCommand } from '../../shared/city/wire';
import { acceptsSpacetimeAuth } from '../../shared/city/auth';
import { CommandValidationError } from '../../shared/city/validate-command';
import { U64_MAX, type LiveCityCommand } from '../../shared/city/live-protocol';
import {
  authorizeBuildingChange,
  nextRevision,
  planDispatch,
  planProjectContribution,
  planSeenMarker,
  type WarehouseSnapshot,
} from './authority';
import {
  readCommandAdmission,
  writeTerminalReceipt,
} from './reducer-foundation';

type Context = ReducerCtx<typeof database.schemaType>;
const tickMicros = (ctx: Context) =>
  BigInt(
    ctx.env.INDUSKORVE_DEV_AUTH === 'local-tests' &&
      ctx.env.INDUSKORVE_TEST_TICK_MS === '100'
      ? 100
      : RULES.cycleMs,
  ) * 1000n;
const error = (
  code: ConstructorParameters<typeof CommandValidationError>[0],
  message: string,
): never => {
  throw new CommandValidationError(code, message);
};
const add = (a: bigint, b: bigint) => {
  if (a + b > U64_MAX) return error('limit-reached', 'Quantity limit reached.');
  return a + b;
};
const world = (ctx: Context) => {
  const row = ctx.db.world.id.find(0);
  if (!row) throw Error('World is not initialized.');
  return row;
};
const requireAuth = (ctx: Context) => {
  if (ctx.env.INDUSKORVE_DEV_AUTH === 'local-tests') return;
  const jwt = ctx.senderAuth.jwt,
    client = ctx.env.SPACETIMEAUTH_CLIENT_ID;
  if (!acceptsSpacetimeAuth(jwt, client))
    throw new SenderError('Sign in with this city’s SpacetimeAuth account.');
};
function network(ctx: Context) {
  const modules = new Map<bigint, BuildingModule[]>();
  for (const row of ctx.db.buildingModule.iter()) {
    const list = modules.get(row.buildingId) ?? [];
    list.push(row.kind as BuildingModule);
    modules.set(row.buildingId, list);
  }
  const buildings = [...ctx.db.building.iter()].map(
    (b): NetworkBuilding<bigint> => ({
      id: b.id,
      x: b.x,
      y: b.y,
      type: b.kind as BuildingKind,
      on: b.enabled,
      modules: modules.get(b.id) ?? [],
    }),
  );
  const stock = [...ctx.db.warehouseStockpile.iter()];
  const services = calculateNetworks(buildings, stock);
  return { buildings, services, stock, modules };
}
function warehouses(ctx: Context) {
  const n = network(ctx),
    result = new Map<bigint, WarehouseSnapshot>();
  for (const stock of n.stock) {
    const b = ctx.db.building.id.find(stock.buildingId);
    if (b)
      result.set(b.id, {
        id: b.id,
        kind: b.kind as BuildingKind,
        revision: b.revision,
        stockRevision: stock.revision,
        metal: stock.metal,
        active: n.services.services.get(b.id)?.active ?? false,
      });
  }
  return result;
}
function emit(
  ctx: Context,
  revision: bigint,
  kind: string,
  summary: string,
  details: {
    buildingId?: bigint;
    projectId?: string;
    technologyId?: string;
    amount?: bigint;
  } = {},
) {
  const actor = ctx.db.citizen.identity.find(ctx.sender);
  return ctx.db.worldEvent.insert({
    id: 0n,
    chunkKey:
      details.buildingId !== undefined
        ? ctx.db.building.id.find(details.buildingId)!.chunkKey
        : 'global',
    actor: ctx.sender,
    actorName: actor?.name,
    kind,
    summary,
    createdAt: ctx.timestamp,
    worldRevision: revision,
    buildingId: details.buildingId,
    projectId: details.projectId,
    technologyId: details.technologyId,
    resource: details.amount === undefined ? undefined : 'metal',
    amount: details.amount,
  });
}
function reveal(ctx: Context, position: { x: number; y: number }) {
  for (const p of revealedCells(position))
    if (!ctx.db.terrainTile.cellKey.find(p.cellKey))
      ctx.db.terrainTile.insert({ ...p, chunkKey: chunkKey(p.x, p.y) });
}
function createBuilding(
  ctx: Context,
  input: {
    kind: BuildingKind;
    x: number;
    y: number;
    creator?: Context['sender'];
    height: number;
    seed: number;
    shape: string;
    balcony: boolean;
    display: string;
    modules: BuildingModule[];
  },
) {
  const chunk = chunkKey(input.x, input.y);
  const b = ctx.db.building.insert({
    id: 0n,
    cellKey: cellKey(input.x, input.y),
    chunkKey: chunk,
    x: input.x,
    y: input.y,
    kind: input.kind,
    enabled: true,
    creator: input.creator,
    definitionVersion: BUILDINGS[input.kind].version,
    revision: 0n,
  });
  ctx.db.buildingAppearance.insert({
    buildingId: b.id,
    chunkKey: chunk,
    height: input.height,
    seed: input.seed,
    shape: input.shape,
    balcony: input.balcony,
    display: input.display,
    revision: 0n,
    billboardAssetId: undefined,
  });
  for (const kind of input.modules)
    ctx.db.buildingModule.insert({
      id: `${b.id}:${kind}`,
      buildingId: b.id,
      chunkKey: chunk,
      kind,
    });
  if (BUILDINGS[input.kind].role === 'storage')
    ctx.db.warehouseStockpile.insert({
      buildingId: b.id,
      chunkKey: chunk,
      metal: 0n,
      revision: 0n,
    });
  reveal(ctx, input);
  return b;
}
function ensurePresence(ctx: Context) {
  const existing = ctx.db.presence.identity.find(ctx.sender);
  if (existing)
    ctx.db.presence.identity.update({
      ...existing,
      online: true,
      updatedAt: ctx.timestamp,
    });
  else
    ctx.db.presence.insert({
      identity: ctx.sender,
      chunkKey: chunkKey(2, 2),
      x: 2,
      y: 2,
      online: true,
      updatedAt: ctx.timestamp,
    });
}
export const init = database.init((ctx) => {
  if (ctx.db.world.id.find(0)) return;
  ctx.db.world.insert({
    id: 0,
    schemaVersion: 1,
    contentVersion: CONTENT_VERSION,
    revision: 0n,
    tick: 0n,
    bootstrapMetal: 0n,
    producedMetal: 0n,
    shippedMetal: 0n,
  });
  for (const id of Object.keys(PROJECTS) as ProjectId[])
    ctx.db.cityProject.insert({
      id,
      definitionVersion: PROJECTS[id].version,
      resource: 'metal',
      requiredAmount: BigInt(PROJECTS[id].cost),
      deliveredAmount: 0n,
      revision: 0n,
      completedAt: undefined,
    });
  for (const b of [
    { kind: 'power' as const, x: 1, y: 1, height: 60 },
    { kind: 'warehouse' as const, x: 2, y: 1, height: 35 },
    { kind: 'factory' as const, x: 3, y: 1, height: 45 },
  ])
    createBuilding(ctx, {
      ...b,
      seed: 0.6,
      shape: 'block',
      balcony: true,
      display: 'animated',
      modules: [],
    });
  ctx.db.simulationState.insert({
    id: 0,
    nextTickAt: ctx.timestamp,
    topologyRevision: 0n,
  });
  ctx.db.productionSchedule.insert({
    scheduledId: 0n,
    scheduledAt: ScheduleAt.time(
      ctx.timestamp.microsSinceUnixEpoch + tickMicros(ctx),
    ),
    tick: 1n,
  });
});
export const clientConnected = database.clientConnected((ctx) => {
  if (ctx.connectionId && !ctx.db.session.connectionId.find(ctx.connectionId))
    ctx.db.session.insert({
      connectionId: ctx.connectionId,
      identity: ctx.sender,
    });
  if (ctx.db.citizen.identity.find(ctx.sender)) ensurePresence(ctx);
});
export const clientDisconnected = database.clientDisconnected((ctx) => {
  if (ctx.connectionId) ctx.db.session.connectionId.delete(ctx.connectionId);
  if ([...ctx.db.session.identity.filter(ctx.sender)].length) return;
  const presence = ctx.db.presence.identity.find(ctx.sender);
  if (presence)
    ctx.db.presence.identity.update({
      ...presence,
      online: false,
      updatedAt: ctx.timestamp,
    });
});
function apply(
  ctx: Context,
  c: LiveCityCommand,
): { revision: bigint; eventId?: bigint } {
  const w = world(ctx),
    profile = ctx.db.citizen.identity.find(ctx.sender);
  if (c.kind === 'register-profile') {
    if (!profile) {
      if (ctx.db.citizen.count() >= BigInt(RULES.maxCitizens))
        return error('limit-reached', 'Citizen limit reached.');
      ctx.db.citizen.insert({
        identity: ctx.sender,
        name: c.name,
        avatarSeed: c.avatarSeed,
        createdAt: ctx.timestamp,
        revision: 0n,
      });
      ctx.db.playerState.insert({ identity: ctx.sender, lastSeenEventId: 0n });
      ensurePresence(ctx);
    }
    return { revision: w.revision };
  }
  if (!profile) return error('not-registered', 'Register your citizen first.');
  if (c.kind === 'set-profile') {
    if (c.expectedProfileRevision !== profile.revision)
      return error('stale-revision', 'Your profile changed.');
    const revision = nextRevision(profile.revision);
    ctx.db.citizen.identity.update({
      ...profile,
      name: c.name,
      avatarSeed: c.avatarSeed,
      revision,
    });
    return { revision: w.revision };
  }
  if (c.kind === 'mark-seen') {
    const current = ctx.db.playerState.identity.find(ctx.sender);
    const latest = [...ctx.db.worldEvent.iter()].reduce(
      (max, e) => (e.id > max ? e.id : max),
      0n,
    );
    const lastSeenEventId = planSeenMarker(
      current?.lastSeenEventId ?? 0n,
      c.lastSeenEventId,
      latest,
    );
    if (current)
      ctx.db.playerState.identity.update({ ...current, lastSeenEventId });
    else ctx.db.playerState.insert({ identity: ctx.sender, lastSeenEventId });
    return { revision: w.revision };
  }
  const revision = nextRevision(w.revision);
  let event: ReturnType<typeof emit>;
  if (c.kind === 'place-building') {
    if (ctx.db.building.count() >= BigInt(RULES.maxBuildings))
      return error('limit-reached', 'Structure limit reached.');
    if (
      isRoad(c.position) ||
      !ctx.db.terrainTile.cellKey.find(cellKey(c.position.x, c.position.y)) ||
      ctx.db.building.cellKey.find(cellKey(c.position.x, c.position.y))
    )
      return error(
        'invalid-command',
        'Choose empty revealed ground beside a road.',
      );
    const b = createBuilding(ctx, {
      kind: c.buildingKind,
      ...c.position,
      creator: ctx.sender,
      height: c.appearance.height,
      seed: c.appearance.layoutSeed / 1_000_000,
      shape: c.appearance.shape,
      balcony: c.appearance.balcony,
      display: c.appearance.display,
      modules: c.modules,
    });
    event = emit(
      ctx,
      revision,
      c.kind,
      `Built ${BUILDINGS[c.buildingKind].label}.`,
      { buildingId: b.id },
    );
  } else if (
    c.kind === 'configure-modules' ||
    c.kind === 'set-operating' ||
    c.kind === 'set-billboard'
  ) {
    const b = ctx.db.building.id.find(c.buildingId);
    if (!b) return error('invalid-command', 'Structure no longer exists.');
    const oldModules = [...ctx.db.buildingModule.buildingId.filter(b.id)];
    authorizeBuildingChange(ctx.sender.toHexString(), c, {
      id: b.id,
      kind: b.kind as BuildingKind,
      creator: b.creator?.toHexString(),
      revision: b.revision,
      enabled: b.enabled,
      modules: oldModules.map((m) => m.kind as BuildingModule),
    });
    const buildingRevision = nextRevision(b.revision);
    if (c.kind === 'configure-modules') {
      const stock = ctx.db.warehouseStockpile.buildingId.find(b.id);
      if (
        stock &&
        stock.metal >
          BigInt(
            buildingStats({ type: b.kind as BuildingKind, modules: c.modules })
              .metalCapacity,
          )
      )
        return error(
          'insufficient-stock',
          'Dispatch stored metal before reducing storage capacity.',
        );
      for (const m of oldModules)
        if (!c.modules.includes(m.kind as BuildingModule))
          ctx.db.buildingModule.id.delete(m.id);
      for (const kind of c.modules)
        if (!oldModules.some((m) => m.kind === kind))
          ctx.db.buildingModule.insert({
            id: `${b.id}:${kind}`,
            buildingId: b.id,
            chunkKey: b.chunkKey,
            kind,
          });
      ctx.db.building.id.update({ ...b, revision: buildingRevision });
      event = emit(
        ctx,
        revision,
        c.kind,
        `Configured ${BUILDINGS[b.kind as BuildingKind].label}: ${c.modules.map((m) => MODULES[m].label).join(', ') || 'base machinery'}.`,
        { buildingId: b.id },
      );
    } else if (c.kind === 'set-operating') {
      ctx.db.building.id.update({
        ...b,
        enabled: c.enabled,
        revision: buildingRevision,
      });
      event = emit(
        ctx,
        revision,
        c.kind,
        `${c.enabled ? 'Started' : 'Paused'} ${BUILDINGS[b.kind as BuildingKind].label}.`,
        { buildingId: b.id },
      );
    } else {
      if (c.assetId !== null && !ctx.db.billboardAsset.id.find(c.assetId))
        return error('invalid-command', 'Choose an approved facade asset.');
      const appearance = ctx.db.buildingAppearance.buildingId.find(b.id);
      if (!appearance) throw Error('Missing building appearance.');
      const appearanceRevision = nextRevision(appearance.revision);
      ctx.db.buildingAppearance.buildingId.update({
        ...appearance,
        billboardAssetId: c.assetId ?? undefined,
        revision: appearanceRevision,
      });
      ctx.db.building.id.update({ ...b, revision: buildingRevision });
      event = emit(ctx, revision, c.kind, 'Updated facade artwork.', {
        buildingId: b.id,
      });
    }
  } else if (c.kind === 'contribute-project') {
    const p = ctx.db.cityProject.id.find(c.projectId);
    if (!p) throw Error('Missing city project.');
    const unlocked = [...ctx.db.technologyUnlock.iter()].map(
      (t) => t.id as TechnologyId,
    );
    const plan = planProjectContribution(
      c,
      { ...p, id: c.projectId },
      warehouses(ctx),
      unlocked,
    );
    const key = contributionKey(c.projectId, ctx.sender.toHexString()),
      previous = ctx.db.projectContribution.id.find(key),
      amount = add(previous?.amount ?? 0n, plan.total);
    for (const update of plan.updates) {
      const current = ctx.db.warehouseStockpile.buildingId.find(
        update.buildingId,
      )!;
      ctx.db.warehouseStockpile.buildingId.update({
        ...current,
        metal: update.metal,
        revision: update.revision,
      });
    }
    ctx.db.cityProject.id.update({
      ...p,
      deliveredAmount: plan.project.deliveredAmount,
      revision: plan.project.revision,
      completedAt: plan.unlock ? ctx.timestamp : undefined,
    });
    if (previous)
      ctx.db.projectContribution.id.update({
        ...previous,
        amount,
        updatedAt: ctx.timestamp,
      });
    else
      ctx.db.projectContribution.insert({
        id: key,
        projectId: c.projectId,
        actor: ctx.sender,
        amount,
        updatedAt: ctx.timestamp,
      });
    event = emit(
      ctx,
      revision,
      c.kind,
      `Contributed ${plan.total} metal to ${PROJECTS[c.projectId].label}.${plan.unlock ? ` Unlocked ${TECHNOLOGIES[plan.unlock].label}.` : ''}`,
      {
        projectId: c.projectId,
        technologyId: plan.unlock ?? undefined,
        amount: plan.total,
      },
    );
    if (plan.unlock)
      ctx.db.technologyUnlock.insert({
        id: plan.unlock,
        definitionVersion: TECHNOLOGIES[plan.unlock].version,
        projectId: c.projectId,
        unlockedAt: ctx.timestamp,
        eventId: event.id,
      });
  } else {
    const plan = planDispatch(
      c,
      warehouses(ctx),
      w.shippedMetal,
      [...ctx.db.technologyUnlock.iter()].map((t) => t.id as TechnologyId),
    );
    for (const update of plan.updates) {
      const current = ctx.db.warehouseStockpile.buildingId.find(
        update.buildingId,
      )!;
      ctx.db.warehouseStockpile.buildingId.update({
        ...current,
        metal: update.metal,
        revision: update.revision,
      });
    }
    ctx.db.world.id.update({ ...w, shippedMetal: plan.shippedMetal, revision });
    event = emit(ctx, revision, c.kind, `Dispatched ${plan.total} metal.`, {
      amount: plan.total,
    });
    return { revision, eventId: event.id };
  }
  ctx.db.world.id.update({ ...w, revision });
  return { revision, eventId: event.id };
}
export const executeCommand = database.reducer(
  { payload: t.string() },
  (ctx, { payload }) => {
    requireAuth(ctx);
    let command: LiveCityCommand;
    try {
      command = decodeCommand(payload);
    } catch {
      throw new SenderError('Invalid command payload.');
    }
    const admission = readCommandAdmission(ctx, command);
    if (admission.kind === 'replay') return;
    if (admission.kind === 'blocked')
      throw new SenderError(`[${admission.code}] ${admission.reason}`);
    let result;
    try {
      result = {
        ...apply(ctx, command),
        requestId: command.requestId,
        sequence: command.sequence,
        accepted: true as const,
      };
    } catch (e) {
      if (!(e instanceof CommandValidationError)) throw e;
      result = {
        requestId: command.requestId,
        sequence: command.sequence,
        accepted: false as const,
        revision: world(ctx).revision,
        code: e.code,
        reason: e.message,
      };
    }
    writeTerminalReceipt(ctx, admission, result);
  },
);
export const updatePresence = database.reducer(
  { x: t.f32(), y: t.f32() },
  (ctx, { x, y }) => {
    requireAuth(ctx);
    if (!ctx.db.citizen.identity.find(ctx.sender))
      throw new SenderError('Register your citizen first.');
    if (
      !Number.isFinite(x) ||
      !Number.isFinite(y) ||
      !ctx.db.terrainTile.cellKey.find(cellKey(Math.round(x), Math.round(y)))
    )
      throw new SenderError('Choose revealed ground.');
    const p = ctx.db.presence.identity.find(ctx.sender);
    if (
      p &&
      ctx.timestamp.microsSinceUnixEpoch - p.updatedAt.microsSinceUnixEpoch <
        500_000n
    )
      return;
    const next = {
      identity: ctx.sender,
      chunkKey: chunkKey(x, y),
      x,
      y,
      online: true,
      updatedAt: ctx.timestamp,
    };
    if (p) ctx.db.presence.identity.update(next);
    else ctx.db.presence.insert(next);
  },
);
export const productionTick = database.reducer(
  { onSchedule: productionSchedule },
  { arg: productionSchedule.rowType },
  (ctx, { arg }) => {
    if (!ctx.sender.isEqual(ctx.databaseIdentity))
      throw new SenderError('Server-owned production only.');
    const w = world(ctx);
    if (arg.tick !== w.tick + 1n) return;
    const n = network(ctx),
      updates = new Map<bigint, bigint>(
        n.stock.map((s) => [s.buildingId, s.metal]),
      );
    let produced = 0n;
    for (const b of n.buildings) {
      const service = n.services.services.get(b.id)!;
      if (!service.active || service.storageId === undefined || !service.output)
        continue;
      const warehouse = n.buildings.find((v) => v.id === service.storageId)!;
      const stock = updates.get(warehouse.id) ?? 0n,
        capacity = BigInt(buildingStats(warehouse).metalCapacity);
      const quantity =
        BigInt(service.output) < capacity - stock
          ? BigInt(service.output)
          : capacity - stock;
      if (quantity > 0n) {
        updates.set(warehouse.id, stock + quantity);
        produced += quantity;
      }
    }
    const producedMetal = add(w.producedMetal, produced),
      revision = nextRevision(w.revision),
      tick = nextRevision(w.tick);
    const planned = n.stock
      .filter((s) => updates.get(s.buildingId) !== s.metal)
      .map((s) => ({
        ...s,
        metal: updates.get(s.buildingId)!,
        revision: nextRevision(s.revision),
      }));
    for (const row of planned) ctx.db.warehouseStockpile.buildingId.update(row);
    ctx.db.world.id.update({ ...w, tick, revision, producedMetal });
    ctx.db.productionSchedule.insert({
      scheduledId: 0n,
      scheduledAt: ScheduleAt.time(
        ctx.timestamp.microsSinceUnixEpoch + tickMicros(ctx),
      ),
      tick: tick + 1n,
    });
  },
);
export const myReceipts = database.view(
  { public: true },
  t.array(tables.commandReceipt.rowType),
  (ctx) => [...ctx.db.commandReceipt.identity.filter(ctx.sender)],
);
export const myCursor = database.view(
  { public: true },
  t.option(tables.commandCursor.rowType),
  (ctx) => ctx.db.commandCursor.identity.find(ctx.sender) ?? undefined,
);
export const myPlayerState = database.view(
  { public: true },
  t.option(tables.playerState.rowType),
  (ctx) => ctx.db.playerState.identity.find(ctx.sender) ?? undefined,
);
