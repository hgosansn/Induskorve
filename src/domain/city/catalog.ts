import type { BuildingKind } from './model';

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
  powerRange: 4.5,
  powerCapacity: 80,
  storageRange: 3.5,
  storageCapacity: 8,
  revealRadius: 2.65,
  maxBuildings: 2500,
  maxCitizens: 100,
} as const;
