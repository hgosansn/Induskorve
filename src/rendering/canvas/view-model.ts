import type { BuildingDesign, BuildingDraft } from '../../domain/city/model';
import type {
  Building,
  Citizen,
  NetworkLayer,
  Position,
  Tool,
  WorldSnapshot,
} from '../../domain/city/model';
import {
  calculateNetworks,
  type ServiceState,
} from '../../domain/city/networks';
import { revealedTerrain } from '../../domain/city/terrain';
import { tileKey } from '../../domain/city/model';
import { buildingStats } from '../../domain/city/catalog';
import type { BuildingStudy } from './building-layout';
import {
  buildStreets,
  streetSignature,
  type StreetLayout,
} from '../../domain/city/streets';

export interface RenderBuilding extends Building {
  stock?: number;
  design?: BuildingDesign;
  h: number;
  variant: number;
  adImage?: string;
}
export interface Walker extends Position {
  node?: string;
  target?: string;
  route?: string[];
  wait?: number;
  trips?: number;
  moving?: boolean;
  tx: number;
  ty: number;
  phase: number;
  color: string;
  person?: Citizen;
  ambient?: boolean;
}
export interface RenderNetwork extends ServiceState {
  power?: RenderBuilding;
  storage?: RenderBuilding;
}
export interface RenderLink {
  kind: 'power' | 'materials' | 'heat';
  from: RenderBuilding;
  to: RenderBuilding;
  active: boolean;
  weight: number;
}
export interface RenderWorld {
  streets: StreetLayout;
  buildings: Map<string, RenderBuilding>;
  terrain: Map<string, Position & { exposure?: number }>;
  net: Map<RenderBuilding, RenderNetwork>;
  links: RenderLink[];
}
export interface RenderFrame extends RenderWorld {
  study?: BuildingStudy;
  preview?: {
    building: RenderBuilding;
    service: RenderNetwork;
    links: RenderLink[];
  };
  draft?: BuildingDraft;
  W: number;
  H: number;
  dpr: number;
  zoom: number;
  panX: number;
  panY: number;
  clock: number;
  mode: Tool;
  grid: boolean;
  hover: Position | null;
  selected: RenderBuilding | null;
  citizen: Citizen | null;
  layer: NetworkLayer;
  walkers: Walker[];
}
export function projectPlacement(
  world: WorldSnapshot,
  draft: BuildingDraft,
  position: Position,
): RenderFrame['preview'] {
  const cell = tileKey(position.x, position.y);
  if (
    world.buildings.some((b) => tileKey(b.x, b.y) === cell) ||
    !revealedTerrain(world.buildings).has(cell)
  )
    return undefined;
  const id = Math.max(-1, ...world.buildings.map((b) => b.id)) + 1;
  const projected = projectWorld({
    ...world,
    buildings: [
      ...world.buildings,
      { ...position, id, type: draft.kind, modules: draft.modules, on: true },
    ],
    appearances: [
      ...world.appearances,
      {
        buildingId: id,
        height: draft.height,
        seed: draft.seed,
        design: draft.design,
      },
    ],
  });
  const building = projected.buildings.get(cell)!;
  return {
    building,
    service: projected.net.get(building)!,
    links: projected.links.filter((l) => l.from.id === id || l.to.id === id),
  };
}
export function projectWorld(
  world: WorldSnapshot,
  previous?: RenderWorld,
): RenderWorld {
  const appearances = new Map(world.appearances.map((a) => [a.buildingId, a]));
  const byId = new Map(
    world.buildings.map((b) => {
      const appearance = appearances.get(b.id);
      const next: RenderBuilding = {
        ...b,
        stock:
          world.economy?.stockpiles.find((s) => s.buildingId === b.id)?.metal ??
          0,
        h: appearance?.height ?? 35,
        variant: appearance?.seed ?? 0.5,
        adImage: appearance?.billboard,
        design: appearance?.design,
      };
      const old = previous?.buildings.get(tileKey(b.x, b.y));
      const unchanged =
        old &&
        Object.keys(next).length === Object.keys(old).length &&
        (Object.keys(next) as (keyof RenderBuilding)[]).every((k) =>
          Object.is(next[k], old[k]),
        );
      return [b.id, unchanged ? old : next] as const;
    }),
  );
  const networks = calculateNetworks(
    world.buildings,
    world.economy?.stockpiles,
  );
  const terrain: RenderWorld['terrain'] = revealedTerrain(world.buildings);
  // Local operational footprint: scrubbers and outages change the surrounding ground.
  for (const b of world.buildings) {
    if (!networks.services.get(b.id)?.active) continue;
    const emissions = buildingStats(b).emissions;
    for (let dy = -2; dy <= 2; dy++)
      for (let dx = -2; dx <= 2; dx++) {
        const distance = Math.hypot(dx, dy);
        const tile = terrain.get(tileKey(b.x + dx, b.y + dy));
        if (tile && distance <= 2)
          tile.exposure = (tile.exposure ?? 0) + emissions / (1 + distance);
      }
  }
  const buildings = new Map(
    [...byId.values()].map((b) => [tileKey(b.x, b.y), b]),
  );
  const signature = streetSignature(buildings.values(), terrain);
  return {
    streets:
      previous?.streets.signature === signature
        ? previous.streets
        : buildStreets(buildings, terrain, signature),
    buildings,
    terrain,
    net: new Map(
      [...byId.values()].map((b) => {
        const service = networks.services.get(b.id)!;
        return [
          b,
          {
            ...service,
            power:
              service.powerId === undefined
                ? undefined
                : byId.get(service.powerId),
            storage:
              service.storageId === undefined
                ? undefined
                : byId.get(service.storageId),
          },
        ];
      }),
    ),
    links: networks.links.map((l) => ({
      ...l,
      from: byId.get(l.fromId)!,
      to: byId.get(l.toId)!,
    })),
  };
}
