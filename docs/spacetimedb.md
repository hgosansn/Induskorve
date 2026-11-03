# SpacetimeDB live integration

Implemented, 2026-11-01, against the official SpacetimeDB 2.13.0 SDK and CLI. The module builds and publishes to an isolated real server; real SDK clients and two browser sessions synchronize successfully. Hosted deployment and the external SpacetimeAuth sign-in round trip await the project configuration. Default mode remains local until explicitly configured.

## Connect your project

Copy `.env.example` to `.env.local`. Set these public build variables:

```dotenv
VITE_CITY_MODE=live
VITE_SPACETIMEDB_URI=https://maincloud.spacetimedb.com
VITE_SPACETIMEDB_DATABASE=your-database
VITE_SPACETIMEAUTH_CLIENT_ID=your-public-client-id
# Optional; defaults to the current origin + Vite base URL:
# VITE_SPACETIMEAUTH_REDIRECT_URI=https://your-host/Induskorve/
```

Register the exact callback and post-logout URL in your SpacetimeAuth application, including path and trailing slash. The browser uses the official OIDC authority, authorization code + PKCE, session-scoped storage, and ID tokens for database connections. No frontend client secret is used. Token renewal supplies fresh credentials to SDK reconnects. Spectators may read without signing in; Join city redirects to SpacetimeAuth before registering a citizen under the authenticated database Identity. Display names grant no authority.

Publish the server with `SPACETIMEDB_URI`, `SPACETIMEDB_DATABASE` and `SPACETIMEAUTH_CLIENT_ID` set in the shell, then run `npm run db:publish`. The server client ID must equal the frontend public client ID. SpacetimeDB CLI login handles publishing credentials outside application code. Vite does not load server shell variables automatically. Do not send secret keys in chat or put them in VITE variables. The publish wrapper refuses local-test overrides and never requests data deletion.

The module checks **both** the trusted SpacetimeAuth issuer and the expected audience on every mutating client reducer. An unset server client ID denies mutations. A generic SpacetimeDB anonymous token cannot edit the production-configured city.

The Pages workflow needs these public VITE values in its build environment to publish live mode. Configuration is compiled into the static app; changing it requires a rebuild. It currently defaults to local mode when no mode is supplied. An incomplete explicit live configuration fails visibly rather than silently opening a writable local city.

## SDK and module tools

Install SpacetimeDB CLI 2.13.0, or set `SPACETIME_CLI` to its executable. The Windows wrapper also recognizes the ignored portable installation under `.local-tools/spacetime-2.13.0/`. Set `SPACETIME_STANDALONE` for a standalone server executable elsewhere when running integration tests.

```sh
npm run db:build
npm run db:generate
npm run test:live
```

Generated TypeScript bindings under `src/infrastructure/spacetimedb/module-bindings/` are actual CLI output and ship with the client. Regenerate after changing exported module schema/reducers. They are excluded from authored formatting/linting, but frontend typechecking checks their use.

`test:live` creates fresh loopback-only, in-memory databases and temporary signing keys under ignored `.local-tools/live-tests/`. It checks two-client conflicts, receipt replay/privacy, foreign permissions, exact funding, technology grants, conservation, reconnect/multi-tab presence, production-auth rejection and the real live store. It then opens two browser sessions against the actual SDK-backed UI, checks shared citizens and preserved local saves, and captures a screenshot in that run directory. Local test authentication and accelerated ticks are explicit server overrides, never frontend settings. Test artifacts are not deployment credentials.

## Shared source and persistence

`shared/city` owns browser/server catalogs, stable building/module/resource/project/technology IDs, exchanges, network allocation, action lifetimes and strict live command validation. Browser local save v3 and live protocol v1 are separate. Nothing automatically imports or overwrites a browser city.

The gateway sends validated intent to `executeCommand`, stores uncertain requests in a session-scoped per-database/per-identity journal, and settles UI actions only through owner-filtered terminal receipts. The server derives actors from `ctx.sender`, validates source stock/building/project revisions, plans business changes before writes, and commits effects, attribution, events and receipts together. Replay never performs a second transfer. Unexpected exceptions escape for transaction rollback.

The renderer uses reversible session-only numeric handles for actual bigint IDs; commands reverse those handles without numeric coercion. Quantities are range-checked before display. Live snapshots are read-only projections, never browser saves. Connection failure preserves the last snapshot and blocks mutations. Local production timers are disabled in live mode.

## Tables

| Table                       | Visibility | Meaning                                                                                           |
| --------------------------- | ---------- | ------------------------------------------------------------------------------------------------- |
| world                       | Public     | Schema/content versions, revision, tick, bootstrap/produced/dispatched metal totals               |
| citizen                     | Public     | Identity, display name, avatar, creation time and profile revision                                |
| building                    | Public     | u64 ID, unique cell, chunk, kind/definition version, enabled state, optional creator and revision |
| buildingAppearance          | Public     | Stable seed, height, shape, balcony, display, approved media reference and revision               |
| buildingModule              | Public     | Canonical building/module key and chunk                                                           |
| warehouseStockpile          | Public     | Authoritative metal per warehouse and stock revision                                              |
| terrainTile                 | Public     | Union of local reveal disks; canonical cell/chunk keys                                            |
| cityProject                 | Public     | Frozen definition/requirement, delivered amount, completion time and revision                     |
| projectContribution         | Public     | Project/identity aggregate, amount and last update                                                |
| technologyUnlock            | Public     | Stable grant, definition version, project, event and time                                         |
| worldEvent                  | Public     | Accepted action, actor/name snapshot, structure/project/resource/amount, summary and revision     |
| billboardAsset              | Public     | Approved media metadata; no unreviewed upload bytes                                               |
| network / networkMembership | Public     | Rebuildable topology projections, not independent resource balances                               |
| presence                    | Public     | Temporary location/online status; expired through session/lifecycle logic                         |
| playerState                 | Private    | Own last-seen event marker                                                                        |
| commandCursor               | Private    | Last settled sequence per Identity; never reset during receipt pruning                            |
| commandReceipt              | Private    | Actor/request key, unique actor/sequence, canonical payload and terminal result                   |
| session                     | Private    | Connection ID → Identity, for multi-tab presence                                                  |
| actionAllowance             | Private    | Reserved, inactive balancing state                                                                |
| simulationState             | Private    | Scheduler/topology bookkeeping                                                                    |

The old schema-only network `inventory` placeholder was removed. Metal has one stockpile representation; network totals are projections. Multi-resource recipes require an explicit migration, not a second balance beside warehouse metal.

Reducers must validate foreign references and compound keys; these are not automatic foreign-key constraints. Unique cell keys protect occupancy. `shared/city/keys.ts` handles canonical keys and floor division for negative chunks. Chunk keys prepare future subscription partitioning; this first live client subscribes to the complete bounded city. Absent creators identify system-owned founding infrastructure; no guessed user owns it.

## Reducers and simulation

`schema.ts` owns table definitions; `reducers.ts` owns initialization, connection lifecycle, command execution, presence, private production scheduling and owner-filtered views. `index.ts` exports only the actual module endpoints and default schema. `authority.ts` holds pure planners; `reducer-foundation.ts` adapts receipt planning to SDK tables.

Fresh databases start with public power, warehouse and foundry buildings and catalog-backed city projects. Each placement persists a union of local reveal disks. Road occupancy and duplicate cells are rejected. Construction, raw feedstock and machinery remain free in this pilot. Cooperative module additions and public stock contributions are allowed; module removal, shutdown/restart and facade changes require the creator. There is no demolition reducer.

One private scheduled reducer advances production every 10 seconds, independently of connected browsers. Its caller must be the database Identity; client invocation is rejected. It deduplicates ticks, counts only output fitting warehouse capacity and schedules one next step. There is no unbounded downtime catch-up. Disconnected players remain credited for their buildings and contributions.

The live UI routes profiles, placement, machinery, explicit operating state, single/batch dispatch, project funding, approved media IDs, last-seen markers and transient pedestrian presence through the actual SDK. Arbitrary local image uploads are not exposed in live mode. The asset registry is present, but no upload/moderation service or assets are provisioned automatically.

## Scope and remaining operations

The first live client uses a complete bounded-city subscription (maximum 2,500 structures), global summary/projects/technology and owner-filtered receipt/cursor/player-state views. Topology is derived from subscribed authoritative building/module/stock rows using the shared allocator. Network projection tables are reserved and not populated. Chunk keys exist; spatial subscription/eviction is not implemented or claimed.

External SpacetimeAuth success/callback/logout and cloud publishing still require your actual public application configuration and CLI account. Backup/restore, schema migration drills, moderation, durable action rate limits, retention/pruning and production load acceptance remain work before a public release. No cloud database or hosted site was modified during local verification.

## Official references

[SpacetimeAuth React integration](https://spacetimedb.com/docs/core-concepts/authentication/spacetimeauth/react-integration/), [atomic reducers](https://spacetimedb.com/docs/intro/key-architecture/), [caller context](https://spacetimedb.com/docs/functions/reducers/reducer-context/), [lifecycle](https://spacetimedb.com/docs/functions/reducers/lifecycle/) and the installed 2.13.0 SDK declarations informed this implementation.
