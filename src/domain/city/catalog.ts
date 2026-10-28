import type { Building, BuildingKind, BuildingModule } from './model';

// Gameplay definitions contain no CSS, icons, palettes or renderer instructions.
export const BUILDINGS = {
  factory: { label: 'Ironworks', powerDemand: 12, requiresStorage: true },
  power: {
    label: 'Generating station',
    powerDemand: 0,
    requiresStorage: false,
  },
  warehouse: {
    label: 'Freight warehouse',
    powerDemand: 6,
    requiresStorage: false,
  },
} as const satisfies Record<
  BuildingKind,
  { label: string; powerDemand: number; requiresStorage: boolean }
>;
export const RULES = {
  cycleMs: 10_000,
  heatRange: 1.5,
  powerRange: 4.5,
  powerCapacity: 80,
  storageRange: 3.5,
  storageCapacity: 8,
  revealRadius: 2.65,
  maxBuildings: 2500,
  maxCitizens: 100,
} as const;

export const MODULES: Record<
  BuildingModule,
  { label: string; description: string }
> = {
  turbine: { label: 'Extra turbine', description: '+40 power capacity' },
  'heat-exchanger': {
    label: 'Heat recovery',
    description: '+4 metal per cycle to supplied foundries within 1.5 tiles',
  },
  furnace: {
    label: 'Second furnace',
    description: '+6 metal per cycle · +6 power demand',
  },
  scrubber: {
    label: 'Exhaust scrubber',
    description: '75% less ground pollution · +2 power demand',
  },
  'loading-bay': {
    label: 'Loading bay',
    description:
      '+4 foundry connections · +200 metal storage · +2 power demand',
  },
  'solar-roof': {
    label: 'Solar roof',
    description: '4 less power demand; still needs a grid connection',
  },
};
export const hasModule = (
  b: Pick<Building, 'modules'>,
  module: BuildingModule,
) => b.modules?.includes(module) ?? false;
export function buildingStats(b: Building) {
  return {
    demand:
      BUILDINGS[b.type].powerDemand +
      (hasModule(b, 'furnace') ? 6 : 0) +
      (hasModule(b, 'scrubber') ? 2 : 0) +
      (hasModule(b, 'loading-bay') ? 2 : 0) -
      (hasModule(b, 'solar-roof') ? 4 : 0),
    powerCapacity: RULES.powerCapacity + (hasModule(b, 'turbine') ? 40 : 0),
    storageCapacity:
      RULES.storageCapacity + (hasModule(b, 'loading-bay') ? 4 : 0),
    metalCapacity: 200 + (hasModule(b, 'loading-bay') ? 200 : 0),
    output: b.type === 'factory' ? 12 + (hasModule(b, 'furnace') ? 6 : 0) : 0,
    emissions:
      b.type === 'factory'
        ? hasModule(b, 'scrubber')
          ? 1
          : 4
        : b.type === 'power'
          ? 2
          : 0,
  };
}
