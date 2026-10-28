import { schema, table, t } from 'spacetimedb/server';

// Schema preparation only. There are intentionally no client-writable reducers yet.
// All persisted IDs/revisions/quantities are u64, never floating point JS numbers.
const spacetimedb = schema({
  world: table(
    { public: true },
    {
      id: t.u32().primaryKey(),
      schemaVersion: t.u32(),
      revision: t.u64(),
      tick: t.u64(),
    },
  ),
  citizen: table(
    { public: true },
    {
      identity: t.identity().primaryKey(),
      name: t.string(),
      avatarSeed: t.u32(),
      createdAt: t.timestamp(),
    },
  ),
  presence: table(
    { public: true },
    {
      identity: t.identity().primaryKey(),
      chunkKey: t.string().index(),
      x: t.f32(),
      y: t.f32(),
      online: t.bool(),
      updatedAt: t.timestamp(),
    },
  ),
  building: table(
    { public: true },
    {
      id: t.u64().primaryKey().autoInc(),
      cellKey: t.string().unique(),
      chunkKey: t.string().index(),
      x: t.i32(),
      y: t.i32(),
      kind: t.string(),
      enabled: t.bool(),
      creator: t.identity(),
      revision: t.u64(),
    },
  ),
  buildingAppearance: table(
    { public: true },
    {
      buildingId: t.u64().primaryKey(),
      chunkKey: t.string().index(),
      height: t.f32(),
      seed: t.f64(),
      billboardAssetId: t.u64().optional(),
    },
  ),
  terrainTile: table(
    { public: true },
    {
      cellKey: t.string().primaryKey(),
      chunkKey: t.string().index(),
      x: t.i32(),
      y: t.i32(),
    },
  ),
  network: table(
    { public: true },
    {
      id: t.u64().primaryKey().autoInc(),
      kind: t.string(),
      revision: t.u64(),
    },
  ),
  networkMembership: table(
    { public: true },
    {
      id: t.string().primaryKey(),
      networkId: t.u64().index(),
      buildingId: t.u64().index(),
    },
  ),
  inventory: table(
    { public: true },
    {
      id: t.string().primaryKey(),
      networkId: t.u64().index(),
      resource: t.string(),
      amount: t.u64(),
    },
  ),
  worldEvent: table(
    { public: true },
    {
      id: t.u64().primaryKey().autoInc(),
      chunkKey: t.string().index(),
      actor: t.identity().optional(),
      buildingId: t.u64().optional(),
      kind: t.string(),
      createdAt: t.timestamp(),
    },
  ),
  // Only approved media records belong here. Unreviewed uploads remain private.
  billboardAsset: table(
    { public: true },
    {
      id: t.u64().primaryKey().autoInc(),
      owner: t.identity(),
      url: t.string(),
      mime: t.string(),
    },
  ),
  actionAllowance: table(
    { public: false },
    {
      identity: t.identity().primaryKey(),
      tokens: t.u32(),
      updatedAt: t.timestamp(),
    },
  ),
  session: table(
    { public: false },
    {
      connectionId: t.connectionId().primaryKey(),
      identity: t.identity().index(),
    },
  ),
  simulationState: table(
    { public: false },
    {
      id: t.u32().primaryKey(),
      nextTickAt: t.timestamp(),
      topologyRevision: t.u64(),
    },
  ),
});
export default spacetimedb;
