import { schema, table, t } from 'spacetimedb/server';

export const productionSchedule = table(
  { public: false },
  {
    scheduledId: t.u64().primaryKey().autoInc(),
    scheduledAt: t.scheduleAt(),
    tick: t.u64(),
  },
);

// Authoritative live schema. Endpoints and scheduling are in reducers.ts.
// Reducer-independent planners are in authority.ts.
// All persisted IDs/revisions/quantities are u64, never floating point JS numbers.
export const tables = {
  productionSchedule,
  world: table(
    { public: true },
    {
      id: t.u32().primaryKey(),
      schemaVersion: t.u32(),
      contentVersion: t.u32(),
      revision: t.u64(),
      tick: t.u64(),
      shippedMetal: t.u64(),
      bootstrapMetal: t.u64(),
      producedMetal: t.u64(),
    },
  ),
  citizen: table(
    { public: true },
    {
      identity: t.identity().primaryKey(),
      name: t.string(),
      avatarSeed: t.u32(),
      createdAt: t.timestamp(),
      revision: t.u64(),
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
      creator: t.identity().optional(), // absent for system-owned founding infrastructure
      definitionVersion: t.u32(),
      revision: t.u64(),
    },
  ),
  buildingModule: table(
    { public: true },
    {
      id: t.string().primaryKey(), // buildingId:moduleKind, validated by future reducers
      buildingId: t.u64().index(),
      chunkKey: t.string().index(),
      kind: t.string(),
    },
  ),
  warehouseStockpile: table(
    { public: true },
    {
      buildingId: t.u64().primaryKey(),
      chunkKey: t.string().index(),
      metal: t.u64(),
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
      shape: t.string(),
      balcony: t.bool(),
      display: t.string(),
      revision: t.u64(),
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
  cityProject: table(
    { public: true },
    {
      id: t.string().primaryKey(),
      definitionVersion: t.u32(),
      resource: t.string(),
      requiredAmount: t.u64(), // frozen requirement; a patch must not relock completed work
      deliveredAmount: t.u64(),
      revision: t.u64(),
      completedAt: t.timestamp().optional(),
    },
  ),
  projectContribution: table(
    { public: true },
    {
      id: t.string().primaryKey(), // canonical projectId:identity; one aggregate per citizen
      projectId: t.string().index(),
      actor: t.identity().index(),
      amount: t.u64(),
      updatedAt: t.timestamp(),
    },
  ),
  technologyUnlock: table(
    { public: true },
    {
      id: t.string().primaryKey(),
      definitionVersion: t.u32(),
      projectId: t.string(),
      unlockedAt: t.timestamp(),
      eventId: t.u64(),
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
      actorName: t.string().optional(),
      projectId: t.string().optional(),
      technologyId: t.string().optional(),
      resource: t.string().optional(),
      amount: t.u64().optional(),
      summary: t.string(),
      worldRevision: t.u64(),
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
  // Private state requires owner-filtered views before any client gateway is enabled.
  playerState: table(
    { public: false },
    { identity: t.identity().primaryKey(), lastSeenEventId: t.u64() },
  ),
  commandCursor: table(
    { public: false },
    { identity: t.identity().primaryKey(), lastSequence: t.u64() },
  ),
  commandReceipt: table(
    { public: false },
    {
      id: t.string().primaryKey(), // canonical authenticated identity:request UUID
      identity: t.identity().index(),
      sequenceKey: t.string().unique(), // identity:sequence prevents cross-tab reuse
      requestId: t.string(),
      sequence: t.u64(),
      fingerprint: t.string(),
      accepted: t.bool(),
      worldRevision: t.u64(),
      eventId: t.u64().optional(),
      rejectionCode: t.string().optional(),
      reason: t.string().optional(),
      createdAt: t.timestamp(),
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
};
const spacetimedb = schema(tables, {
  env: {
    SPACETIMEAUTH_CLIENT_ID: t.string().optional(),
    INDUSKORVE_DEV_AUTH: t.string().optional(),
    INDUSKORVE_TEST_TICK_MS: t.string().optional(),
  },
});
export default spacetimedb;
