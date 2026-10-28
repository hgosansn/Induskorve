# SpacetimeDB integration preparation

Status: schema and application/wire contracts prepared and typechecked. No instance is provisioned, no module is published, and the application remains local. Generated bindings are not fabricated.

The schema uses the official `spacetimedb/server` API. It exposes no write reducers yet. Public tables support subscriptions; writes must eventually pass through authoritative reducers. References: [tables](https://spacetimedb.com/docs/tables/) and [TypeScript SDK](https://spacetimedb.com/docs/clients/typescript/).

## Tables

| Table              | Key / indexes                             | Role                                                |
| ------------------ | ----------------------------------------- | --------------------------------------------------- |
| world              | singleton ID                              | Schema version, world revision, tick                |
| citizen            | authenticated Identity                    | Profile and avatar seed                             |
| presence           | Identity; chunk                           | Public location/presence, separate from profile     |
| building           | u64 ID; unique cell; chunk                | Kind, position, creator, operating switch, revision |
| buildingAppearance | building ID; chunk                        | Geometry and approved media reference               |
| terrainTile        | cell; chunk                               | Union of local reveal disks                         |
| network            | u64 ID                                    | Topology revision                                   |
| networkMembership  | canonical compound key; network; building | Network membership                                  |
| inventory          | network/resource compound key; network    | Integer resource quantities                         |
| worldEvent         | u64 ID; chunk                             | Bounded public event history                        |
| billboardAsset     | u64 ID                                    | Approved media URLs, no inline images               |
| actionAllowance    | Identity; private                         | Action budgets                                      |
| session            | ConnectionId; Identity; private           | Multi-tab/device tracking                           |
| simulationState    | singleton; private                        | Future scheduler bookkeeping, not yet scheduled     |

Reducers must enforce foreign references, canonical compound keys, valid kinds/resources, names and media approval; references are not automatic foreign-key constraints. Chunks are 16×16 subscription partitions using floor division for negative coordinates. They are not world bounds or separate rooms. Final coordinate envelopes and balancing remain deployment decisions.

## Authority and commands

`src/application/live-city.ts` defines the SDK-independent command/lifecycle port. Identity comes from the authenticated connection and `ctx.sender`, never a display name. Implement:

1. Validated join/profile reducers and private connection tracking. One tab disconnecting must not mark a multi-tab citizen offline.
2. Atomic placement: authentication, integer coordinates, revealed ground, unique cell, resources, action allowance, assigned ID/appearance and local reveal. Concurrent same-cell requests must not overlap.
3. Operating changes with expected revisions, collaborative permissions and rate checks. Recompute affected services and emit an event transactionally.
4. Advert changes using approved media IDs with uploader permissions, content type, size, host and moderation checks. Local data URLs are not transport assets.
5. Server-owned simulation schedules and bootstrap energy/material reserves. Never accept client-authored production totals or capacity.

Commands carry idempotency request IDs. Before launch add private receipts indexed by `(Identity, requestId)`, bounded retention, stale-revision rejection and terminal acknowledgments. Sending a request is not proof of acceptance.

## Read model and reconnect

Generate real bindings into `src/infrastructure/spacetimedb/module-bindings/`. Keep SDK imports out of React and the domain. `contracts.ts` validates normalized transport rows and retains u64 IDs/revisions as `bigint`. The local prototype still uses numeric IDs: integrating live data requires a deliberate live read model and renderer ID migration, never `Number(id)`.

Subscribe to visible chunks plus a border, matching appearances/terrain, required attribution profiles and a lightweight world summary. Hydrate only after subscription `onApplied`. Keep prior state visible while the new viewport applies, then retire old subscriptions. Cache eviction is not global deletion. Dispose callbacks and avoid duplicate listeners on reconnect.

Use generated `DbConnection.builder()` with URI/database, authenticated token provider and automatic reconnect. Do not enable live mode merely by setting an environment variable, or silently switch to writable local mode on connection failure.

## Integration sequence

1. Install and verify a matching SpacetimeDB CLI in the chosen development environment; this refactor does not install it.
2. Implement/test authenticated reducers, private request receipts, bootstrap state and scheduled simulation.
3. Publish to a development database and generate bindings:

   ```sh
   spacetime generate --lang typescript --out-dir src/infrastructure/spacetimedb/module-bindings --module-path spacetimedb
   ```

4. Implement the live gateway/read model and token lifecycle. No secrets in Git or public Vite variables.
5. Verify two independently authenticated clients: conflicting placements, outage propagation, permissions, forged identity, resource limits, rate limits, reconnect, multi-tab presence and viewport changes.
6. Validate backup/restore, schema migrations, monitoring, instance limits, retention and load before public launch.

Local city data is never imported into the shared world automatically.

## Local machinery pilot → future authority

The prepared schema now includes `buildingModule` (canonical building ID + module kind), `warehouseStockpile` (metal per warehouse) and `world.shippedMetal`. These additions have only been typechecked; no schema deployment or data migration has run. Add authenticated configure/dispatch reducers with revision checks, matching module-kind validation, duplicate prevention, stockpile capacity checks, and a single server-owned production schedule before connecting clients. The local 10-second timer must be disabled in live mode. Do not accept client stock totals or run one simulation timer per connection.

Import the shared gameplay definitions through a dedicated common package during integration; do not duplicate balancing constants inside reducers. New tables need atomic foreign-reference validation and subscribed chunk joins. Raw feedstock is currently unlimited; fuel, ore and construction consumption need explicit server recipes and bootstrap reserves in a later iteration.
