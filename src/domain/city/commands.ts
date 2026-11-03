import type {
  BuildingDraft,
  BuildingModule,
  Position,
  WorldSnapshot,
} from './model';
import { BUILDINGS, MODULES } from './catalog';
import {
  configureModules,
  dispatchMetal,
  placeBuilding,
  toggleBuilding,
} from './world';
import {
  contributeToProject,
  dispatchAllMetal,
  recordCityEvent,
  type MaterialContribution,
} from './progression';
import type { ProjectId } from './technology';

export type CityCommand =
  | { type: 'configure'; buildingId: number; modules: BuildingModule[] }
  | { type: 'toggle'; buildingId: number }
  | { type: 'dispatch'; buildingId: number }
  | {
      type: 'contribute';
      projectId: ProjectId;
      sources: MaterialContribution[];
    }
  | { type: 'dispatch-all' }
  | { type: 'place'; position: Position; draft: BuildingDraft };

/** Pure shared boundary for local previews and commands; no timers or persistence. */
export function applyCityCommand(
  world: WorldSnapshot,
  citizenId: string | null,
  command: CityCommand,
): WorldSnapshot {
  if (command.type === 'contribute')
    return contributeToProject(
      world,
      citizenId,
      command.projectId,
      command.sources,
    );
  if (command.type === 'dispatch-all')
    return dispatchAllMetal(world, citizenId);
  const actor = world.citizens.find((c) => c.id === citizenId);
  if (!actor) throw Error('Join the city before contributing.');
  if (command.type === 'place') {
    const next = placeBuilding(
      world,
      citizenId,
      command.draft.kind,
      command.position,
      command.draft,
    );
    return recordCityEvent(
      next,
      actor,
      `Built ${BUILDINGS[command.draft.kind].label}.`,
      next.buildings.at(-1)!.id,
    );
  }
  const id = command.buildingId;
  if (command.type === 'configure') {
    const next = configureModules(world, citizenId, id, command.modules);
    const previous = world.buildings.find((b) => b.id === id)?.modules ?? [];
    const installed = command.modules.filter((m) => !previous.includes(m));
    const removed = previous.filter((m) => !command.modules.includes(m));
    if (!installed.length && !removed.length) return world;
    const changes = [
      installed.length
        ? `Installed ${installed.map((m) => MODULES[m].label).join(', ')}`
        : '',
      removed.length
        ? `Removed ${removed.map((m) => MODULES[m].label).join(', ')}`
        : '',
    ]
      .filter(Boolean)
      .join('; ');
    return recordCityEvent(next, actor, `${changes} on structure #${id}.`, id);
  }
  if (command.type === 'toggle')
    return recordCityEvent(
      toggleBuilding(world, citizenId, id),
      actor,
      `${world.buildings.find((b) => b.id === id)?.on ? 'Paused' : 'Started'} structure #${id}.`,
      id,
    );
  const stock =
    world.economy?.stockpiles.find((s) => s.buildingId === id)?.metal ?? 0;
  return recordCityEvent(
    dispatchMetal(world, citizenId, id),
    actor,
    `Dispatched ${stock} metal from warehouse #${id}.`,
    id,
  );
}
