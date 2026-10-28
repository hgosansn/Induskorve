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
| Building                   | ID, kind, grid position, operating switch, creator attribution           | Height, palette, images, draw functions      |
| BuildingAppearance         | Building reference, geometry height, deterministic seed, local billboard | Services and production rules                |
| Citizen                    | Local identity and name                                                  | Authentication, Canvas motion, online status |
| ServiceState / NetworkLink | Derived allocation, demand, capacity, activity                           | Pixels, colors, animation                    |
| RenderBuilding / Walker    | Projected geometry and visual pedestrian motion                          | Persistent authority                         |

The founding seed and artwork are preserved. A view projection joins entity/appearance records and maps service IDs to render references. Scene and projection are TypeScript. The existing mathematical artwork remains JavaScript behind a typed declaration; converting that isolated module to checked TypeScript remains a hardening task.

## Rendering lifecycle

Zustand commits immutable world snapshots after commands. Canvas subscribes directly; React does not receive camera or walker frames. Service allocation runs on world changes, not on every frame. Inspection memoizes allocation for stable building arrays.

The scene owns camera, hover, render caches and ambient motion. Pointer capture supports dragging outside the canvas; right-click/Escape cancel placement. AbortController removes listeners; ResizeObserver, animation requests and caches are released on unmount, including StrictMode remounts. Hidden tabs stop rendering. Reduced-motion preferences freeze visual world animation and interface transitions.

## Save integrity

The repository validates complete snapshots, unique building/cell/citizen IDs and one appearance per building. It migrates legacy appearance fields without deleting legacy data. Corrupt current data is not silently replaced by an older city. Storage failures leave the visit usable and show a warning.

Local save versions are separate from future network protocol revisions. Never use names as authority, automatically upload a local city, truncate live u64 IDs, or save a partial viewport as a complete city.

## Lean UI policy

Generic UI comes from the official shadcn registry under `components/ui`; application compositions are city-specific. Do not create a parallel design system, focus trap or animation framework. Add dependencies for actual use cases. No router is needed for this single-page canvas.

CI checks formatting, lint, frontend/server types, domain/persistence/transport invariants, browser interactions and production builds. Live multiplayer, scale, authenticated permissions and GIF playback require separate acceptance checks.
