import { describe, expect, it } from 'vitest';
import { ACTION_POLICY } from '../../shared/city/action-policy';
import { BUILDINGS as SHARED_BUILDINGS } from '../../shared/city/catalog';
import { BUILDINGS } from '../../src/domain/city/catalog';
import { PROJECTS as SHARED_PROJECTS } from '../../shared/city/technology';
import { PROJECTS } from '../../src/domain/city/technology';
import {
  canonicalCommand,
  U64_MAX,
  type LiveCityCommand,
  type CommandResult,
  type StockSource,
} from '../../shared/city/live-protocol';
import { parseLiveCommand } from '../../shared/city/validate-command';
import { contributionKey, receiptKey } from '../../shared/city/keys';
import {
  admitCommand,
  authorizeBuildingChange,
  nextRevision,
  planDispatch,
  planProjectContribution,
  planSeenMarker,
  terminalReceipt,
  type AuthoritativeBuilding,
  type WarehouseSnapshot,
} from '../../spacetimedb/src/authority';

const actor = 'a'.repeat(64),
  other = 'b'.repeat(64);
const uuid = (n: number) =>
  `00000000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`;
const envelope = {
  protocolVersion: 1 as const,
  contentVersion: 1 as const,
  requestId: uuid(1),
  sequence: 1n,
};
const warehouseId = 9_007_199_254_740_993n;
const source: StockSource = {
  buildingId: warehouseId,
  amount: 160n,
  expectedBuildingRevision: 2n,
  expectedStockRevision: 3n,
};
const command: Extract<LiveCityCommand, { kind: 'contribute-project' }> = {
  ...envelope,
  kind: 'contribute-project',
  projectId: 'freight-coordination',
  expectedProjectRevision: 0n,
  sources: [source],
};
const warehouse: WarehouseSnapshot = {
  id: warehouseId,
  kind: 'warehouse',
  revision: 2n,
  stockRevision: 3n,
  metal: 300n,
  active: true,
};
const warehouses = () => new Map([[warehouse.id, { ...warehouse }]]);
const project = {
  id: 'freight-coordination' as const,
  definitionVersion: 1,
  requiredAmount: 160n,
  deliveredAmount: 0n,
  revision: 0n,
};
const fresh = (c: LiveCityCommand = command) => {
  const admission = admitCommand({
    sender: actor,
    registered: true,
    command: c,
    cursor: null,
    receipt: null,
  });
  if (admission.kind !== 'fresh') throw Error('Expected fresh command');
  return admission;
};

describe('persistent command boundary', () => {
  it('uses one catalog in browser and server without changing content identities', () => {
    expect(BUILDINGS).toBe(SHARED_BUILDINGS);
    expect(PROJECTS).toBe(SHARED_PROJECTS);
    expect(ACTION_POLICY.forecast.scope).toBe('local');
    expect(ACTION_POLICY['production-tick'].permission).toBe('server');
    expect(ACTION_POLICY.presence.scope).toBe('ephemeral');
  });
  it('covers every persistent client action with validated protocol shapes', () => {
    const samples: LiveCityCommand[] = [
      { ...envelope, kind: 'register-profile', name: 'Mira', avatarSeed: 4 },
      {
        ...envelope,
        kind: 'set-profile',
        name: 'Mira',
        avatarSeed: 4,
        expectedProfileRevision: 0n,
      },
      { ...envelope, kind: 'mark-seen', lastSeenEventId: 2n },
      {
        ...envelope,
        kind: 'place-building',
        buildingKind: 'factory',
        modules: ['furnace'],
        position: { x: -1, y: 2 },
        appearance: {
          height: 40,
          layoutSeed: 123,
          shape: 'block',
          balcony: true,
          display: 'animated',
        },
      },
      {
        ...envelope,
        kind: 'configure-modules',
        buildingId: warehouseId,
        modules: ['loading-bay'],
        expectedBuildingRevision: 2n,
      },
      {
        ...envelope,
        kind: 'set-operating',
        buildingId: warehouseId,
        enabled: true,
        expectedBuildingRevision: 2n,
      },
      {
        ...envelope,
        kind: 'set-billboard',
        buildingId: warehouseId,
        assetId: null,
        expectedBuildingRevision: 2n,
      },
      command,
      { ...envelope, kind: 'dispatch-metal', source },
      { ...envelope, kind: 'dispatch-metal-batch', sources: [source] },
    ];
    expect(samples.map((s) => parseLiveCommand(s).kind).sort()).toEqual(
      Object.entries(ACTION_POLICY)
        .filter(([, p]) => p.retry === 'receipt')
        .map(([id]) => id)
        .sort(),
    );
    expect(parseLiveCommand(command)).toEqual(command);
  });
  it('rejects identity spoofing, local actions, implicit toggles, malformed quantities and extra totals', () => {
    for (const invalid of [
      { ...command, sender: other },
      { ...command, producedMetal: 1n },
      { ...command, protocolVersion: 2 },
      { ...command, sequence: 1 },
      { ...command, sequence: 0n },
      { ...command, requestId: 'request' },
      { ...command, sources: [{ ...source, amount: 160 }] },
      { ...command, sources: [{ ...source, amount: U64_MAX + 1n }] },
      { ...command, sources: [source, source] },
      { ...command, sources: [] },
      {
        ...command,
        sources: Array.from({ length: 65 }, (_, i) => ({
          ...source,
          buildingId: BigInt(i),
        })),
      },
      { ...envelope, kind: 'toggle', buildingId: warehouseId },
      { ...envelope, kind: 'forecast' },
      {
        ...envelope,
        kind: 'set-billboard',
        buildingId: warehouseId,
        assetId: 'data:image/png;base64,AAAA',
        expectedBuildingRevision: 2n,
      },
    ])
      expect(() => parseLiveCommand(invalid)).toThrow();
  });
  it('canonicalizes unordered modules and sources while preserving every bigint bit', () => {
    const a = {
      ...envelope,
      kind: 'configure-modules' as const,
      buildingId: warehouseId,
      modules: ['loading-bay', 'solar-roof'] as (
        'loading-bay' | 'solar-roof'
      )[],
      expectedBuildingRevision: 2n,
    };
    expect(canonicalCommand(a)).toBe(
      canonicalCommand({ ...a, modules: [...a.modules].reverse() }),
    );
    expect(canonicalCommand(command)).toContain(warehouseId.toString());
    expect(canonicalCommand(command)).not.toBe(
      canonicalCommand({
        ...command,
        sources: [{ ...source, buildingId: warehouseId - 1n }],
      }),
    );
  });
});
describe('request admission and terminal outcomes', () => {
  it('replays an accepted result and rejects reuse with a different payload', () => {
    const admission = fresh(),
      result: CommandResult = {
        requestId: command.requestId,
        sequence: 1n,
        accepted: true,
        revision: 9n,
        eventId: 5n,
      };
    const settled = terminalReceipt(admission, result);
    expect(
      admitCommand({
        sender: actor,
        registered: true,
        command,
        cursor: settled.cursor,
        receipt: settled.receipt,
      }),
    ).toEqual({ kind: 'replay', result });
    expect(
      admitCommand({
        sender: actor,
        registered: true,
        command: { ...command, sources: [{ ...source, amount: 159n }] },
        cursor: settled.cursor,
        receipt: settled.receipt,
      }),
    ).toMatchObject({ kind: 'blocked', code: 'request-conflict' });
    expect(
      admitCommand({
        sender: actor,
        registered: true,
        command,
        cursor: settled.cursor,
        receipt: null,
      }),
    ).toMatchObject({ kind: 'blocked', code: 'receipt-expired' });
  });
  it('persists business rejections once while allowing the next identity sequence', () => {
    const settled = terminalReceipt(fresh(), {
      requestId: command.requestId,
      sequence: 1n,
      accepted: false,
      revision: 8n,
      code: 'stale-revision',
      reason: 'Stock changed.',
    });
    expect(
      admitCommand({
        sender: actor,
        registered: true,
        command,
        cursor: settled.cursor,
        receipt: settled.receipt,
      }),
    ).toMatchObject({ kind: 'replay', result: { accepted: false } });
    expect(
      admitCommand({
        sender: actor,
        registered: true,
        command: { ...command, requestId: uuid(2), sequence: 2n },
        cursor: settled.cursor,
        receipt: null,
      }),
    ).toMatchObject({ kind: 'fresh' });
  });
  it('blocks out-of-order requests, foreign receipts and unregistered world mutations', () => {
    expect(
      admitCommand({
        sender: actor,
        registered: true,
        command: { ...command, sequence: 2n },
        cursor: null,
        receipt: null,
      }),
    ).toMatchObject({ kind: 'blocked', code: 'sequence-gap' });
    expect(
      admitCommand({
        sender: actor,
        registered: false,
        command,
        cursor: null,
        receipt: null,
      }),
    ).toMatchObject({ kind: 'blocked', code: 'not-registered' });
    const settled = terminalReceipt(fresh(), {
      requestId: command.requestId,
      sequence: 1n,
      accepted: true,
      revision: 1n,
    });
    expect(() =>
      admitCommand({
        sender: other,
        registered: true,
        command,
        cursor: null,
        receipt: settled.receipt,
      }),
    ).toThrow('another identity');
    expect(receiptKey(actor, uuid(1))).not.toBe(receiptKey(other, uuid(1)));
    expect(contributionKey('freight-coordination', actor.toUpperCase())).toBe(
      contributionKey('freight-coordination', actor),
    );
    expect(() =>
      terminalReceipt(fresh(), {
        requestId: uuid(2),
        sequence: 1n,
        accepted: true,
        revision: 1n,
      }),
    ).toThrow('match');
  });
});
describe('cooperative permissions and atomic transfer planning', () => {
  const building: AuthoritativeBuilding = {
    id: 3n,
    kind: 'power',
    creator: actor,
    revision: 5n,
    enabled: false,
    modules: ['turbine'],
  };
  it('allows additive cooperation and restarting, but protects removal, shutdown and facades', () => {
    expect(() =>
      authorizeBuildingChange(
        other,
        {
          ...envelope,
          kind: 'configure-modules',
          buildingId: 3n,
          expectedBuildingRevision: 5n,
          modules: ['turbine', 'heat-exchanger'],
        },
        building,
      ),
    ).not.toThrow();
    expect(() =>
      authorizeBuildingChange(
        other,
        {
          ...envelope,
          kind: 'configure-modules',
          buildingId: 3n,
          expectedBuildingRevision: 5n,
          modules: [],
        },
        building,
      ),
    ).toThrow('creator');
    expect(() =>
      authorizeBuildingChange(
        other,
        {
          ...envelope,
          kind: 'set-operating',
          buildingId: 3n,
          expectedBuildingRevision: 5n,
          enabled: true,
        },
        building,
      ),
    ).not.toThrow();
    expect(() =>
      authorizeBuildingChange(
        other,
        {
          ...envelope,
          kind: 'set-operating',
          buildingId: 3n,
          expectedBuildingRevision: 5n,
          enabled: false,
        },
        building,
      ),
    ).toThrow('creator');
    expect(() =>
      authorizeBuildingChange(
        other,
        {
          ...envelope,
          kind: 'set-billboard',
          buildingId: 3n,
          expectedBuildingRevision: 5n,
          assetId: 1n,
        },
        building,
      ),
    ).toThrow('creator');
    expect(() =>
      authorizeBuildingChange(
        actor,
        {
          ...envelope,
          kind: 'set-operating',
          buildingId: 3n,
          expectedBuildingRevision: 4n,
          enabled: false,
        },
        building,
      ),
    ).toThrow('changed');
  });
  it('conserves metal, records an exact unlock boundary and never mutates the input snapshot', () => {
    const stores = warehouses(),
      before = structuredClone(stores);
    const plan = planProjectContribution(command, project, stores, []);
    expect(plan.updates[0]?.buildingId).toBe(warehouseId);
    expect(plan.updates[0]!.metal + plan.project.deliveredAmount).toBe(
      warehouse.metal,
    );
    expect(plan.unlock).toBe('shared-procurement');
    expect(stores).toEqual(before);
    expect(plan.project.revision).toBe(1n);
  });
  it('rejects stale, unpowered, duplicate, insufficient and excessive transfers before any write', () => {
    const stores = warehouses(),
      before = structuredClone(stores);
    for (const sources of [
      [{ ...source, expectedStockRevision: 2n }],
      [{ ...source, amount: 301n }],
      [{ ...source, amount: 161n }],
      [source, source],
    ])
      expect(() =>
        planProjectContribution({ ...command, sources }, project, stores, [
          'shared-procurement',
        ]),
      ).toThrow();
    stores.get(warehouseId)!.active = false;
    expect(() => planProjectContribution(command, project, stores, [])).toThrow(
      'powered',
    );
    stores.get(warehouseId)!.active = true;
    expect(stores).toEqual(before);
    expect(() =>
      planProjectContribution(
        command,
        { ...project, revision: 1n },
        stores,
        [],
      ),
    ).toThrow('changed');
    expect(() =>
      planProjectContribution(
        command,
        { ...project, deliveredAmount: 160n },
        stores,
        [],
      ),
    ).toThrow('complete');
  });
  it('enforces pooled funding prerequisites and dispatch capabilities with source snapshots', () => {
    const stores = warehouses();
    stores.set(2n, { ...warehouse, id: 2n, metal: 20n });
    const sources = [
      { ...source, amount: 140n },
      { ...source, buildingId: 2n, amount: 20n },
    ];
    expect(() =>
      planProjectContribution({ ...command, sources }, project, stores, []),
    ).toThrow('technology');
    expect(
      planProjectContribution({ ...command, sources }, project, stores, [
        'shared-procurement',
      ]).total,
    ).toBe(160n);
    const batch = {
      ...envelope,
      kind: 'dispatch-metal-batch' as const,
      sources,
    };
    expect(() => planDispatch(batch, stores, 4n, [])).toThrow('unlocked');
    const plan = planDispatch(batch, stores, 4n, ['coordinated-logistics']);
    expect(plan.shippedMetal).toBe(164n);
    expect(
      plan.updates.reduce((sum, s) => sum + s.metal, 0n) + plan.shippedMetal,
    ).toBe(324n);
    expect(() =>
      planDispatch(batch, stores, U64_MAX, ['coordinated-logistics']),
    ).toThrow('limit');
  });
  it('keeps frozen project requirements and monotonic visit markers explicit', () => {
    const plan = planProjectContribution(
      { ...command, sources: [{ ...source, amount: 40n }] },
      { ...project, requiredAmount: 200n, deliveredAmount: 160n },
      warehouses(),
      [],
    );
    expect(plan.project.requiredAmount).toBe(200n);
    expect(plan.unlock).toBe('shared-procurement');
    expect(planSeenMarker(8n, 5n, 10n)).toBe(8n);
    expect(planSeenMarker(8n, 10n, 10n)).toBe(10n);
    expect(() => planSeenMarker(8n, 11n, 10n)).toThrow('does not exist');
    expect(() => nextRevision(U64_MAX)).toThrow('limit');
  });
});
