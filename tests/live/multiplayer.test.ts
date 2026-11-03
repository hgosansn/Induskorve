import { afterAll, describe, expect, it } from 'vitest';
import { DbConnection } from '../../src/infrastructure/spacetimedb/module-bindings';
import { encodeCommand } from '../../shared/city/wire';
import type { LiveCityCommand } from '../../shared/city/live-protocol';
import { createLiveCityStore } from '../../src/infrastructure/spacetimedb/live-store';

const uri = process.env.TEST_SPACETIMEDB_URI ?? 'http://127.0.0.1:3101';
if (!['127.0.0.1', 'localhost'].includes(new URL(uri).hostname))
  throw Error('Live tests may only mutate an isolated loopback database.');
const connections: DbConnection[] = [];
const queries = [
  'world',
  'citizen',
  'building',
  'building_module',
  'warehouse_stockpile',
  'building_appearance',
  'terrain_tile',
  'city_project',
  'project_contribution',
  'technology_unlock',
  'world_event',
  'presence',
  'billboard_asset',
  'my_receipts',
  'my_cursor',
  'my_player_state',
].map((name) => `SELECT * FROM ${name}`);
async function wait(check: () => boolean) {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > 12_000)
      throw Error('Timed out waiting for live state.');
    await new Promise((r) => setTimeout(r, 20));
  }
}
async function connect(token?: string) {
  let issued = '';
  const conn = await new Promise<DbConnection>((resolve, reject) => {
    DbConnection.builder()
      .withUri(uri)
      .withDatabaseName(
        process.env.TEST_SPACETIMEDB_DATABASE ??
          'induskorve-live-integration-2',
      )
      .withToken(token)
      .onConnect((c, _identity, t) => {
        issued = t;
        c.subscriptionBuilder()
          .onApplied(() => resolve(c))
          .onError((ctx) => reject(ctx.event))
          .subscribe(queries);
      })
      .onConnectError((_c, e) => reject(e))
      .build();
  });
  connections.push(conn);
  return { conn, token: issued };
}
type Intent = LiveCityCommand extends infer C
  ? C extends LiveCityCommand
    ? Omit<C, 'requestId' | 'sequence' | 'protocolVersion' | 'contentVersion'>
    : never
  : never;
async function send(conn: DbConnection, intent: Intent) {
  const command = {
    ...intent,
    requestId: crypto.randomUUID(),
    sequence: ([...conn.db.myCursor.iter()][0]?.lastSequence ?? 0n) + 1n,
    protocolVersion: 1,
    contentVersion: 1,
  } as LiveCityCommand;
  await conn.reducers.executeCommand({ payload: encodeCommand(command) });
  await wait(() =>
    [...conn.db.myReceipts.iter()].some(
      (r) => r.requestId === command.requestId,
    ),
  );
  return {
    command,
    result: [...conn.db.myReceipts.iter()].find(
      (r) => r.requestId === command.requestId,
    )!,
  };
}
afterAll(() => connections.forEach((c) => c.disconnect()));
describe('real SpacetimeDB server', () => {
  it('synchronizes two clients, prevents conflicts, conserves metal and reconciles receipts', async () => {
    const a = await connect(),
      b = await connect();
    expect(
      (
        await send(a.conn, {
          kind: 'register-profile',
          name: 'Mira',
          avatarSeed: 1,
        })
      ).result.accepted,
    ).toBe(true);
    expect(
      (
        await send(b.conn, {
          kind: 'register-profile',
          name: 'Sol',
          avatarSeed: 2,
        })
      ).result.accepted,
    ).toBe(true);
    await wait(() => b.conn.db.citizen.count() === 2n);
    const intent = {
      kind: 'place-building' as const,
      buildingKind: 'factory' as const,
      modules: [],
      position: { x: 1, y: 2 },
      appearance: {
        height: 40,
        layoutSeed: 50,
        shape: 'block' as const,
        balcony: true,
        display: 'animated' as const,
      },
    };
    const placed = await Promise.all([
      send(a.conn, intent),
      send(b.conn, intent),
    ]);
    expect(placed.filter((p) => p.result.accepted)).toHaveLength(1);
    await wait(
      () =>
        a.conn.db.building.count() === 4n && b.conn.db.building.count() === 4n,
    );
    expect(
      [...b.conn.db.building.iter()].filter((v) => v.x === 1 && v.y === 2),
    ).toHaveLength(1);
    const own = [...a.conn.db.myReceipts.iter()];
    expect(own.every((r) => r.identity.isEqual(a.conn.identity!))).toBe(true);
    const winning = placed[0]!.result.accepted ? a : b,
      losing = winning === a ? b : a;
    const factory = [...winning.conn.db.building.iter()].find(
      (v) => v.x === 1 && v.y === 2,
    )!;
    expect(
      (
        await send(losing.conn, {
          kind: 'set-operating',
          buildingId: factory.id,
          expectedBuildingRevision: factory.revision,
          enabled: false,
        })
      ).result.accepted,
    ).toBe(false);
    const repeat = placed[winning === a ? 0 : 1]!;
    const before = a.conn.db.worldEvent.count();
    await winning.conn.reducers.executeCommand({
      payload: encodeCommand(repeat.command),
    });
    expect(a.conn.db.worldEvent.count()).toBe(before);
    await expect(
      winning.conn.reducers.executeCommand({
        payload: encodeCommand({
          ...repeat.command,
          position: { x: 2, y: 2 },
        } as LiveCityCommand),
      }),
    ).rejects.toThrow();
    for (const projectId of [
      'freight-coordination',
      'materials-exchange',
    ] as const) {
      while (true) {
        const p = a.conn.db.cityProject.id.find(projectId)!;
        if (p.completedAt) break;
        await wait(() =>
          [...a.conn.db.warehouseStockpile.iter()].some(
            (s) => s.metal === 200n,
          ),
        );
        const stock = [...a.conn.db.warehouseStockpile.iter()].find(
          (s) => s.metal === 200n,
        )!;
        const building = a.conn.db.building.id.find(stock.buildingId)!;
        const amount =
          p.requiredAmount - p.deliveredAmount < stock.metal
            ? p.requiredAmount - p.deliveredAmount
            : stock.metal;
        const result = await send(a.conn, {
          kind: 'contribute-project',
          projectId,
          expectedProjectRevision: p.revision,
          sources: [
            {
              buildingId: stock.buildingId,
              amount,
              expectedBuildingRevision: building.revision,
              expectedStockRevision: stock.revision,
            },
          ],
        });
        if (!result.result.accepted)
          expect(result.result.rejectionCode).toBe('stale-revision');
      }
    }
    await wait(() => b.conn.db.technologyUnlock.count() === 2n);
    const w = [...a.conn.db.world.iter()][0]!,
      stored = [...a.conn.db.warehouseStockpile.iter()].reduce(
        (sum, s) => sum + s.metal,
        0n,
      ),
      contributed = [...a.conn.db.cityProject.iter()].reduce(
        (sum, p) => sum + p.deliveredAmount,
        0n,
      );
    expect(w.producedMetal + w.bootstrapMetal).toBe(
      stored + contributed + w.shippedMetal,
    );
    const extra = await connect(a.token);
    const identity = a.conn.identity!;
    a.conn.disconnect();
    await wait(
      () => extra.conn.db.presence.identity.find(identity)?.online === true,
    );
    expect([...extra.conn.db.myReceipts.iter()].length).toBeGreaterThan(0);
    expect(extra.conn.db.building.count()).toBe(4n);
    const journal = new Map<string, string>();
    const controller = createLiveCityStore({
      uri,
      database: process.env.TEST_SPACETIMEDB_DATABASE!,
      signedIn: true,
      storage: {
        getItem: (k) => journal.get(k) ?? null,
        setItem: (k, v) => {
          journal.set(k, v);
        },
        removeItem: (k) => {
          journal.delete(k);
        },
      },
      async signIn() {},
      async signOut() {},
    });
    try {
      await controller.start();
      expect(controller.gateway.status).toBe('ready');
      await controller.store.getState().join('Controller citizen');
      const state = controller.store.getState();
      expect(state.world.buildings).toHaveLength(4);
      expect(state.citizenId).toBeTruthy();
      state.setTool('shop');
      await controller.store.getState().place({ x: 2, y: 2 });
      await wait(() => extra.conn.db.building.count() === 5n);
      expect(controller.store.getState().world.buildings).toHaveLength(5);
      expect(journal.size).toBe(0);
    } finally {
      controller.dispose();
    }
  });
  it('allows spectators but rejects mutations without SpacetimeAuth in production configuration', async () => {
    const database = process.env.TEST_SPACETIMEDB_AUTH_DATABASE;
    if (!database)
      throw Error(
        'Run npm run test:live to provision the authentication test database.',
      );
    const conn = await new Promise<DbConnection>((resolve, reject) => {
      DbConnection.builder()
        .withUri(uri)
        .withDatabaseName(database)
        .onConnect((c) => {
          c.subscriptionBuilder()
            .onApplied(() => resolve(c))
            .onError((ctx) => reject(ctx.event))
            .subscribe(['SELECT * FROM world', 'SELECT * FROM citizen']);
        })
        .onConnectError((_c, e) => reject(e))
        .build();
    });
    connections.push(conn);
    expect(conn.db.world.count()).toBe(1n);
    await expect(
      conn.reducers.executeCommand({
        payload: encodeCommand({
          kind: 'register-profile',
          name: 'Denied',
          avatarSeed: 1,
          protocolVersion: 1,
          contentVersion: 1,
          requestId: crypto.randomUUID(),
          sequence: 1n,
        }),
      }),
    ).rejects.toThrow(/SpacetimeAuth/);
    expect(conn.db.citizen.count()).toBe(0n);
  });
});
