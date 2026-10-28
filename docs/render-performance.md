# Rendering performance

The modular city regression came from repeatedly issuing Canvas geometry commands for static equipment and terrain. Hall facades were cached, but cooling cells, racks, platforms, floor shadows and road details were still painted from primitives every frame. The city also kept painting behind modal dialogs, and reduced-motion mode froze time without stopping the repaint loop.

## Changes

- Terrain, ground shadows and ground lighting are cached in a viewport-sized transparent layer. Camera, size, grid, scene or activity changes invalidate it.
- Static equipment parts are cached by building, activity, detail level and raster resolution. Smoke and gantry motion are separate passes, preserving assembly depth and part inspection. Animated facade displays retain their existing layering.
- Unchanged building projection objects survive stock/production updates, keeping their weakly keyed geometry/raster caches alive. Inventory and appearance changes replace only affected projections. Service state is recalculated independently, so outages still change dependent activity and lighting.
- City and workshop use one canvas scheduler. Ambient motion paints at 30 Hz; pan/zoom invalidations can use display-rate frames. Hidden documents and canvases beneath modal accessibility/inert boundaries stop scheduling. Reduced-motion canvases repaint only after invalidation. Mutation/resize/preference observers and pending animation callbacks are removed on disposal.
- Preview sizing uses layout dimensions, avoiding the temporary scale of dialog opening animations when rendering on demand.

## Local observations, 2026-10-28

A temporary headless Edge page loaded the existing localhost Vite app at 1440 × 1000, with the founding city (96 structures) and normal motion. After a short warm-up, a three-second requestAnimationFrame sample and DevTools CPU sample were collected. Each temporary browser was closed afterward.

| Configuration                              | Browser RAF rate | Median gap | 95th percentile gap |
| ------------------------------------------ | ---------------: | ---------: | ------------------: |
| Before fixes, uncapped city drawing        |          20.3 Hz |    50.0 ms |             66.7 ms |
| Terrain cache only                         |          21.7 Hz |    50.0 ms |             50.2 ms |
| Terrain + static machinery cache, uncapped |          51.3 Hz |    16.7 ms |             33.4 ms |
| Final scheduler and caches                 |          60.0 Hz |    16.7 ms |             16.9 ms |

The final browser RAF rate is **not** a claim of 60 city repaints per second: independent counting of the main canvas's three full-frame fills measured about **30.3 ambient paints/second**. The scheduler deliberately leaves headroom for input and other applications. These are short local observations, not GPU utilization measurements, cross-device guarantees or a 2,500-building benchmark.

Browser regression coverage verifies zero idle paints in reduced-motion mode, zero background city paints under dialogs, active preview animation, and correct redraw after dismissal. Existing checks cover placement/reload, seed replay, module changes, outages, mobile cancellation, adverts and close zoom. Projection tests verify cache reuse without stale inventory or network state.
