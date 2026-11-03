# Street and pedestrian variation — first pass

Completed locally on 2026-10-30. The production city now uses three topology-aware lamp families, six stable pedestrian silhouettes and a sparse street furnishing vocabulary. No new building types, population count, economy, save format or external dependencies were added. No deployment or commit was performed.

![Fixture families](../asset-studies/streets-01/fixtures.png)

![Standing and walking profiles](../asset-studies/streets-01/people.png)

## Actual changes

- **Cantilever road lights:** supported lateral arm over a straight road edge, with direction following the street axis.
- **Twin-head junction lights:** two arms illuminate the junction approaches/pavement.
- **Capped pedestrian posts:** shorter, enclosed fixtures at ends/turns and selected coherent street stretches.
- **Sparse props:** compact utility cabinet, raised route post and protective bollard. Flush service covers and neutral asphalt repair patches add ground interest without becoming walking obstacles.
- **People:** hardhat jacket, long coat, hood, backpack, broad coveralls and toolcase. Stable identity hashes determine muted coat/skin tokens, height, build, cadence and stride. Moving direction is retained when a person stops. Ambient people receive no citizen name; named local citizens retain labels and the current citizen's selection ring.

Existing 24 ambient walkers remain 24. `syncWalkers` and `advanceWalkers` routing behavior was preserved. Ambient population is local scenery, not an online-user count. Reduced motion freezes the scene; waiting/idle people have no changing gait.

All new artwork is native Canvas construction and generated sprites, not newly authored Blender/GLB masters. Existing palette tokens provide every authored color. Pedestrian artwork is now typed alongside its existing routing module; adverts, connections and orchestration remain JS.

## Placement and lighting contract

Lamp feet moved from the old universal `.08/.08` offset into mirrored `.195/.805` inner-curb pockets. Raised furniture occupies at most one checked pocket on an eligible road tile. Fixtures remain entirely on revealed, unoccupied road pavement; graph nodes, crossings, plot paths and entrance approaches are unchanged.

The furnishing planner is cached by `StreetLayout`. Coordinate hashing is independent of insertion order, frame, production state and the whole-city signature. About one fifth of road tiles are eligible before clearance rejection. Path segments are bucketed once for candidate checking. Feet must remain clear of the graph by `.04` tile and of lamp feet by an additional `.02` gap. Tests cover negative coordinates, straight roads, corners, junctions, ends and a road capped by a preserved legacy building.

These are graphical footprint reservations, not full pedestrian-body collision or engineering certification. Sign plates extend overhead, above the pedestrian silhouettes. Normal benches require a widened, validated pavement bay and were deliberately left out.

Every luminous head and its ground pool derive from the same fixture profile. The old universal pool offset was removed. A single shared radial-pool bitmap is stretched into ground ellipses; gradients are not regenerated per lamp during panning. Furniture/fixtures are depth-sorted with buildings and pedestrians and culled before sprite creation. Streetlights remain ambient public fixtures, not simulated electrical consumers; lighting does not perform shadow occlusion.

## Review

Before/after district and close captures, isolated fixture/profile rows and the synthetic street patch live under `asset-studies/streets-01/`. The synthetic patch has **57 road tiles, 33 lamps, seven raised props and 24 ambient people**, with all three fixture/prop and six pedestrian families represented.

Independent internal critique, not reference fidelity or user approval:

| Criterion        | Before | After |
| ---------------- | -----: | ----: |
| Variation        |      2 |     7 |
| Visual coherence |      6 |     8 |
| Readability      |      6 |     7 |

The accepted pass reduces cloned fixtures and people while keeping the city quiet and industrial. The underlying road grid and lighting rhythm remain regular. Individual pedestrian families become subtle at district scale; the hood is slightly cartoonish in close inspection. Precise pool alignment, clearance and stability rely on implementation/tests in addition to visual review.

## Time and browser costs

Work began **18:22:03 UTC**; final bundle/capture verification finished **18:47:47 UTC**: **25m44s** wall time, including parallel pedestrian work, clearance planning, rendering, review, repairs, benchmark and checks. Documentation after that checkpoint is excluded. This is one integrated pass, not a future assets-per-hour guarantee.

| Cost                                               |                           Measured result |
| -------------------------------------------------- | ----------------------------------------: |
| New downloaded bitmap/model assets                 |                               **0 bytes** |
| Main JS chunk raw / build gzip estimate            |                     **232.44 / 81.40 KB** |
| Change from completed building kit                 | **+8.55 KB raw / +3.16 KB gzip estimate** |
| Synthetic 11×11 terrain topology generation        |                                    1.0 ms |
| Cached scenery-plan creation                       |                                    0.5 ms |
| Static road/path/light base creation               |                                    1.2 ms |
| First fixture/crowd draw                           |                                    4.0 ms |
| Warm fixture/crowd median / p95, 100 sampled draws |                            0.24 / 0.36 ms |

The fixture/crowd sample includes a cached base image, 33 lamps, seven props and 24 people. It excludes buildings, network drawing and GPU completion. These local CPU submission timings are not game FPS or a general speed guarantee. No hosting compression setting was changed; gzip figures are build estimates.

The measured scene used four lamp sprites (**331,776 RGBA bytes**) and three prop sprites (**110,592 bytes**). Generated review caches totaled **1,452,672 bytes**, excluding the base surface and including separate gallery/scene renderers; this is not the whole product's memory use. Per artwork renderer, canonical lamp artwork has at most nine shapes, props four shapes, and pedestrian bodies at most 128 cached identity/facing entries (56×60 RGBA pixels each). The combined theoretical sprite/pool bound is about **2.53 MiB**, before browser overhead and terrain/building caches. Identical capped lights and unoriented props share their bitmap rather than duplicating it by corner.

## Verification and repairs

`npm run check` passed with **101 unit tests**, types, lint and formatting; production build passed. Fourteen browser checks passed on the first full run. The idle-canvas check initially observed a legitimate late building-sprite decode after its fixed 200ms settle period; it now waits for initial network assets before testing idle, while the separate delayed-sprite test still verifies required repainting. The repaired lifecycle check passed **three consecutive runs**, covering all 15 distinct browser checks across the run and rerun.

New tests verify order-independent scenery, bounded sparse density, every raised footprint clear of all walking edges, no overlap with lamp feet, head definitions, six pedestrian families, identity stability, stopped gait, named/ambient distinction, no walker mutation and reuse of cached torsos across gait frames. Existing routing, save/ghost, production and covered/reduced-motion checks remain.

Review caught two construction issues: diagonal cantilever arms were foreshortened by the city camera, so they now follow one actual street axis; orientation is included in sprite identity so horizontal and vertical roads cannot share the wrong head bitmap. Collapsed scene/terrain canvases now skip drawing rather than passing zero-size source canvases to `drawImage` during layout transitions.

Reproduce captures and costs with `node tools/asset-pilot/capture_streets.mjs`. This writes review artifacts only and uses ephemeral browser state. The actual city uses the same fixture and pedestrian renderers.
