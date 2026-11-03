import { BUILDINGS } from './catalog';
import type { Building, WorldSnapshot } from './model';
import {
  calculateNetworks,
  serviceStatus,
  type ServiceState,
} from './networks';
import { advanceProduction } from './production';

export function cityOverview(world: WorldSnapshot) {
  const networks = calculateNetworks(
    world.buildings,
    world.economy?.stockpiles,
  );
  const stored = (world.economy?.stockpiles ?? []).reduce(
    (sum, s) => sum + s.metal,
    0,
  );
  const after = advanceProduction(world);
  const nextCycleMetal =
    after.economy!.stockpiles.reduce((sum, s) => sum + s.metal, 0) - stored;
  const needs = world.buildings
    .map((building) => ({
      building,
      service: networks.services.get(building.id)!,
    }))
    .filter(({ building, service }) => !service.active && building.on)
    .sort(
      (a, b) =>
        Number(!!b.service.storageFull) - Number(!!a.service.storageFull) ||
        a.building.id - b.building.id,
    );
  return { stored, nextCycleMetal, needs, networks };
}
export function explainNeed(b: Building, n: ServiceState) {
  return {
    label: BUILDINGS[b.type].label,
    status: serviceStatus(b, n),
    explanation: n.storageFull
      ? 'Its warehouse is full. Dispatch metal or fund a project to restart production.'
      : !n.powered
        ? 'No eligible generating station can supply this structure. Check distance, spare capacity and paused machinery.'
        : !n.active
          ? 'This ironworks needs a powered warehouse within range and an available connection.'
          : 'Its required services are available.',
  };
}
export function describeImpact(before: WorldSnapshot, after: WorldSnapshot) {
  const a = cityOverview(before),
    b = cityOverview(after);
  return {
    outputBefore: a.nextCycleMetal,
    outputAfter: b.nextCycleMetal,
    lostService: before.buildings
      .filter(
        (v) =>
          a.networks.services.get(v.id)?.active &&
          !b.networks.services.get(v.id)?.active,
      )
      .map((v) => v.id),
    restoredService: before.buildings
      .filter(
        (v) =>
          !a.networks.services.get(v.id)?.active &&
          b.networks.services.get(v.id)?.active,
      )
      .map((v) => v.id),
  };
}
