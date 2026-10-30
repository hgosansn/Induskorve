# Induskorve

An isometric industrial city with interdependent infrastructure. The current app is a **browser-local prototype** with a production-oriented frontend foundation. Authentication and shared multiplayer are not implemented yet.

## Develop

Use Node.js 24 LTS (`.nvmrc`) and npm.

```sh
npm ci
npm run dev
```

```sh
npm run check       # lint, frontend/server types, domain tests, formatting
npm run build       # production bundle in dist/
npm run preview
npx playwright install chromium
npm run test:e2e
```

## Structure

```text
src/
  app/                      # Theme and application-level error handling
  application/              # Commands, Zustand store, repository/live ports
  domain/city/              # Validated entities, catalog, networks, terrain
  features/city/            # React compositions for city interactions
  components/ui/            # Official shadcn/ui primitives
  infrastructure/
    persistence/            # Versioned browser saves and migration
    spacetimedb/            # Validated wire contracts and lossless live IDs
  rendering/canvas/         # Scene, projection, pedestrians, procedural artwork
  lib/                      # Shared shadcn utilities
spacetimedb/src/             # Isolated, typechecked server schema
public/                     # Static files
tests/                     # Domain and browser tests
docs/                      # Architecture, deployment and integration guides
.github/workflows/          # Quality checks and Pages deployment
```

React 19 handles the UI; Canvas 2D preserves the approved artwork. Tailwind 4, shadcn/ui and Radix provide styling and accessible controls. Motion uses LazyMotion and respects reduced motion. Zod validates saves/transport; Zustand handles changes outside the frame loop. See [architecture](docs/architecture.md).

## GitHub Pages

The workflow builds/uploads `dist/` on pushes to `main`. Relative asset URLs support `/Induskorve/` and custom domains. Select **GitHub Actions** in **Settings → Pages** once; initial activation needs admin access. See [deployment](docs/deployment.md).

## Saves

Existing `onecity-v2` cities migrate to `induskorve:city:v3` on the next saved action. The old key remains intact. Entities and appearances persist separately. Invalid saves remain untouched and show a temporary-session warning. Changing hosts still changes browser storage origin.

## SpacetimeDB preparation

The isolated server workspace defines structures, appearances, citizens, presence, terrain, networks, inventory, media, events and private server state. It is typechecked against the official SDK. It has **no write reducers and is not published or connected**. See [contracts and integration steps](docs/spacetimedb.md).

## Current boundaries

- Names provide local editing convenience, not authentication. Joined local citizens may operate structures; there is no demolition action.
- Local production advances every 10 seconds while joined and visible. Foundries fill warehouse stockpiles, stop at capacity, and resume after dispatch. Raw feedstock is unlimited; mining, fuel and construction costs are future work.
- Ambient walkers are visual agents, not real users.
- Local billboard uploads accept PNG/JPEG/WebP/GIF up to 1.5 MB. Animated GIF playback is not guaranteed by Canvas.
- Building geometry, terrain and render layout use strict TypeScript. The remaining scene artwork (adverts, connections and pedestrians) is JavaScript behind a typed boundary.
- Public multiplayer, server operations, abuse controls and production load acceptance remain future work.

## Building workshop

After joining, use **Add building** to choose purpose, functional modules, architecture, height, balcony and optional facade display. The workshop renders the configuration before **Choose location** activates its ghost. Click revealed empty ground to place one building; Escape/right-click cancels. **City** contains camera, network and session controls; the bottom of the canvas stays clear. Appearance settings are optional in existing saves and persist separately from simulation entities.

## Daily contribution experiment

Open **City → Daily playtest** without joining to try a separate six-plot scenario. Switch between Mira, Ivo and Sol (local test participants), choose **Place**, **Expand** or **Connect**, inspect the forecast and confirm for one energy. Each participant begins with one energy, regenerates one per 24 game hours and banks up to three. Shape selection and plot selection show the actual building ghost; Escape/right-click cancels the draft.

**Run clock** advances one game hour per real second. **+1 hour** and **+1 day** allow controlled tests; the clock pauses when the document is hidden or the playtest closes. There is deliberately no wall-clock/offline catch-up. Automatic production and freight supply a 160-material public terminal, which adds 24 freight capacity per day on completion. Power shortages, full storage, attribution and lost output are visible. Export the run as JSON to compare experiments.

Progress uses `induskorve:daily-playtest:v1`, independently of the city save. Invalid playtest data is preserved until an explicit reset. Balance is experimental: free construction, unlimited feedstock, fixed compatible routes and three switchable participants. This is not multiplayer or the final economy; generator/handling stages use the existing machinery artwork rather than a new physical part catalog. See the experiment contract in [architecture](docs/architecture.md#daily-contribution-playtest).

## Composable industry and visual language

Buildings use constrained assemblies: generator halls with ground-mounted cooling cells, foundries with side extraction, and storage halls with clear loading aprons. Each piece snaps to a reserved mounting bay with a support, occupied volume and purpose. Functional modules live on domain entities; silhouettes, finish and displays remain in appearance records. Existing structures can be retrofitted from the inspector. Turbines add capacity; heat recovery supplies a nearby connected foundry; furnaces raise demand/output; scrubbers reduce the visible operating footprint; loading bays add connections/storage; solar roofs lower warehouse grid demand.

The placement ghost forecasts its power/storage status and links before construction. Copper pipes indicate recovered heat, yellow suspended wires carry electricity, and blue dots indicate logistics. Warehouse stacks reflect stored metal. Ground tint reflects current emissions, not persistent environmental damage or a pollution penalty.

`src/app/palette.css` is the sole authored color source for Tailwind and Canvas, including pedestrians, adverts, semantic accents and terrain. `src/rendering/palette.ts` resolves those CSS tokens at renderer creation. Reload after editing palette values. The interface uses square corners, thin borders and flat surfaces, including dialogs, notifications and native controls.

Open **City → Design atlas** to study each building assembled or with its layers separated. Isolate layers or individual parts, read why each part exists and what supports it, and toggle equipment and operating state. Architecture controls vary the hall setbacks and control core; facade displays sit on a backed right-side panel. Upper floors have deterministic lit/dark windows and exposed frames. The Atlas and workshop use the actual city renderer. Atlas controls are temporary and do not change the city or its saved data. See [visual direction and references](docs/art-direction.md).

The [building assembly contract](docs/building-assemblies.md) defines the process-first workflow, mounting and clearance rules, functional references, verification and current geometric limits.
