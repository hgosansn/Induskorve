import {
  BUILDING_KINDS,
  MODULE_KINDS,
  PROJECT_IDS,
  CONTENT_VERSION,
} from './ids';
import { MODULES } from './catalog';
import {
  LIVE_PROTOCOL_VERSION,
  MAX_BATCH_SOURCES,
  U64_MAX,
  type LiveCityCommand,
  type RejectionCode,
} from './live-protocol';

export class CommandValidationError extends Error {
  constructor(
    public readonly code: RejectionCode,
    message: string,
  ) {
    super(message);
    this.name = 'CommandValidationError';
  }
}
const fail = (message: string): never => {
  throw new CommandValidationError('invalid-command', message);
};
const record = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return fail('Expected a command object.');
  return value as Record<string, unknown>;
};
const exact = (value: Record<string, unknown>, keys: readonly string[]) => {
  if (
    Object.keys(value).some((key) => !keys.includes(key)) ||
    keys.some((key) => !(key in value))
  )
    fail('Unexpected or missing command fields.');
};
export function requireU64(value: unknown, positive = false): bigint {
  if (
    typeof value !== 'bigint' ||
    value < (positive ? 1n : 0n) ||
    value > U64_MAX
  )
    return fail('Expected a lossless unsigned 64-bit integer.');
  return value;
}
const integer = (value: unknown, min: number, max: number) => {
  if (
    typeof value !== 'number' ||
    !Number.isSafeInteger(value) ||
    value < min ||
    value > max
  )
    fail('Integer outside allowed range.');
};
const name = (value: unknown) => {
  if (
    typeof value !== 'string' ||
    value !== value.trim() ||
    value.length < 1 ||
    value.length > 24 ||
    Array.from(value).some(
      (c) => c.codePointAt(0)! < 32 || c.codePointAt(0) === 127,
    )
  )
    fail('Choose a trimmed name of 1–24 visible characters.');
};
const modules = (value: unknown) => {
  if (
    !Array.isArray(value) ||
    value.length > 2 ||
    new Set(value).size !== value.length ||
    value.some((v) => !MODULE_KINDS.includes(v))
  )
    fail('Invalid or duplicate machinery modules.');
};
const source = (value: unknown) => {
  const s = record(value);
  exact(s, [
    'buildingId',
    'amount',
    'expectedBuildingRevision',
    'expectedStockRevision',
  ]);
  requireU64(s.buildingId);
  requireU64(s.amount, true);
  requireU64(s.expectedBuildingRevision);
  requireU64(s.expectedStockRevision);
};
const sources = (value: unknown) => {
  if (
    !Array.isArray(value) ||
    !value.length ||
    value.length > MAX_BATCH_SOURCES
  )
    return fail('Choose 1–64 warehouse sources.');
  value.forEach(source);
  if (new Set(value.map((s) => record(s).buildingId)).size !== value.length)
    fail('Duplicate warehouse source.');
};

/** Rejects client-supplied identities, production totals and other extra fields. */
export function parseLiveCommand(input: unknown): LiveCityCommand {
  const c = record(input),
    envelope = ['protocolVersion', 'contentVersion', 'requestId', 'sequence'];
  if (
    c.protocolVersion !== LIVE_PROTOCOL_VERSION ||
    c.contentVersion !== CONTENT_VERSION
  )
    fail('Unsupported command or content version.');
  if (
    typeof c.requestId !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
      c.requestId,
    )
  )
    fail('Use a canonical UUID request ID.');
  requireU64(c.sequence, true);
  const fields = (keys: string[]) => exact(c, [...envelope, 'kind', ...keys]);
  switch (c.kind) {
    case 'register-profile':
      fields(['name', 'avatarSeed']);
      name(c.name);
      integer(c.avatarSeed, 0, 4_294_967_295);
      break;
    case 'set-profile':
      fields(['name', 'avatarSeed', 'expectedProfileRevision']);
      name(c.name);
      integer(c.avatarSeed, 0, 4_294_967_295);
      requireU64(c.expectedProfileRevision);
      break;
    case 'mark-seen':
      fields(['lastSeenEventId']);
      requireU64(c.lastSeenEventId);
      break;
    case 'place-building': {
      fields(['buildingKind', 'modules', 'position', 'appearance']);
      if (!BUILDING_KINDS.includes(c.buildingKind as never))
        fail('Unknown building kind.');
      modules(c.modules);
      if (
        (c.modules as (keyof typeof MODULES)[]).some(
          (m) => MODULES[m].kind !== c.buildingKind,
        )
      )
        fail('Machinery does not fit this building.');
      const p = record(c.position);
      exact(p, ['x', 'y']);
      integer(p.x, -1_000_000, 1_000_000);
      integer(p.y, -1_000_000, 1_000_000);
      const a = record(c.appearance);
      exact(a, ['height', 'layoutSeed', 'shape', 'balcony', 'display']);
      integer(a.height, 24, 85);
      integer(a.layoutSeed, 0, 1_000_000);
      if (
        !['block', 'stepped', 'tower'].includes(a.shape as string) ||
        typeof a.balcony !== 'boolean' ||
        !['animated', 'none'].includes(a.display as string)
      )
        fail('Invalid building appearance.');
      break;
    }
    case 'configure-modules':
      fields(['buildingId', 'modules', 'expectedBuildingRevision']);
      requireU64(c.buildingId);
      requireU64(c.expectedBuildingRevision);
      modules(c.modules);
      break;
    case 'set-operating':
      fields(['buildingId', 'enabled', 'expectedBuildingRevision']);
      requireU64(c.buildingId);
      requireU64(c.expectedBuildingRevision);
      if (typeof c.enabled !== 'boolean')
        fail('Expected an explicit operating state.');
      break;
    case 'set-billboard':
      fields(['buildingId', 'assetId', 'expectedBuildingRevision']);
      requireU64(c.buildingId);
      requireU64(c.expectedBuildingRevision);
      if (c.assetId !== null) requireU64(c.assetId);
      break;
    case 'contribute-project':
      fields(['projectId', 'expectedProjectRevision', 'sources']);
      if (!PROJECT_IDS.includes(c.projectId as never)) fail('Unknown project.');
      requireU64(c.expectedProjectRevision);
      sources(c.sources);
      break;
    case 'dispatch-metal':
      fields(['source']);
      source(c.source);
      break;
    case 'dispatch-metal-batch':
      fields(['sources']);
      sources(c.sources);
      break;
    default:
      fail('This action is not a persistent client command.');
  }
  return input as LiveCityCommand;
}
