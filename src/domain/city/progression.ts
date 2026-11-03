import type { Citizen, WorldSnapshot } from './model';
import { calculateNetworks, type NetworkSnapshot } from './networks';
import {
  PROJECTS,
  TECHNOLOGIES,
  type Capability,
  type ProjectId,
  type TechnologyId,
  projectIdSchema,
} from './technology';

export function unlockedTechnologies(world: WorldSnapshot): TechnologyId[] {
  return (world.progression?.projects ?? [])
    .filter((p) => p.delivered === PROJECTS[p.id].cost)
    .map((p) => PROJECTS[p.id].unlock);
}
export function hasCapability(world: WorldSnapshot, capability: Capability) {
  return unlockedTechnologies(world).some((id) =>
    (TECHNOLOGIES[id].capabilities as readonly Capability[]).includes(
      capability,
    ),
  );
}
export function projectStatus(world: WorldSnapshot, id: ProjectId) {
  const definition = PROJECTS[id];
  const progress = world.progression?.projects.find((p) => p.id === id);
  const delivered = progress?.delivered ?? 0;
  const unlocked = unlockedTechnologies(world);
  return {
    definition,
    delivered,
    remaining: definition.cost - delivered,
    complete: delivered === definition.cost,
    available: definition.prerequisites.every((t) => unlocked.includes(t)),
    contributors: progress?.contributors ?? [],
  };
}
export function availableStock(
  world: WorldSnapshot,
  network: NetworkSnapshot = calculateNetworks(
    world.buildings,
    world.economy?.stockpiles,
  ),
) {
  return (world.economy?.stockpiles ?? [])
    .filter((s) => s.metal > 0 && network.services.get(s.buildingId)?.active)
    .sort((a, b) => a.buildingId - b.buildingId);
}
export function recordCityEvent(
  world: WorldSnapshot,
  actor: Citizen,
  summary: string,
  buildingId?: number,
): WorldSnapshot {
  const progression = world.progression ?? {
    version: 1 as const,
    projects: [],
    events: [],
  };
  const id = (progression.events.at(-1)?.id ?? -1) + 1;
  if (!Number.isSafeInteger(id) || id >= Number.MAX_SAFE_INTEGER)
    throw Error('City history identifier limit reached.');
  return {
    ...world,
    progression: {
      ...progression,
      events: [
        ...progression.events.slice(-119),
        {
          id,
          cycle: world.economy?.cycle ?? 0,
          actorId: actor.id,
          actor: actor.name,
          summary,
          buildingId,
        },
      ],
    },
  };
}
export interface MaterialContribution {
  warehouseId: number;
  amount: number;
}
/** Preview and confirmation execute this same atomic, pure command. */
export function contributeToProject(
  world: WorldSnapshot,
  citizenId: string | null,
  projectId: ProjectId,
  sources: readonly MaterialContribution[],
): WorldSnapshot {
  const actor = world.citizens.find((c) => c.id === citizenId);
  if (!actor) throw Error('Join the city before contributing.');
  const id = projectIdSchema.parse(projectId);
  const status = projectStatus(world, id);
  if (!status.available)
    throw Error('Complete the prerequisite project first.');
  if (status.complete) throw Error('This project is already complete.');
  if (
    !sources.length ||
    new Set(sources.map((s) => s.warehouseId)).size !== sources.length
  )
    throw Error('Choose distinct warehouses with available metal.');
  if (sources.length > 1 && !hasCapability(world, 'pooled-funding'))
    throw Error('Unlock Shared procurement before coordinating warehouses.');
  const stock = availableStock(world);
  for (const s of sources) {
    if (
      !Number.isSafeInteger(s.amount) ||
      s.amount <= 0 ||
      !stock.some((v) => v.buildingId === s.warehouseId && v.metal >= s.amount)
    )
      throw Error(
        'Contribution needs available metal in a powered warehouse. Refresh the forecast.',
      );
  }
  const total = sources.reduce((sum, s) => sum + s.amount, 0);
  if (!Number.isSafeInteger(total) || total > status.remaining)
    throw Error('The project needs less metal now. Refresh the forecast.');
  const previous = world.progression ?? {
    version: 1 as const,
    projects: [],
    events: [],
  };
  const contributors = status.contributors.filter(
    (c) => c.citizenId !== actor.id,
  );
  contributors.push({
    citizenId: actor.id,
    amount:
      total +
      (status.contributors.find((c) => c.citizenId === actor.id)?.amount ?? 0),
  });
  const next: WorldSnapshot = {
    ...world,
    economy: {
      ...world.economy!,
      stockpiles: world.economy!.stockpiles.map((s) => ({
        ...s,
        metal:
          s.metal -
          (sources.find((v) => v.warehouseId === s.buildingId)?.amount ?? 0),
      })),
    },
    progression: {
      ...previous,
      projects: [
        ...previous.projects.filter((p) => p.id !== id),
        { id, delivered: status.delivered + total, contributors },
      ],
    },
  };
  return recordCityEvent(
    next,
    actor,
    `Contributed ${total} metal to ${status.definition.label}.${total === status.remaining ? ` Unlocked ${TECHNOLOGIES[status.definition.unlock].label}.` : ''}`,
  );
}
export function dispatchAllMetal(
  world: WorldSnapshot,
  citizenId: string | null,
): WorldSnapshot {
  const actor = world.citizens.find((c) => c.id === citizenId);
  if (!actor) throw Error('Join the city before dispatching.');
  if (!hasCapability(world, 'dispatch-all'))
    throw Error('Complete Materials exchange to unlock coordinated dispatch.');
  const stocks = availableStock(world);
  const total = stocks.reduce((sum, s) => sum + s.metal, 0);
  if (!total || !world.economy)
    throw Error('No metal is ready in powered warehouses.');
  const shipped = (world.economy.shippedMetal ?? 0) + total;
  if (!Number.isSafeInteger(shipped))
    throw Error('Dispatch total limit reached.');
  return recordCityEvent(
    {
      ...world,
      economy: {
        ...world.economy,
        shippedMetal: shipped,
        stockpiles: world.economy.stockpiles.map((s) =>
          stocks.some((v) => v.buildingId === s.buildingId)
            ? { ...s, metal: 0 }
            : s,
        ),
      },
    },
    actor,
    `Dispatched ${total} metal from ${stocks.length} powered ${stocks.length === 1 ? 'warehouse' : 'warehouses'}.`,
  );
}
