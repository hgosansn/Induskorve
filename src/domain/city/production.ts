import { buildingStats } from './catalog';
import type { WorldSnapshot } from './model';
import { calculateNetworks } from './networks';

// One deterministic, bounded step. Scheduling belongs to the application/server.
// The local pilot has unlimited raw feedstock; metal accumulates in actual hubs.
export function advanceProduction(world: WorldSnapshot): WorldSnapshot {
  const networks = calculateNetworks(
    world.buildings,
    world.economy?.stockpiles,
  );
  const stock = new Map(
    world.economy?.stockpiles.map((s) => [s.buildingId, s.metal]),
  );
  const stores = new Map(
    world.buildings.filter((b) => b.type === 'warehouse').map((b) => [b.id, b]),
  );
  for (const n of networks.services.values()) {
    if (!n.active || n.storageId === undefined || !n.output) continue;
    const warehouse = stores.get(n.storageId)!;
    stock.set(
      n.storageId,
      Math.min(
        buildingStats(warehouse).metalCapacity,
        (stock.get(n.storageId) ?? 0) + n.output,
      ),
    );
  }
  return {
    ...world,
    economy: {
      shippedMetal: world.economy?.shippedMetal ?? 0,
      cycle: Math.min(
        Number.MAX_SAFE_INTEGER - 1,
        (world.economy?.cycle ?? 0) + 1,
      ),
      stockpiles: [...stores.keys()]
        .sort((a, b) => a - b)
        .map((buildingId) => ({
          buildingId,
          metal: stock.get(buildingId) ?? 0,
        })),
    },
  };
}
