import type { ResourceId } from './exchanges';
import type { ProjectId, TechnologyId } from './ids';
export type { ProjectId, TechnologyId } from './ids';
export type Capability = 'pooled-funding' | 'dispatch-all';
export interface TechnologyDefinition {
  version: number;
  label: string;
  description: string;
  branch: 'logistics';
  prerequisites: readonly TechnologyId[];
  capabilities: readonly Capability[];
}
export const TECHNOLOGIES = {
  'shared-procurement': {
    version: 1,
    label: 'Shared procurement',
    branch: 'logistics',
    prerequisites: [],
    description:
      'Coordinate project contributions from several powered warehouses in one action.',
    capabilities: ['pooled-funding'],
  },
  'coordinated-logistics': {
    version: 1,
    label: 'Coordinated logistics',
    branch: 'logistics',
    prerequisites: ['shared-procurement'],
    description:
      'Dispatch available metal from all powered warehouses in one action.',
    capabilities: ['dispatch-all'],
  },
} as const satisfies Record<TechnologyId, TechnologyDefinition>;
export interface ProjectDefinition {
  version: number;
  label: string;
  description: string;
  resource: ResourceId;
  cost: number;
  prerequisites: readonly TechnologyId[];
  unlock: TechnologyId;
}
export const PROJECTS = {
  'freight-coordination': {
    version: 1,
    label: 'Freight coordination',
    resource: 'metal',
    cost: 160,
    prerequisites: [],
    description:
      'Equip the district to coordinate material contributions between warehouses.',
    unlock: 'shared-procurement',
  },
  'materials-exchange': {
    version: 1,
    label: 'Materials exchange',
    resource: 'metal',
    cost: 320,
    prerequisites: ['shared-procurement'],
    description:
      'Commission coordinated dispatch for the district’s powered warehouses.',
    unlock: 'coordinated-logistics',
  },
} as const satisfies Record<ProjectId, ProjectDefinition>;
