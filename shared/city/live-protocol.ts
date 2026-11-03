import type { BuildingKind, BuildingModule, ProjectId } from './ids';

export const LIVE_PROTOCOL_VERSION = 1;
export const U64_MAX = 18_446_744_073_709_551_615n;
export const MAX_BATCH_SOURCES = 64;
export type LiveId = bigint;
export interface CommandEnvelope {
  protocolVersion: 1;
  contentVersion: 1;
  requestId: string;
  /** Per-identity durable sequence, not a per-tab counter. */
  sequence: bigint;
}
export interface LiveAppearance {
  height: number;
  layoutSeed: number;
  shape: 'block' | 'stepped' | 'tower';
  balcony: boolean;
  display: 'animated' | 'none';
}
export interface StockSource {
  buildingId: LiveId;
  amount: bigint;
  expectedBuildingRevision: bigint;
  expectedStockRevision: bigint;
}
export type LiveCityCommand = CommandEnvelope &
  (
    | { kind: 'register-profile'; name: string; avatarSeed: number }
    | {
        kind: 'set-profile';
        name: string;
        avatarSeed: number;
        expectedProfileRevision: bigint;
      }
    | { kind: 'mark-seen'; lastSeenEventId: bigint }
    | {
        kind: 'place-building';
        buildingKind: BuildingKind;
        modules: BuildingModule[];
        position: { x: number; y: number };
        appearance: LiveAppearance;
      }
    | {
        kind: 'configure-modules';
        buildingId: LiveId;
        modules: BuildingModule[];
        expectedBuildingRevision: bigint;
      }
    | {
        kind: 'set-operating';
        buildingId: LiveId;
        enabled: boolean;
        expectedBuildingRevision: bigint;
      }
    | {
        kind: 'set-billboard';
        buildingId: LiveId;
        assetId: LiveId | null;
        expectedBuildingRevision: bigint;
      }
    | {
        kind: 'contribute-project';
        projectId: ProjectId;
        expectedProjectRevision: bigint;
        sources: StockSource[];
      }
    | { kind: 'dispatch-metal'; source: StockSource }
    | { kind: 'dispatch-metal-batch'; sources: StockSource[] }
  );
export const REJECTION_CODES = [
  'invalid-command',
  'not-registered',
  'forbidden',
  'stale-revision',
  'insufficient-stock',
  'missing-service',
  'project-complete',
  'technology-locked',
  'request-conflict',
  'sequence-gap',
  'receipt-expired',
  'limit-reached',
] as const;
export type RejectionCode = (typeof REJECTION_CODES)[number];
export type CommandResult =
  | {
      requestId: string;
      sequence: bigint;
      accepted: true;
      revision: bigint;
      eventId?: bigint;
    }
  | {
      requestId: string;
      sequence: bigint;
      accepted: false;
      revision: bigint;
      code: RejectionCode;
      reason: string;
    };

/** Canonical payload for receipt equality, not a cryptographic signature. */
export function canonicalCommand(command: LiveCityCommand): string {
  const normalized = { ...command };
  if ('modules' in normalized)
    normalized.modules = [...normalized.modules].sort();
  if ('sources' in normalized)
    normalized.sources = [...normalized.sources].sort((a, b) =>
      a.buildingId < b.buildingId ? -1 : a.buildingId > b.buildingId ? 1 : 0,
    );
  const encode = (value: unknown): unknown => {
    if (typeof value === 'bigint') return { $u64: value.toString() };
    if (Array.isArray(value)) return value.map(encode);
    if (value && typeof value === 'object')
      return Object.fromEntries(
        Object.keys(value)
          .sort()
          .map((key) => [key, encode((value as Record<string, unknown>)[key])]),
      );
    return value;
  };
  return JSON.stringify(encode(normalized));
}
