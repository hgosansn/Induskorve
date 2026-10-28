import { BUILDINGS, RULES } from './catalog';
import type { Building, Position } from './model';

export interface ServiceState {
  load: number;
  stockLoad: number;
  powered: boolean;
  active: boolean;
  demand: number;
  powerId?: number;
  storageId?: number;
}
export interface NetworkLink {
  kind: 'power' | 'materials';
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
      demand: BUILDINGS[b.type].powerDemand,
    });
  for (const b of list.filter((b) => b.type !== 'power')) {
    const n = state(b);
    const source = plants
      .filter((p) => p.on && distance(p, b) <= RULES.powerRange)
      .sort((a, c) => distance(a, b) - distance(c, b) || a.id - c.id)
      .find(
        (p) => state(p).load + (b.on ? n.demand : 0) <= RULES.powerCapacity,
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
  for (const b of list.filter((b) => b.type === 'factory')) {
    const source = stores
      .filter(
        (p) =>
          p.on &&
          state(p).powered &&
          distance(p, b) <= RULES.storageRange &&
          state(p).stockLoad < RULES.storageCapacity,
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
        0.35 + (services.get(link.fromId)!.load / RULES.powerCapacity) * 0.65;
  return { services, links };
}
export function serviceStatus(b: Building, n?: ServiceState): string {
  return !b.on
    ? 'Paused'
    : n?.active
      ? 'Operational'
      : !n?.powered
        ? 'Needs power'
        : 'Needs storage';
}
