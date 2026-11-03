# Persistent actions and authority contract

Decision baseline: 2026-11-01. This specifies the implemented live-mode contract. Default local mode and existing browser saves retain their local rules.

## What survives a visit

| Action or state                                                                                  | Lifetime                | Authority and ownership                                                                                                                                                                                             |
| ------------------------------------------------------------------------------------------------ | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Register or update a citizen profile                                                             | Durable profile         | Identity comes from the authenticated connection; names are labels, not credentials. Profile updates require its revision.                                                                                          |
| Place a building                                                                                 | Durable world           | Any registered citizen; validate empty revealed non-road ground, catalog version, modules and limits. Preserve creator identity and the chosen appearance.                                                          |
| Add compatible machinery                                                                         | Durable world           | Any registered citizen may add modules. Recompute dependencies and forecast consequences.                                                                                                                           |
| Remove installed machinery                                                                       | Durable world           | Creator only. Capacity reductions must not destroy stored material.                                                                                                                                                 |
| Restart a building                                                                               | Durable world           | Any registered citizen may restore operation.                                                                                                                                                                       |
| Shut down a building                                                                             | Durable world           | Creator only. A forecast must identify dependent structures losing service.                                                                                                                                         |
| Change or reset facade media                                                                     | Durable world           | Creator only, using an approved asset ID. Inline data URLs and arbitrary remote URLs are not live commands.                                                                                                         |
| Contribute metal to a project                                                                    | Durable world           | Any registered citizen. Transfer exact amounts from explicitly selected powered warehouses and attribute the contributor.                                                                                           |
| Dispatch metal                                                                                   | Durable world           | Any registered citizen; explicit source stock and revisions. No private ownership of shared stock is introduced.                                                                                                    |
| Coordinated dispatch                                                                             | Durable world           | Same validation, with the unlocked capability and a fixed previewed set of at most 64 warehouses. Never expand the set silently at confirmation.                                                                    |
| Revealed terrain                                                                                 | Durable consequence     | Added atomically by placement as a union of local reveal disks. No global-radius expansion.                                                                                                                         |
| Completed projects and technology unlocks                                                        | Durable consequence     | Server-owned and committed with the final contribution. Store the requirement and definition version so a patch cannot relock completed work.                                                                       |
| Production, stock and shipped totals                                                             | Durable simulation      | One server-owned scheduler. Clients never submit production totals, unlock flags or arbitrary inventory edits.                                                                                                      |
| Last acknowledged city event                                                                     | Durable private profile | Monotonic, bounded by the latest real event; supports a future return-visit summary.                                                                                                                                |
| Presence, current pedestrian location and connection sessions                                    | Temporary               | Own identity only, rate limited and expired/disconnected. Cosmetic location confers no economic effects. Multiple tabs must not create multiple citizens or turn an identity offline while another session remains. |
| Camera, selection, inspection, workshop drafts, forecasts, cancellation, overlays and guide tabs | Local interface         | No city mutation, resource spend, event or command receipt. Device-local preferences may be saved independently later.                                                                                              |
| Automatic service links, status and network inventory summaries                                  | Derived                 | Rebuild from authoritative buildings/modules/stock. They are not a second resource balance.                                                                                                                         |

There is no demolition command. There is no manual connect command in the current automatic-link model. A future constructed connection needs its own durable entity and endpoint validation; a visual cable is not such an entity. Ambient walkers are not players.

Entering or leaving edit mode does not create or delete a persistent citizen. Disconnecting does not undo buildings or contributions. Local city data is never automatically uploaded into the shared world.

## Stored state versus events

Building configuration, warehouse stock, project deliveries and contribution aggregates are primary state. Public history describes accepted world actions and their consequences; it does not replay animations or periodic UI updates. Profile edits and presence do not fill the city event stream. Production advances quantities/ticks without one public event per building per tick.

Creator identity is stable. An event may retain the actor name at the time of contribution; a later profile rename does not rewrite history or transfer ownership. Contribution aggregates are keyed by project and identity, not display name.

The local 120-event history limit is a UI/pilot limit, not an instruction to delete the authoritative audit record. The server event retention/archive policy must be established before launch. Private terminal receipts may be pruned under a tested retention policy, but identity command cursors must never be reset or pruned as part of that cleanup.

## Exact, retryable commands

`shared/city/live-protocol.ts` defines the live command envelope. Every persistent client mutation carries protocol/content versions, a canonical UUID request ID and a monotonically increasing per-identity sequence. It contains no caller identity, output totals or unlock flags. Live IDs, revisions and quantities are `bigint`/u64 throughout.

All tabs of one identity share the server cursor. A gateway should serialize outstanding mutations. Two tabs choosing the same sequence cannot both commit. A losing tab must refresh and obtain a new forecast before intentionally submitting a new request. It must not disguise an uncertain retry as a new UUID or sequence.

The receipt key is authenticated identity + request ID. Canonical payload equality includes every intent field and retains exact bigint values. Module sets and warehouse source lists are normalized in the fingerprint. This fingerprint is an equality representation, not an authentication signature.

For an existing receipt, the same payload replays the original accepted or rejected result; a changed payload is a request conflict. Without a receipt, a sequence at or below the durable cursor is never executed again. If its result has been pruned, report `receipt-expired` and reconcile the world instead of retrying the transfer. A future sequence is blocked until earlier work is settled.

A world mutation must:

1. Validate the command shape and derive the actor exclusively from `ctx.sender`.
2. Read its private receipt/cursor, reject conflicts or replay a terminal result.
3. Check registration, permissions, catalog versions and expected revisions.
4. Plan every affected row, contribution, resource transfer, event and unlock without writes.
5. Apply the planned writes and terminal receipt/cursor together in one reducer transaction.

Building changes require the building revision. Stock transfers require both source-building and stock revisions. Funding also requires the project revision. Production therefore makes an old stock forecast stale. Rejection spends nothing and does not resize a requested amount automatically.

Use explicit `set-operating { enabled }`, not a toggle that could invert twice on retry. Coordinated dispatch freezes source IDs and amounts in the command. Server validation must still recompute whether each source has the required services.

## Rejections and failures

Malformed commands, missing registration, receipt conflicts and sequence gaps are blocked before admission and do not consume a sequence. A well-formed admitted command that fails a business rule can be settled as a durable rejection, advancing its cursor once. Return that result normally after writing the rejection receipt; throwing would roll those writes back.

Unexpected exceptions or database write failures must escape the reducer so its entire transaction rolls back. Do not catch a write failure and commit a partial action or a misleading successful receipt. The TypeScript SDK does not provide nested reducer transactions.

A transport error is an **unknown outcome**, not proof of rejection. Keep the UUID, sequence and payload, query the owner-filtered receipt view, and retry only the identical request. Sending, a local forecast, or an optimistic ghost is not confirmation. The gateway resolves a mutation only on a terminal server result.

## World time and balance

Live production is independent of browser visibility and player connections. The server owns a single schedule and idempotent tick bookkeeping. Database downtime pauses production in the first live version; no unbounded wall-clock catch-up is inferred. The local timer remains active only in local mode; live mode uses the server schedule.

Metal conservation is `bootstrap metal + produced metal = stored metal + project contributions + dispatched metal`. Count actual produced quantities that fit storage, not nominal blocked output. All additions, revisions and transfers must check u64 overflow. Never clamp a transfer and silently discard the difference.

Action allowances are reserved server-owned state, not an enabled rule for the founding city. The isolated daily playtest does not set live balancing. Construction/feedstock rules remain the current free/unlimited pilot rules until explicitly changed.

## Implemented and remaining work

Shared catalogs/IDs, strict bigint command validation, pure authority planners, real transactional reducers, owner-filtered views, server scheduling, generated SDK bindings, authenticated client wiring, lossless renderer adaptation and reconnect receipt reconciliation are implemented. Two real SDK clients and browser sessions were verified against isolated SpacetimeDB 2.13.0 databases. Browser saves remain separate.

Hosted project configuration and actual external SpacetimeAuth round-trip verification are pending. Media moderation/upload, rate limits, retention and spatial subscription scaling are not implemented. See [live setup and verification](spacetimedb.md).

Official references checked: [atomic reducers](https://spacetimedb.com/docs/intro/key-architecture/), [caller context](https://spacetimedb.com/docs/functions/reducers/reducer-context/), [constraints](https://spacetimedb.com/docs/tables/constraints/), [lifecycle](https://spacetimedb.com/docs/functions/reducers/lifecycle/) and [error handling](https://spacetimedb.com/docs/functions/reducers/error-handling/). SDK type declarations remain the source of truth for this installed version.
