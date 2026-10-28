import { buildingStats, hasModule, RULES } from './catalog';
import type { Building, Position } from './model';

export interface ServiceState {
  load: number;
  stockLoad: number;
  powered: boolean;
  active: boolean;
  demand: number;
  output: number;
  heatId?: number;
  storageFull?: boolean;
  powerId?: number;
  storageId?: number;
}
export interface NetworkLink {
  kind: 'power' | 'materials' | 'heat';
  fromId: number;
  toId: number;
  active: boolean;
  weight: number;
}
export interface NetworkSnapshot {
  services: Map<number, ServiceState>;
  links: NetworkLink[];
}
const distance = (a: Position, b: Position) => Math.hypot(a.x - b.x, a.y - b.y);

export function calculateNetworks(
  buildings: readonly Building[],
  stockpiles: readonly { buildingId: number; metal: number }[] = [],
): NetworkSnapshot {
  const list = [...buildings].sort((a, b) => a.id - b.id);
  const plants = list.filter((b) => b.type === 'power');
  const stores = list.filter((b) => b.type === 'warehouse');
  const services = new Map<number, ServiceState>();
  const links: NetworkLink[] = [];
  const state = (b: Building) => services.get(b.id)!;
  for (const b of list)
    services.set(b.id, {
      load: 0,
      stockLoad: 0,
      powered: b.type === 'power' && b.on,
      active: false,
      demand: buildingStats(b).demand,
      output: 0,
    });
  // Establish logistics before consumers so older foundries cannot starve hubs.
  for (const b of list
    .filter((b) => b.type !== 'power')
    .sort(
      (a, b) =>
        Number(b.type === 'warehouse') - Number(a.type === 'warehouse') ||
        a.id - b.id,
    )) {
    const n = state(b);
    const source = plants
      .filter((p) => p.on && distance(p, b) <= RULES.powerRange)
      .sort((a, c) => distance(a, b) - distance(c, b) || a.id - c.id)
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
    (b) => b.type === 'factory' && b.on && state(b).powered,
  )) {
    const source = stores
      .filter(
        (p) =>
          p.on &&
          state(p).powered &&
          distance(p, b) <= RULES.storageRange &&
          state(p).stockLoad < buildingStats(p).storageCapacity,
      )
      .sort((a, c) => distance(a, b) - distance(c, b) || a.id - c.id)[0];
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
      (b.type === 'power' ||
        (state(b).powered &&
          (b.type !== 'factory' || state(b).storageId !== undefined)));
  for (const link of links)
    if (link.kind === 'power')
      link.weight =
        0.35 +
        (services.get(link.fromId)!.load /
          buildingStats(plants.find((p) => p.id === link.fromId)!)
            .powerCapacity) *
          0.65;
  for (const b of list.filter((b) => b.type === 'factory' && state(b).active)) {
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
        hasModule(p, 'heat-exchanger') &&
        distance(p, b) <= RULES.heatRange,
    );
    state(b).output = buildingStats(b).output + (source ? 4 : 0);
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
export function serviceStatus(b: Building, n?: ServiceState): string {
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
