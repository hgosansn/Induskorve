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

export interface RenderBuilding extends Building {
  h: number;
  variant: number;
  adImage?: string;
}
export interface Walker extends Position {
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
  kind: 'power' | 'materials';
  from: RenderBuilding;
  to: RenderBuilding;
  active: boolean;
  weight: number;
}
export interface RenderWorld {
  buildings: Map<string, RenderBuilding>;
  terrain: Map<string, Position>;
  net: Map<RenderBuilding, RenderNetwork>;
  links: RenderLink[];
}
export interface RenderFrame extends RenderWorld {
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
export function projectWorld(world: WorldSnapshot): RenderWorld {
  const appearances = new Map(world.appearances.map((a) => [a.buildingId, a]));
  const byId = new Map(
    world.buildings.map((b) => {
      const appearance = appearances.get(b.id);
      return [
        b.id,
        {
          ...b,
          h: appearance?.height ?? 35,
          variant: appearance?.seed ?? 0.5,
          adImage: appearance?.billboard,
        },
      ] as const;
    }),
  );
  const networks = calculateNetworks(world.buildings);
  return {
    buildings: new Map([...byId.values()].map((b) => [tileKey(b.x, b.y), b])),
    terrain: revealedTerrain(world.buildings),
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
