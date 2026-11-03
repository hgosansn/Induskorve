import type { BuildingKind, BuildingModule } from './ids';
import type { ExchangePort } from './exchanges';

export interface BuildingDefinition {
  label: string;
  shortLabel: string;
  description: string;
  version: number;
  role: 'producer' | 'generator' | 'storage' | 'civic';
  footprint: { width: number; depth: number };
  construction: { metal: number };
  powerDemand: number;
  requiresStorage: boolean;
  output: number;
  powerCapacity: number;
  storageConnections: number;
  metalCapacity: number;
  emissions: number;
  ports: readonly ExchangePort[];
}
const base = {
  version: 1,
  footprint: { width: 1, depth: 1 },
  construction: { metal: 0 },
  output: 0,
  powerCapacity: 0,
  storageConnections: 0,
  metalCapacity: 0,
  emissions: 0,
} as const;
const powerInput = {
  id: 'grid',
  exchange: 'power',
  direction: 'input',
} as const;
const civic = {
  ...base,
  role: 'civic',
  requiresStorage: false,
  ports: [powerInput],
} as const;

// Gameplay definitions contain no CSS, icons, palettes or renderer instructions.
export const BUILDINGS = {
  factory: {
    ...base,
    label: 'Ironworks',
    shortLabel: 'Foundry',
    role: 'producer',
    description:
      'Turns unlimited feedstock into metal when power and powered storage are available.',
    powerDemand: 12,
    requiresStorage: true,
    output: 12,
    emissions: 4,
    ports: [
      powerInput,
      {
        id: 'dispatch',
        exchange: 'materials',
        direction: 'output',
        resource: 'metal',
      },
      { id: 'heat', exchange: 'heat', direction: 'input' },
    ],
  },
  power: {
    ...base,
    shortLabel: 'Power',
    role: 'generator',
    powerCapacity: 80,
    emissions: 2,
    description:
      'Supplies nearby structures. Extra turbines add capacity; heat recovery helps adjacent ironworks.',
    ports: [
      { id: 'grid', exchange: 'power', direction: 'output' },
      { id: 'heat', exchange: 'heat', direction: 'output' },
    ],
    label: 'Generating station',
    powerDemand: 0,
    requiresStorage: false,
  },
  warehouse: {
    ...base,
    shortLabel: 'Storage',
    role: 'storage',
    storageConnections: 8,
    metalCapacity: 200,
    description:
      'Collects metal from connected ironworks. Dispatch stock or contribute it to a city project.',
    ports: [
      powerInput,
      {
        id: 'receiving',
        exchange: 'materials',
        direction: 'input',
        resource: 'metal',
      },
    ],
    label: 'Freight warehouse',
    powerDemand: 6,
    requiresStorage: false,
  },
  residential: {
    ...civic,
    shortLabel: 'Homes',
    description:
      'Adds homes and powered windows. Population and rent are not simulated.',
    label: 'Apartment block',
    powerDemand: 4,
    requiresStorage: false,
  },
  skyscraper: {
    ...civic,
    shortLabel: 'Skyscraper',
    description:
      'A tall civic landmark with a powered facade display. Population is not simulated.',
    label: 'Residential skyscraper',
    powerDemand: 10,
    requiresStorage: false,
  },
  shop: {
    ...civic,
    label: 'Neighborhood shop',
    shortLabel: 'Shops',
    description: 'Adds a street-front shop. Trade is not simulated.',
    powerDemand: 3,
  },
} as const satisfies Record<BuildingKind, BuildingDefinition>;

export function acceptsExchange(
  from: BuildingKind,
  to: BuildingKind,
  exchange: ExchangePort['exchange'],
) {
  const outputs: readonly ExchangePort[] = BUILDINGS[from].ports;
  const inputs: readonly ExchangePort[] = BUILDINGS[to].ports;
  return outputs.some(
    (a) =>
      a.direction === 'output' &&
      a.exchange === exchange &&
      inputs.some(
        (b) =>
          b.direction === 'input' &&
          b.exchange === exchange &&
          a.resource === b.resource,
      ),
  );
}
export const RULES = {
  cycleMs: 10_000,
  heatRange: 1.5,
  powerRange: 4.5,
  powerCapacity: BUILDINGS.power.powerCapacity,
  storageRange: 3.5,
  storageCapacity: BUILDINGS.warehouse.storageConnections,
  revealRadius: 2.65,
  maxBuildings: 2500,
  maxCitizens: 100,
} as const;

type StatEffects = Partial<
  Record<
    | 'demand'
    | 'powerCapacity'
    | 'storageCapacity'
    | 'metalCapacity'
    | 'output'
    | 'heatOutput'
    | 'emissionsMultiplier',
    number
  >
>;
export const MODULES: Record<
  BuildingModule,
  {
    kind: BuildingKind;
    label: string;
    description: string;
    effects: StatEffects;
  }
> = {
  turbine: {
    kind: 'power',
    label: 'Extra turbine',
    description: '+40 power capacity',
    effects: { powerCapacity: 40 },
  },
  'heat-exchanger': {
    kind: 'power',
    label: 'Heat recovery',
    description: '+4 metal per cycle to supplied foundries within 1.5 tiles',
    effects: { heatOutput: 4 },
  },
  furnace: {
    kind: 'factory',
    label: 'Second furnace',
    description: '+6 metal per cycle · +6 power demand',
    effects: { output: 6, demand: 6 },
  },
  scrubber: {
    kind: 'factory',
    label: 'Exhaust scrubber',
    description: '75% less ground pollution · +2 power demand',
    effects: { demand: 2, emissionsMultiplier: 0.25 },
  },
  'loading-bay': {
    kind: 'warehouse',
    label: 'Loading bay',
    description:
      '+4 foundry connections · +200 metal storage · +2 power demand',
    effects: { storageCapacity: 4, metalCapacity: 200, demand: 2 },
  },
  'solar-roof': {
    kind: 'warehouse',
    label: 'Solar roof',
    description: '4 less power demand; still needs a grid connection',
    effects: { demand: -4 },
  },
};
export const hasModule = (
  b: { modules?: readonly BuildingModule[] },
  module: BuildingModule,
) => b.modules?.includes(module) ?? false;
export function buildingStats<
  T extends { type: BuildingKind; modules?: readonly BuildingModule[] },
>(b: T) {
  const definition = BUILDINGS[b.type];
  const effects = (stat: keyof StatEffects) =>
    (b.modules ?? []).reduce(
      (sum, id) => sum + (MODULES[id].effects[stat] ?? 0),
      0,
    );
  return {
    demand: definition.powerDemand + effects('demand'),
    powerCapacity: definition.powerCapacity + effects('powerCapacity'),
    storageCapacity: definition.storageConnections + effects('storageCapacity'),
    metalCapacity: definition.metalCapacity + effects('metalCapacity'),
    output: definition.output + effects('output'),
    heatOutput: effects('heatOutput'),
    emissions:
      definition.emissions *
      (b.modules ?? []).reduce(
        (factor, id) => factor * (MODULES[id].effects.emissionsMultiplier ?? 1),
        1,
      ),
  };
}
