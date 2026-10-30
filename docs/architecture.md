# Architecture

## Dependency direction

```text
React features → application → domain
Canvas scene → render projection → domain
Browser persistence → application repository port
Future SpacetimeDB adapter → live application port
```

The domain imports only Zod. It has no React, Canvas, storage, networking or styling dependencies. Commands enforce local spectator gating, occupancy and revealed-ground rules. Storage effects belong to the repository. UI compositions invoke commands and report errors through Sonner.

## Object model

| Record                     | Owns                                                                     | Excludes                                     |
| -------------------------- | ------------------------------------------------------------------------ | -------------------------------------------- |
| Building                   | ID, kind, grid position, operating switch, modules, creator attribution  | Height, palette, images, draw functions      |
| BuildingAppearance         | Building reference, geometry height, deterministic seed, local billboard | Services and production rules                |
| Citizen                    | Local identity and name                                                  | Authentication, Canvas motion, online status |
| ServiceState / NetworkLink | Derived allocation, demand, capacity, activity                           | Pixels, colors, animation                    |
| RenderBuilding / Walker    | Projected geometry and visual pedestrian motion                          | Persistent authority                         |

The founding seed and saved positions are preserved; role-specific machinery replaces random building decoration. A view projection joins entity/appearance records and maps service IDs to render references. Scene, projection, building geometry and terrain are TypeScript. Adverts, connections and pedestrians remain in `artwork.js` behind a typed declaration; full artwork type coverage remains a hardening task.

## Rendering lifecycle

The city uses the [modular WFC kit](wfc-experiment.md). `rendering/generation` separates the height solver, industrial constraints, semantic bay compilation and shared artwork. City, workshop and ghost derive the same recipe from existing appearance data. The Atlas retains the original unconstrained lab alongside actual city assemblies.

Zustand commits immutable world snapshots after commands. Canvas subscribes directly; React does not receive camera or walker frames. Service allocation runs on world changes, not on every frame. Inspection memoizes allocation for stable building arrays.

The scene owns camera, hover, render caches and ambient motion. Pointer capture supports dragging outside the canvas; right-click/Escape cancel placement. AbortController removes listeners; ResizeObserver, animation requests and caches are released on unmount, including StrictMode remounts. Hidden tabs stop rendering. Reduced-motion preferences freeze visual world animation and interface transitions.

`rendering/assembly` defines independent mounting bays, parts, solid envelopes, access clearances and compatible service ports. Its pure composition and validation are separate from drawing. `geometry.ts` supplies isometric primitives, `building-layout.ts` reads the assembly ports, `buildings.ts` draws the composed parts and `modular-hall.ts` draws the generated hall, and `terrain-art.ts` draws the revealed ground. See [building assembly contract](building-assemblies.md). `artwork.js` orchestrates these with the remaining scene elements. The optional `BuildingStudy` render configuration separates or isolates assembly layers without entering the domain or save model. `BuildingPreview` is shared by the workshop and Design atlas; both render the same geometry as placed buildings. Atlas state is local React state with no command or persistence access.

## Daily contribution playtest

The isolated daily loop lives in `domain/city/playtest.ts`. It owns experimental rates, validated state, energy, placement/expansion/connection commands and deterministic hourly integration. `application/playtest-store.ts` applies commands and saves only `induskorve:daily-playtest:v1`. The feature is opened through City controls; no founding-city entities, reducers or save migrations are changed. Invalid experiment saves remain read-only until explicit reset. Failed commands spend no energy. Exported JSON contains rules, state, cumulative loss counters and the latest 120 attributed events.

Three local participants each start with one energy, regenerate 1/24 per game hour and cap at three. They share six predefined non-road plots, a generator (30 power), depot (6 demand, 20 storage) and a terminal construction site. Place creates a foundry with included local services (12 power, 12 output/day). A furnace adds 6 power demand and 6 output/day, once per foundry. Generator expansion adds 18 power, up to four stages; freight handling adds 24/day, up to two stages. Connect joins the generator's heat-recovery header to one foundry (+4 output/day), or the depot to the terminal approach (+24 freight/day, once). These routes have fixed compatible endpoints; arbitrary infrastructure routing, collision checking and construction material costs are outside this experiment.

Consumers receive power in stable placement order. An expansion may starve later consumers; forecasts show resulting powered output and unmet demand. Production and dispatch integrate together each game hour, allowing through-flow into a full buffer. Unpowered potential and output curtailed by a full buffer have separate cumulative counters. Produced material always equals delivered material plus stored material. At 160 cumulative deliveries the terminal completes once and adds 24/day freight from the following integration step; later deliveries remain surplus. No further public project is selected automatically.

The UI clock is explicit: one game hour per real second while running and visible, plus manual 1-hour/24-hour steps. Closing unmounts the scheduler; reload opens paused. There is no offline catch-up and no real shared authority. Forecasts use the same command as confirmation and are re-evaluated as time passes. Architecture choices are cosmetic within this experiment, while furnace modules and capacity stages change the shared artwork. `playtest-projection.ts` replaces the founding-city service allocation with experimental services and links, reusing unchanged render objects. `PlaytestCanvas` uses the existing artwork, palette, caches and visibility/reduced-motion frame loop.

Verification covers independent energy, bank limits, failed actions, shortages and recovery, material conservation, timestep equivalence, one-time project completion, save isolation/recovery and renderer reuse. Browser tests play through all three actions to completion, verify persistence and paused clocks, and preserve the founding save. This bounded cooperative scenario does not establish long-term balance, uncoordinated-player behavior or multiplayer correctness.

## Save integrity

The repository validates complete snapshots, unique building/cell/citizen IDs and one appearance per building. It migrates legacy appearance fields without deleting legacy data. Corrupt current data is not silently replaced by an older city. Storage failures leave the visit usable and show a warning.

Local save versions are separate from future network protocol revisions. Never use names as authority, automatically upload a local city, truncate live u64 IDs, or save a partial viewport as a complete city.

## Lean UI policy

Generic UI comes from the official shadcn registry under `components/ui`; application compositions are city-specific. Do not create a parallel design system, focus trap or animation framework. Add dependencies for actual use cases. No router is needed for this single-page canvas.

CI checks formatting, lint, frontend/server types, domain/persistence/transport invariants, browser interactions and production builds. Live multiplayer, scale, authenticated permissions and GIF playback require separate acceptance checks.

## Machinery, production and palette

`catalog.ts` owns module effects and building statistics. `networks.ts` allocates powered logistics before foundries, preserves deterministic ID ordering, and derives nearby heat recovery. `production.ts` advances one bounded integer stockpile step. The application timer runs only in a visible, joined local session, with no offline catch-up. Dispatch and module reconfiguration are validated commands; removing capacity cannot discard stored material. These rules are a local industrial pilot, not an authoritative shared economy.

The renderer joins stockpiles and module IDs to machinery. Ground exposure is derived from operational emissions within two tiles; scrubbers/outages alter it. No environmental simulation state is hidden in pixels. Placement projections use the same network rules as committed buildings and are recomputed when tile, draft or world changes, not every frame.

All authored colors live in `app/palette.css`. Tailwind aliases them and Canvas reads the same computed properties through `rendering/palette.ts`. Do not add renderer hex values or arbitrary Tailwind colors. Border radii are zero across controls, portals and native inputs. Shadows are reserved for meaningful scene depth, not floating UI panels.
