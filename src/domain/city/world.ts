import {
  draftSchema,
  defaultDraft,
  type BuildingDraft,
  type BuildingModule,
} from './model';
import { RULES, buildingStats } from './catalog';
import {
  buildingKindSchema,
  citizenSchema,
  imageSourceSchema,
  positionSchema,
  tileKey,
  type BuildingKind,
  type Citizen,
  type Position,
  type WorldSnapshot,
} from './model';
import { revealedTerrain } from './terrain';
import { calculateNetworks } from './networks';

export function configureModules(
  world: WorldSnapshot,
  citizenId: string | null,
  id: number,
  modules: BuildingModule[],
): WorldSnapshot {
  requireCitizen(world, citizenId);
  const building = world.buildings.find((b) => b.id === id);
  if (!building) throw new Error('Structure no longer exists.');
  const parsed = draftSchema.parse({
    ...defaultDraft,
    kind: building.type,
    modules,
  });
  const updated = { ...building, modules: parsed.modules };
  const stock =
    world.economy?.stockpiles.find((s) => s.buildingId === id)?.metal ?? 0;
  if (stock > buildingStats(updated).metalCapacity)
    throw new Error('Dispatch stored metal before removing the loading bay.');
  return {
    ...world,
    buildings: world.buildings.map((b) => (b.id === id ? updated : b)),
  };
}

export function dispatchMetal(
  world: WorldSnapshot,
  citizenId: string | null,
  id: number,
): WorldSnapshot {
  requireCitizen(world, citizenId);
  const warehouse = world.buildings.find(
    (b) => b.id === id && b.type === 'warehouse',
  );
  if (
    !warehouse ||
    !calculateNetworks(world.buildings).services.get(id)?.active
  )
    throw new Error('Dispatch needs a powered warehouse.');
  const economy = world.economy;
  const stock =
    economy?.stockpiles.find((s) => s.buildingId === id)?.metal ?? 0;
  if (!economy || !stock) throw new Error('No metal ready for dispatch.');
  return {
    ...world,
    economy: {
      ...economy,
      shippedMetal: Math.min(
        Number.MAX_SAFE_INTEGER,
        (economy.shippedMetal ?? 0) + stock,
      ),
      stockpiles: economy.stockpiles.map((s) =>
        s.buildingId === id ? { ...s, metal: 0 } : s,
      ),
    },
  };
}

export function createFoundingWorld(): WorldSnapshot {
  let seed = 84;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const world: WorldSnapshot = {
    version: 3,
    buildings: [],
    appearances: [],
    citizens: [],
  };
  for (let y = -7; y <= 7; y++)
    for (let x = -7; x <= 7; x++) {
      if (
        Math.hypot(x, y) < 7.5 &&
        x % 4 !== 0 &&
        y % 4 !== 0 &&
        rand() > 0.13
      ) {
        const id = world.buildings.length + 1;
        const type =
          rand() < 0.18 ? 'power' : rand() < 0.34 ? 'warehouse' : 'factory';
        world.buildings.push({ id, x, y, type, on: true });
        world.appearances.push({
          buildingId: id,
          height: 22 + rand() * 45,
          seed: rand(),
        });
      }
    }
  world.buildings.push({ id: 0, x: 0, y: 0, type: 'power', on: true });
  world.appearances.push({ buildingId: 0, height: 85, seed: 0.6 });
  return world;
}
function requireCitizen(
  world: WorldSnapshot,
  citizenId: string | null,
): Citizen {
  const citizen = world.citizens.find((c) => c.id === citizenId);
  if (!citizen) throw new Error('Join the city before editing.');
  return citizen;
}
export function joinLocalCity(
  world: WorldSnapshot,
  name: string,
  id: string,
): { world: WorldSnapshot; citizen: Citizen } {
  const parsed = citizenSchema.parse({ id, name });
  const existing = world.citizens.find(
    (c) => c.name.toLowerCase() === parsed.name.toLowerCase(),
  );
  if (existing) return { world, citizen: existing };
  if (world.citizens.length >= RULES.maxCitizens)
    throw new Error('Local citizen limit reached.');
  return {
    world: { ...world, citizens: [...world.citizens, parsed] },
    citizen: parsed,
  };
}
export function placeBuilding(
  world: WorldSnapshot,
  citizenId: string | null,
  kind: BuildingKind,
  position: Position,
  draft?: BuildingDraft,
): WorldSnapshot {
  const configured = draft ? draftSchema.parse(draft) : undefined;
  const citizen = requireCitizen(world, citizenId);
  const type = buildingKindSchema.parse(configured?.kind ?? kind);
  const p = positionSchema.parse(position);
  if (world.buildings.length >= RULES.maxBuildings)
    throw new Error('Local structure limit reached.');
  const cell = tileKey(p.x, p.y);
  if (
    world.buildings.some((b) => tileKey(b.x, b.y) === cell) ||
    !revealedTerrain(world.buildings).has(cell)
  )
    throw new Error('Choose empty, revealed ground at the city edge.');
  const id = Math.max(-1, ...world.buildings.map((b) => b.id)) + 1;
  if (!Number.isSafeInteger(id))
    throw new Error('Structure identifier limit reached.');
  return {
    ...world,
    buildings: [
      ...world.buildings,
      {
        ...p,
        type,
        id,
        on: true,
        modules: configured?.modules,
        creatorId: citizen.id,
        creator: citizen.name,
      },
    ],
    appearances: [
      ...world.appearances,
      {
        buildingId: id,
        height:
          configured?.height ??
          (type === 'power'
            ? 36 + Math.random() * 35
            : 22 + Math.random() * 55),
        seed: configured?.seed ?? Math.random(),
        design: configured?.design,
      },
    ],
  };
}
export function toggleBuilding(
  world: WorldSnapshot,
  citizenId: string | null,
  id: number,
): WorldSnapshot {
  requireCitizen(world, citizenId);
  if (!world.buildings.some((b) => b.id === id))
    throw new Error('Structure no longer exists.');
  return {
    ...world,
    buildings: world.buildings.map((b) =>
      b.id === id ? { ...b, on: !b.on } : b,
    ),
  };
}
export function setBillboard(
  world: WorldSnapshot,
  citizenId: string | null,
  id: number,
  source?: string,
): WorldSnapshot {
  requireCitizen(world, citizenId);
  if (!world.buildings.some((b) => b.id === id))
    throw new Error('Structure no longer exists.');
  const billboard =
    source === undefined ? undefined : imageSourceSchema.parse(source);
  return {
    ...world,
    appearances: world.appearances.map((a) =>
      a.buildingId === id ? { ...a, billboard } : a,
    ),
  };
}
