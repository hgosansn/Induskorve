import { BUILDINGS, acceptsExchange, buildingStats, RULES } from './catalog';
import type { ExchangeId } from './exchanges';
import type { BuildingKind, BuildingModule } from './ids';
export type NetworkId = number | bigint;
export interface Position {
  x: number;
  y: number;
}
export interface NetworkBuilding<
  I extends NetworkId = number,
> extends Position {
  id: I;
  type: BuildingKind;
  on: boolean;
  modules?: readonly BuildingModule[];
}
const compareId = <I extends NetworkId>(a: I, b: I) =>
  a < b ? -1 : a > b ? 1 : 0;

export interface ServiceState<I extends NetworkId = number> {
  load: number;
  stockLoad: number;
  powered: boolean;
  active: boolean;
  demand: number;
  output: number;
  heatId?: I;
  storageFull?: boolean;
  powerId?: I;
  storageId?: I;
}
export interface NetworkLink<I extends NetworkId = number> {
  kind: ExchangeId;
  fromId: I;
  toId: I;
  active: boolean;
  weight: number;
}
export interface NetworkSnapshot<I extends NetworkId = number> {
  services: Map<I, ServiceState<I>>;
  links: NetworkLink<I>[];
}
const distance = (a: Position, b: Position) => Math.hypot(a.x - b.x, a.y - b.y);

export function calculateNetworks<I extends NetworkId>(
  buildings: readonly NetworkBuilding<I>[],
  stockpiles: readonly { buildingId: I; metal: number | bigint }[] = [],
): NetworkSnapshot<I> {
  const list = [...buildings].sort((a, b) => compareId(a.id, b.id));
  const plants = list.filter((b) => BUILDINGS[b.type].role === 'generator');
  const stores = list.filter((b) => BUILDINGS[b.type].role === 'storage');
  const services = new Map<I, ServiceState<I>>();
  const links: NetworkLink<I>[] = [];
  const state = (b: NetworkBuilding<I>) => services.get(b.id)!;
  for (const b of list)
    services.set(b.id, {
      load: 0,
      stockLoad: 0,
      powered: BUILDINGS[b.type].role === 'generator' && b.on,
      active: false,
      demand: buildingStats(b).demand,
      output: 0,
    });
  // Establish logistics before consumers so older foundries cannot starve hubs.
  for (const b of list
    .filter((b) => BUILDINGS[b.type].role !== 'generator')
    .sort(
      (a, b) =>
        Number(BUILDINGS[b.type].role === 'storage') -
          Number(BUILDINGS[a.type].role === 'storage') || compareId(a.id, b.id),
    )) {
    const n = state(b);
    const source = plants
      .filter(
        (p) =>
          p.on &&
          acceptsExchange(p.type, b.type, 'power') &&
          distance(p, b) <= RULES.powerRange,
      )
      .sort((a, c) => distance(a, b) - distance(c, b) || compareId(a.id, c.id))
      .find(
        (p) =>
          state(p).load + (b.on ? n.demand : 0) <=
          buildingStats(p).powerCapacity,
      );
    if (source) {
      n.powerId = source.id;
      n.powered = b.on;
      state(source).load += b.on ? n.demand : 0;
      links.push({
        kind: 'power',
        fromId: source.id,
        toId: b.id,
        active: b.on,
        weight: n.demand / 12,
      });
    }
  }
  for (const b of list.filter(
    (b) => BUILDINGS[b.type].requiresStorage && b.on && state(b).powered,
  )) {
    const source = stores
      .filter(
        (p) =>
          p.on &&
          acceptsExchange(b.type, p.type, 'materials') &&
          state(p).powered &&
          distance(p, b) <= RULES.storageRange &&
          state(p).stockLoad < buildingStats(p).storageCapacity,
      )
      .sort(
        (a, c) => distance(a, b) - distance(c, b) || compareId(a.id, c.id),
      )[0];
    if (source) {
      state(b).storageId = source.id;
      state(source).stockLoad++;
      links.push({
        kind: 'materials',
        fromId: b.id,
        toId: source.id,
        active: b.on && state(b).powered,
        weight: 0.7,
      });
    }
  }
  for (const b of list)
    state(b).active =
      b.on &&
      (BUILDINGS[b.type].role === 'generator' ||
        (state(b).powered &&
          (!BUILDINGS[b.type].requiresStorage ||
            state(b).storageId !== undefined)));
  for (const link of links)
    if (link.kind === 'power')
      link.weight =
        0.35 +
        (services.get(link.fromId)!.load /
          buildingStats(plants.find((p) => p.id === link.fromId)!)
            .powerCapacity) *
          0.65;
  for (const b of list.filter(
    (b) => BUILDINGS[b.type].role === 'producer' && state(b).active,
  )) {
    const warehouse = stores.find((p) => p.id === state(b).storageId)!;
    if (
      (stockpiles.find((s) => s.buildingId === warehouse.id)?.metal ?? 0) >=
      buildingStats(warehouse).metalCapacity
    ) {
      state(b).storageFull = true;
      state(b).active = false;
      const link = links.find(
        (l) => l.kind === 'materials' && l.fromId === b.id,
      );
      if (link) link.active = false;
      continue;
    }
    const source = plants.find(
      (p) =>
        p.id === state(b).powerId &&
        buildingStats(p).heatOutput > 0 &&
        acceptsExchange(p.type, b.type, 'heat') &&
        distance(p, b) <= RULES.heatRange,
    );
    state(b).output =
      buildingStats(b).output + (source ? buildingStats(source).heatOutput : 0);
    if (source) {
      state(b).heatId = source.id;
      links.push({
        kind: 'heat',
        fromId: source.id,
        toId: b.id,
        active: true,
        weight: 1,
      });
    }
  }
  return { services, links };
}
export function serviceStatus<I extends NetworkId>(
  b: NetworkBuilding<I>,
  n?: ServiceState<I>,
): string {
  return !b.on
    ? 'Paused'
    : n?.storageFull
      ? 'Storage full'
      : n?.active
        ? 'Operational'
        : !n?.powered
          ? 'Needs power'
          : 'Needs storage';
}
