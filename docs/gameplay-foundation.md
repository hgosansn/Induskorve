# Guided contribution and content foundation

Implemented locally and wired to explicit SpacetimeDB live mode, 2026-11-01. This is the first playable product loop, not a live multiplayer launch or a finished technology economy.

## Experience

The entry remains a quiet, inspectable city. **City projects** opens public progress without enabling editing. **Join city** introduces a local citizen and opens **Contribute → Needs**. Needs uses actual service states, stored metal and the next deterministic production step. It links a shortage to the corresponding structure and centers the camera on it. The workshop remains available independently.

The loop is: inspect a need → choose a building or machinery change → forecast → commit → observe output → fund a project → unlock a capability → review attributed history. The guide has Needs, Projects and History views. Closing it returns the canvas to an unobstructed view. The bottom of the canvas stays empty.

Placement keeps the existing workshop, ghost and click-to-place interaction, with a numeric placement forecast. Escape/right-click cancel. Machinery, operating changes, dispatch and project contributions have a confirmation dialog. It names the affected structure or source warehouses, reports actual next-cycle metal and lists structures losing or regaining service. Production forecasts include available warehouse headroom; installed output capacity is not promised delivery.

Projects accept exact positive integer contributions from powered warehouses. Freight coordination costs 160 metal and unlocks Shared procurement: one contribution can coordinate several source warehouses. Materials exchange costs 320 metal, requires Shared procurement and unlocks Coordinated logistics: one action dispatches available stock from all powered warehouses. Each warehouse remains a distinct inventory. Coordination does not create an implied physical route or merge stocks.

These projects unlock working controls. They do not place new landmark geometry, implement rail transport or increase industrial capacity. Ordinary single-warehouse dispatch remains available before either unlock.

Construction and machinery remain free; feedstock remains unlimited. The experimental daily action allowance stays isolated in `/playtest.html`. No action allowance, currency shop, population economy, offline production or maintenance penalty was silently added to the founding city.

## Owning definitions

Persistence preparation moved runtime catalogs to `shared/city` for browser/server reuse. Domain catalog/exchange files re-export them; the domain technology file retains the browser save validator. See [persistent actions](persistent-actions.md) and [SpacetimeDB foundation](spacetimedb.md). The numeric local model remains separate from the bigint live model.

| Source                                  | Contract                                                                                                                                                                         |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/domain/city/catalog.ts`            | Versioned building definitions: role, footprint, construction metadata, demand, output, storage, emissions and compatible ports. Module targets and stat effects also live here. |
| `src/domain/city/exchanges.ts`          | Conserved resource identifiers, utility/transport exchange categories and directional port compatibility.                                                                        |
| `src/domain/city/technology.ts`         | Versioned projects and technologies, prerequisites, costs, capabilities and the progression save schema.                                                                         |
| `src/domain/city/progression.ts`        | Material transfers, unlock derivation, coordinated actions and bounded attributed history.                                                                                       |
| `src/domain/city/commands.ts`           | Pure dispatcher shared by forecasts and confirmed local actions.                                                                                                                 |
| `src/domain/city/guidance.ts`           | Read-only needs and impact projections.                                                                                                                                          |
| `src/domain/city/content-validation.ts` | Verification for catalog references, exchange ports and technology cycles.                                                                                                       |

UI labels, workshop purpose choices, module compatibility, network port matching and numerical effects consume these definitions. Network allocation discovers generators, producers and stores by declared roles. It retains deterministic ID allocation and gives logistics power priority before production consumers. Renderer assembly rules remain separate from gameplay definitions.

Electricity and recovered heat are utilities. The materials exchange is transport eligibility with connection capacity. Metal is the only simulated resource. The current model still has a metal-specific stockpile and single-output production. Adding fuel, water, recipes with several inputs or transport throughput requires simulation and schema work; declaring a resource alone does not implement it.

Footprint and construction metadata describe the current single-tile, free-construction contract. They do not enable larger plots or paid construction without coordinated placement, forecast, save and renderer changes.

## Adding content

For another building using an existing process, add a stable ID to `buildingKindSchema`, supply its full `BUILDINGS` definition, declare compatible module targets, and add an assembly recipe using the existing mounting/support contract. The workshop derives its purpose list and description. Role-based service rules and stats can serve it. Add behavior tests and same-camera visual checks. Do not introduce an unvalidated fallback mesh or a UI-only building with no simulation behavior.

For a module, add its stable ID to `moduleSchema`, define its target and numerical effects in `MODULES`, and implement supported machinery artwork and clearance checks. Additive capacities/demand/output, heat bonuses and emissions multipliers are reusable. A genuinely new effect still needs an explicit domain handler.

For a technology, add its ID/schema entry and definition, declare prerequisites and capabilities, and create a project that grants it. The guide, progress display, attribution and unlock status come from the registry. A new capability needs an implementation and enforcement in its command. Never show an unlocked button whose effect has no handler. Run the unit suite, including `validateContentDefinitions`, when extending catalogs.

Stable identifiers are save contracts. Do not rename or delete them or change completed project costs without a migration. Catalog versions identify content revisions; they do not run migrations automatically. Unknown progression versions and invalid records fail validation and preserve the original save.

## Persistence and correctness

Version 3 city saves accept optional `progression` version 1. Older saves load without changing their buildings, stock or attribution. A normal accepted action creates progression/history when needed. Invalid current saves remain untouched in temporary visits.

Unlocks derive from completed deliveries rather than mutable flags. Contributors' amounts must sum to deliveries. Project prerequisites must hold, contributor IDs must exist, and history IDs remain ordered. The latest 120 events are retained; aggregate project contributions survive event trimming. History does not invent events for earlier saves or absent players.

The contribution command validates identity, prerequisites, capability, distinct source IDs, powered availability, exact amounts and remaining project need before returning a changed snapshot. Stale contributions are rejected, never silently redirected or resized. Successful transfers conserve stored + contributed + dispatched metal. Dispatch rejects integer overflow rather than discarding stock.

`applyCityCommand` is pure and powers previews and confirmation. Persistence and scheduling remain application concerns. This prepares for authority; it is not server authority.

## Multiplayer boundary

Local mode retains browser-local names and permissions. Live mode uses SpacetimeAuth, authoritative reducers, owner-filtered receipts, bigint identities, server scheduling and a complete bounded-city subscription. Two clients and browser sessions are verified against a real isolated server; hosted configuration is pending. See `spacetimedb.md`. Shared definitions power both modes, and connection failure never enables a local fallback.

The defining multiplayer acceptance remains: one authenticated person improves infrastructure; another uses it; both see the dependency and attribution. Local tests cannot establish that behavior.

## UI decisions and verification

The requested UI/UX Pro Max skill was inspected at `https://github.com/nextlevelbuilder/ui-ux-pro-max-skill`. Its broad design-system search returned a marketing layout and palette that did not fit this project. Focused style, shadcn and focus searches supplied applicable guidance. Existing palette, square surfaces, Canvas and shadcn components remain authoritative. No external fonts, new icon system or second theme was installed.

Verify `npm run check`, `npm run build` and `npm run test:e2e`. Tests cover preview/commit equivalence, partial and pooled funding, conservation, prerequisites, unavailable sources, stale requests, bounded history, old/corrupt saves, desktop progression, mobile guidance and existing city/playtest journeys. Inspect desktop and narrow-screen rendering in addition to passing tests.
