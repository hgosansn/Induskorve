/** Stable save/protocol identifiers. Renames require a migration. */
export const CONTENT_VERSION = 1;
export const BUILDING_KINDS = [
  'factory',
  'power',
  'warehouse',
  'residential',
  'skyscraper',
  'shop',
] as const;
export type BuildingKind = (typeof BUILDING_KINDS)[number];
export const MODULE_KINDS = [
  'turbine',
  'heat-exchanger',
  'furnace',
  'scrubber',
  'loading-bay',
  'solar-roof',
] as const;
export type BuildingModule = (typeof MODULE_KINDS)[number];
export const PROJECT_IDS = [
  'freight-coordination',
  'materials-exchange',
] as const;
export type ProjectId = (typeof PROJECT_IDS)[number];
export const TECHNOLOGY_IDS = [
  'shared-procurement',
  'coordinated-logistics',
] as const;
export type TechnologyId = (typeof TECHNOLOGY_IDS)[number];
