# Foundry kit integration — measured iteration

Completed locally on 2026-10-30. All city foundries, workshop ghosts and Atlas previews use the same production renderer. No deployment or commit was performed.

## Result

The reusable kit now supplies native-scale sealed exhaust routes, a supported tall duct saddle, a low electrical cabinet with ceramic terminations, and a recessed furnace casing containing the kit's actual inclined louver geometry. The stock cabinet/louver/duct recipes were extended to fit the existing mounting and port contract; images are not stretched to fit arbitrary envelopes.

Foundry electrical mounts are now 1.55 units high instead of 2.7. The shared power port follows the real centre cable clamp at that height, so physical yellow wires remain attached. Other building roles retain their existing electrical geometry. The furnace casing is 2.3 × 2.35 × 3.5, fitting the smallest existing bay. Its heat is a separate active-only overlay inside a dark throat. Removing the furnace module removes the furnace, branch and stand together. Scrubber and capacity rules, saved records and deterministic hall layouts are unchanged.

The three exhaust paths are invariant in local shape across foundry profiles and seeds; only their X origin moves with the hall. They therefore use three reusable exported route meshes with real end flanges and one exact mounting transform per building. Ports remain on their declared mating faces. The kit grows through compatible construction recipes rather than an image for each whole building seed.

Seven derivative exports exist; six are used by a fully equipped foundry. The separate side-louver export is retained for future hosts; the furnace already contains its louver geometry, so it does not download that extra image.

## Reference comparison

Reference: `asset-studies/foundry/reference-v1.png`. Baseline: `captures/11-before-sprite-kit/`. Iteration 12 introduced native sprites; 13 added the furnace and lowered termination; final `captures/14-fixed-camera/` retains the original baseline framing. The study's framingTop is explicit, preventing shorter equipment from making the building appear larger and inflating perceived detail gains.

Independent visual critique, corroborated by the implementing agent; scores are subjective relative to the same reference, not objective quality or user approval:

| Criterion                   | Baseline 11 | First integration 12 | Final 14 |
| --------------------------- | ----------: | -------------------: | -------: |
| Silhouette                  |           7 |                    6 |        7 |
| Material depth              |           4 |                  4.5 |        5 |
| Process connections         |           3 |                    4 |        4 |
| Tiny city-scale readability |           5 |                    5 |        5 |

The first tall cabinet was a silhouette regression and was replaced. The final low cabinet, ceramic fittings, furnace rails, side louver and contained hot opening improve close inspection. The collector and much of the furnace-to-extraction path remain concealed. Sprite shading is softer than the hall's outlined surfaces. At the tiny review scale, the new fittings mostly disappear. This is a modest retained improvement, with substantial distance remaining to the reference. More scattered bolts would not address that gap; the next useful experiment is a visibly traceable collector junction with a revised, validated floorplan.

## Time

Work began **14:23:11 UTC**. Final browser cost verification finished **14:51:01 UTC**: **27m50s**, including assembly discovery, three full authoring passes, one targeted repair, independent critiques, loading/cache integration, source verification, tests, fixed-camera captures and bundle cleanup. Documentation after this checkpoint is excluded.

| Automated authoring pass                       | Blender build/render |            Export/encode |
| ---------------------------------------------- | -------------------: | -----------------------: |
| Initial six derivatives                        |              10.71 s |                   4.71 s |
| Added furnace, before low-termination revision |              17.94 s |    Not promoted/exported |
| Revised seven-part kit                         |              15.85 s |                   5.62 s |
| Repair furnace receiver only                   |               3.12 s | 4.94 s including startup |

The receiver repair fixed a bolt head protruding 0.025 units beyond its bay; the mating duct now owns that joint's shared bolt heads. `--only city-furnace` and exporter `--merge` avoided rebuilding unrelated accepted parts. Actual integration/review time dominates generation. This result does not establish a future assets-per-hour production rate.

## Browser costs

Final measurement: `asset-studies/foundry/integration-03/browser-cost.json`, installed Edge, local Vite, reduced motion. Decimal KB below.

| Fully equipped foundry's unique normal images |    File size |
| --------------------------------------------- | -----------: |
| Hall collection route                         |      5.15 KB |
| Collector-to-extraction route                 |      6.40 KB |
| Optional furnace branch                       |      6.35 KB |
| Tall saddle                                   |      3.65 KB |
| Low electrical termination                    |      7.76 KB |
| Furnace casing                                |      7.28 KB |
| **Total**                                     | **36.58 KB** |

These six images are shared across foundries and instances. Local measured transfer including response overhead was 38.38 KB; decoded RGBA pixels total **1,027,072 bytes** (~0.98 MiB), before browser overhead. The fresh default city requested three distinct foundry images; optional machinery loads when drawn. City drawing requests 256px exports only. Failed/pending images retain procedural fallback artwork.

The full derivative catalog is 45.90 KB of normal images and 107.98 KB of optional 512px images. Both sets exist in the build; current city painting does not request 512px versions or the separate louver image. Blender sources, GLB masters and study history remain excluded from releases. Merely including an asset file in dist is distinct from fetching it into a visitor's browser.

The main JS chunk is **209.81 KB raw / 73.34 KB gzip**, compared with 192.04 / 64.18 before integration: approximately +17.77 KB raw / +9.16 KB gzip in that chunk. The review kit catalog remains in its deferred Atlas chunk. Separating the shared sprite runtime from the review catalog removed 8.95 KB raw / 3.11 KB gzip from the first integration's initial JS.

Local isolated renderer timing, zoom 4, 600 cached draws per variant:

| Measurement                                             |             Time |
| ------------------------------------------------------- | ---------------: |
| Initial procedural draw, including cold hall caches     |          20.2 ms |
| Wait for selected images/decode after fallback sampling |          15.2 ms |
| First new sprite-cache draw, with hall already warm     |           8.7 ms |
| Cached procedural median / p95 per draw                 | 0.085 / 0.550 ms |
| Cached sprite median / p95 per draw                     | 0.055 / 0.445 ms |

These are synchronous Canvas CPU submission timings on this machine. They exclude terrain, adverts, networks and GPU completion and are not city-scale FPS. Cold timings have different cache states, so they cannot establish a relative speedup. Tiny cached medians are noisy; the evidence supports a small steady drawing cost, not a general performance guarantee.

## Validation and retained evidence

- Native bay containment and route/power socket matching across 144 shape/height/seed/module combinations, in addition to the existing assembly suite.
- Fresh Blender reopening checks sources, cameras, triangle counts, actual bounds and annular flange face planes. Final sources are six derivatives under `integration-03/kit/` and the repaired furnace under `integration-04/kit/`.
- Evaluated duct vertices and triangle centres were checked against other conservative solids and access lanes in all three profiles. Intended port contacts are permitted. This sample check is not complete triangle collision, structural or fluid analysis.
- Shared decode promises, asset-ready invalidation and revisioned static caches preserve asynchronous loading in reduced-motion previews. Hidden/covered frame-loop gates remain intact; listeners are removed on disposal.
- `npm run check` passed with **86 unit tests**, production build passed, and all **15 browser tests** passed. After catalog splitting, the six kit unit tests and two affected production browser tests passed again; the original eight-part Atlas loading/cache check also passed.

Inspect the actual result through **City → Design atlas → Foundry**, with furnace and scrubber enabled, or `asset-study.html`. Reproduce costs with `node tools/asset-pilot/measure_foundry.mjs`. Final visual captures and recipe/source hashes are retained under `asset-studies/foundry/captures/14-fixed-camera/`.
