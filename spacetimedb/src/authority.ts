/** Reducer-independent planning. No writes, local numeric IDs, clocks or client identity claims. */
import { BUILDINGS, MODULES } from '../../shared/city/catalog';
import { identityKey, receiptKey } from '../../shared/city/keys';
import {
  canonicalCommand,
  U64_MAX,
  MAX_BATCH_SOURCES,
  type CommandResult,
  type LiveCityCommand,
  type StockSource,
} from '../../shared/city/live-protocol';
import {
  parseLiveCommand,
  requireU64,
  CommandValidationError,
} from '../../shared/city/validate-command';
import { PROJECTS } from '../../shared/city/technology';
import type {
  BuildingKind,
  BuildingModule,
  ProjectId,
  TechnologyId,
} from '../../shared/city/ids';

export interface CommandReceipt {
  actor: string;
  requestId: string;
  sequence: bigint;
  fingerprint: string;
  result: CommandResult;
}
export interface CommandCursor {
  actor: string;
  lastSequence: bigint;
}
export type Admission =
  | {
      kind: 'fresh';
      command: LiveCityCommand;
      actor: string;
      key: string;
      fingerprint: string;
    }
  | { kind: 'replay'; result: CommandResult }
  | {
      kind: 'blocked';
      code:
        | 'request-conflict'
        | 'sequence-gap'
        | 'receipt-expired'
        | 'not-registered';
      reason: string;
    };

export function admitCommand(input: {
  sender: string;
  registered: boolean;
  command: unknown;
  cursor: CommandCursor | null;
  receipt: CommandReceipt | null;
}): Admission {
  const command = parseLiveCommand(input.command),
    actor = identityKey(input.sender),
    fingerprint = canonicalCommand(command);
  if (input.cursor && identityKey(input.cursor.actor) !== actor)
    throw Error('Cursor belongs to another identity.');
  const receipt = input.receipt;
  if (receipt) {
    if (
      identityKey(receipt.actor) !== actor ||
      receipt.requestId !== command.requestId
    )
      throw Error('Receipt lookup returned another identity or request.');
    if (
      receipt.sequence !== command.sequence ||
      receipt.fingerprint !== fingerprint
    )
      return {
        kind: 'blocked',
        code: 'request-conflict',
        reason: 'This request ID was used with a different command.',
      };
    if (
      receipt.result.requestId !== receipt.requestId ||
      receipt.result.sequence !== receipt.sequence
    )
      throw Error('Inconsistent terminal receipt.');
    return { kind: 'replay', result: receipt.result };
  }
  const last = input.cursor?.lastSequence ?? 0n;
  requireU64(last);
  if (command.sequence <= last)
    return {
      kind: 'blocked',
      code: 'receipt-expired',
      reason:
        'This command sequence was already settled. Do not execute it again.',
    };
  if (command.sequence !== last + 1n)
    return {
      kind: 'blocked',
      code: 'sequence-gap',
      reason: 'Synchronize the identity command cursor before retrying.',
    };
  if (!input.registered && command.kind !== 'register-profile')
    return {
      kind: 'blocked',
      code: 'not-registered',
      reason: 'Register your citizen profile first.',
    };
  return {
    kind: 'fresh',
    command,
    actor,
    key: receiptKey(actor, command.requestId),
    fingerprint,
  };
}
/** Persist the receipt and cursor in the SAME transaction as accepted world writes. */
export function terminalReceipt(
  admission: Extract<Admission, { kind: 'fresh' }>,
  result: CommandResult,
): { receipt: CommandReceipt; cursor: CommandCursor } {
  if (
    result.requestId !== admission.command.requestId ||
    result.sequence !== admission.command.sequence
  )
    throw Error('Result does not match the admitted command.');
  requireU64(result.revision);
  return {
    receipt: {
      actor: admission.actor,
      requestId: result.requestId,
      sequence: result.sequence,
      fingerprint: admission.fingerprint,
      result,
    },
    cursor: { actor: admission.actor, lastSequence: result.sequence },
  };
}
const reject = (
  code: ConstructorParameters<typeof CommandValidationError>[0],
  message: string,
): never => {
  throw new CommandValidationError(code, message);
};
export function nextRevision(revision: bigint): bigint {
  requireU64(revision);
  if (revision === U64_MAX)
    return reject('limit-reached', 'Revision limit reached.');
  return revision + 1n;
}
export function planSeenMarker(
  previous: bigint,
  requested: bigint,
  latestEventId: bigint,
): bigint {
  requireU64(previous);
  requireU64(requested);
  requireU64(latestEventId);
  if (requested > latestEventId)
    return reject(
      'invalid-command',
      'Cannot acknowledge an event that does not exist.',
    );
  return requested > previous ? requested : previous;
}
export interface AuthoritativeBuilding {
  id: bigint;
  kind: BuildingKind;
  creator?: string;
  revision: bigint;
  enabled: boolean;
  modules: readonly BuildingModule[];
}
type BuildingChange = Extract<
  LiveCityCommand,
  { kind: 'configure-modules' | 'set-operating' | 'set-billboard' }
>;
export function authorizeBuildingChange(
  sender: string,
  command: BuildingChange,
  building: AuthoritativeBuilding,
): void {
  if (command.buildingId !== building.id)
    return reject('invalid-command', 'Structure does not match this command.');
  if (command.expectedBuildingRevision !== building.revision)
    return reject(
      'stale-revision',
      'The structure changed. Refresh its forecast.',
    );
  const owner =
    building.creator !== undefined &&
    identityKey(building.creator) === identityKey(sender);
  if (command.kind === 'configure-modules') {
    if (command.modules.some((id) => MODULES[id].kind !== building.kind))
      return reject(
        'invalid-command',
        'Machinery does not fit this structure.',
      );
    if (!owner && building.modules.some((id) => !command.modules.includes(id)))
      return reject(
        'forbidden',
        'Only the creator can remove installed machinery.',
      );
  } else if (command.kind === 'set-operating') {
    if (!owner && !command.enabled)
      return reject(
        'forbidden',
        'Only the creator can shut down this structure.',
      );
  } else if (!owner)
    return reject('forbidden', 'Only the creator can change this facade.');
}
export interface WarehouseSnapshot {
  id: bigint;
  kind: BuildingKind;
  revision: bigint;
  stockRevision: bigint;
  metal: bigint;
  active: boolean;
}
export function planStockTransfers(
  sources: readonly StockSource[],
  warehouses: ReadonlyMap<bigint, WarehouseSnapshot>,
) {
  if (sources.length < 1 || sources.length > MAX_BATCH_SOURCES)
    return reject('invalid-command', 'Choose 1–64 warehouse sources.');
  const seen = new Set<bigint>();
  let total = 0n;
  const updates = sources.map((source) => {
    if (seen.has(source.buildingId))
      return reject('invalid-command', 'Duplicate warehouse source.');
    seen.add(source.buildingId);
    requireU64(source.amount, true);
    const warehouse = warehouses.get(source.buildingId);
    if (
      !warehouse ||
      BUILDINGS[warehouse.kind].role !== 'storage' ||
      !warehouse.active
    )
      return reject('missing-service', 'A source needs a powered warehouse.');
    requireU64(warehouse.metal);
    if (
      source.expectedBuildingRevision !== warehouse.revision ||
      source.expectedStockRevision !== warehouse.stockRevision
    )
      return reject(
        'stale-revision',
        'Warehouse stock or services changed. Refresh the forecast.',
      );
    if (source.amount > warehouse.metal)
      return reject(
        'insufficient-stock',
        'The warehouse no longer has enough metal.',
      );
    total += source.amount;
    if (total > U64_MAX)
      return reject(
        'limit-reached',
        'Transfer total exceeds the quantity limit.',
      );
    return {
      buildingId: warehouse.id,
      metal: warehouse.metal - source.amount,
      revision: nextRevision(warehouse.stockRevision),
    };
  });
  if (!updates.length)
    return reject('invalid-command', 'Choose at least one source warehouse.');
  return { total, updates };
}
export interface ProjectSnapshot {
  id: ProjectId;
  definitionVersion: number;
  requiredAmount: bigint;
  deliveredAmount: bigint;
  revision: bigint;
}
export function planProjectContribution(
  command: Extract<LiveCityCommand, { kind: 'contribute-project' }>,
  project: ProjectSnapshot,
  warehouses: ReadonlyMap<bigint, WarehouseSnapshot>,
  unlocked: readonly TechnologyId[],
) {
  if (
    command.projectId !== project.id ||
    project.definitionVersion !== PROJECTS[project.id].version
  )
    return reject(
      'invalid-command',
      'Project content needs a compatible definition.',
    );
  requireU64(project.requiredAmount, true);
  requireU64(project.deliveredAmount);
  if (project.deliveredAmount > project.requiredAmount)
    throw Error('Project deliveries exceed the frozen requirement.');
  if (project.deliveredAmount === project.requiredAmount)
    return reject('project-complete', 'This project is already complete.');
  if (command.expectedProjectRevision !== project.revision)
    return reject(
      'stale-revision',
      'Project progress changed. Refresh its forecast.',
    );
  if (
    PROJECTS[project.id].prerequisites.some((id) => !unlocked.includes(id)) ||
    (command.sources.length > 1 && !unlocked.includes('shared-procurement'))
  )
    return reject('technology-locked', 'Required technology is not available.');
  const transfer = planStockTransfers(command.sources, warehouses),
    deliveredAmount = project.deliveredAmount + transfer.total;
  if (deliveredAmount > project.requiredAmount)
    return reject(
      'stale-revision',
      'The project needs less metal. Refresh the contribution.',
    );
  return {
    ...transfer,
    project: {
      ...project,
      deliveredAmount,
      revision: nextRevision(project.revision),
    },
    unlock:
      deliveredAmount === project.requiredAmount
        ? PROJECTS[project.id].unlock
        : null,
  };
}
export function planDispatch(
  command: Extract<
    LiveCityCommand,
    { kind: 'dispatch-metal' | 'dispatch-metal-batch' }
  >,
  warehouses: ReadonlyMap<bigint, WarehouseSnapshot>,
  shippedMetal: bigint,
  unlocked: readonly TechnologyId[],
) {
  if (
    command.kind === 'dispatch-metal-batch' &&
    !unlocked.includes('coordinated-logistics')
  )
    return reject('technology-locked', 'Coordinated dispatch is not unlocked.');
  requireU64(shippedMetal);
  const transfer = planStockTransfers(
    command.kind === 'dispatch-metal' ? [command.source] : command.sources,
    warehouses,
  );
  if (shippedMetal + transfer.total > U64_MAX)
    return reject(
      'limit-reached',
      'Dispatch total exceeds the quantity limit.',
    );
  return { ...transfer, shippedMetal: shippedMetal + transfer.total };
}
