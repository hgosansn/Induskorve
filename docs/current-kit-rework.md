# Current kit rework — completion record

2026-10-30. This finishes the coverage pass for the **three existing roles**, before adding building types or diversity. The actual city, workshop/ghost and Design atlas share these renderers. No domain capacities, production rules, saves, dependencies or building types changed. No deployment or commit was performed.

![Three current roles](../asset-studies/current-kit-01/lineup.png)

## Complete piece inventory

All 19 assembly kinds have a visible implementation and an isolated review capture. Recently completed furnace/duct pieces were retained deliberately; they were not regenerated merely to count more assets.

| Kind         | Rework / deliberate retention                                                                                                                                               |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| foundation   | Contact footings, inset bearing caps and anchors; no whole-plot foundation slab.                                                                                            |
| hall         | Recessed skin now shared by all roles; sill/head reveals, columns, flashing, framed doors/loading shutters and sealed roof seams. Existing deterministic WFC stacks remain. |
| cooler       | Grounded basin, intake belt/piers, faceted waisted shell, open rim/drift grille, header and owned coolant interfaces.                                                       |
| turbine      | Deep cooling bank, framed service enclosure, casing joints, service door and bus fitting.                                                                                   |
| exchanger    | Supported plate pack, endplates, tie rods and copper fittings.                                                                                                              |
| furnace      | Retains the recently modeled casing, inclined louvers and contained active-only throat overlay.                                                                             |
| stack        | Explicit base/cleanout panels, flue seams, bands and maintenance ladder; separately reviewed without scrubber.                                                              |
| scrubber     | Treatment-body panels, instrumentation, flue seams/bands and access details at native variable height.                                                                      |
| plenum       | New editable sealed casing, cleanout cover and actual annular receiver/outlet flanges.                                                                                      |
| duct-support | Retains the exact native-height saddle and shared sealed route exports.                                                                                                     |
| hatch        | New gasketed hinged hatch with curb and latch, centred on its actual stair-core mount.                                                                                      |
| skylights    | Framed folded northlight, solid ends, glazing divisions and ridge/eave details.                                                                                             |
| solar        | Height-matched mounting supports, tilted framed panels and restrained cell grid.                                                                                            |
| gantry       | Open-span braced frame, beam/column joints, steel suspension, trolley and hook.                                                                                             |
| cargo        | Pallet runners/deck, stacked billet rows and physical binding bands; stock controls presence/tiering.                                                                       |
| catwalk      | Deck, toe boards, stanchions and continuous handrails.                                                                                                                      |
| ladder       | Separate rails, rungs and brackets with thin outlines and readable metal surfaces.                                                                                          |
| grid         | Shared low cabinet/ceramic termination for all roles; actual wire socket follows the 1.55-unit mount height.                                                                |
| terminal     | New anchored weatherproof logistics interface; small active-only materials indicator.                                                                                       |

The hall pass covers the five facade families (glazing, clerestory, louvers, ribs and frame), floor slabs, columns, braces, entrances, roof caps/guardrails and core/deck surfaces. Existing stair connectivity and pinning are retained. Membrane and deck finishes are currently generated. The separate foundry northlight is active; the renderer's unused generic `daylight` roof-finish branch is not claimed as newly integrated artwork.

Non-exhaust service strokes now use cached native-volume pipe/bus sections. Power equipment owns its correct nozzle fittings, avoiding duplicate generic boxes. External sagging yellow wires, airborne blue indicators, advert surfaces, facade lettering and smoke are deliberately retained. No endpoint bubbles, angular blue network cables, fake bulk transport or new random rooftop machinery were introduced.

Fixed hardware uses retained Blender/GLB masters and small sprites. Variable equipment, hall skin and access details use native XYZ parametric Canvas surfaces inside existing caches. **This is a mixed 2.5D kit, not a claim that every part now has a retained Blender mesh.**

## Visual acceptance and remaining quality gap

Independent review inspected all 19 kinds through `final-power`, `final-factory`, `final-warehouse`, `final-bypass`, their isolated part views, the shape/height sheet and empty/full stock captures. Coverage was accepted for this bounded rework with no unexplained omitted kind. `final-warehouse-clearance` adds the final raised hook. Atlas now offers **Part only** to centre and isolate selected production geometry.

| Assessment basis                      | Silhouette / role | Material depth | Process / access | Tiny city-scale readability |
| ------------------------------------- | ----------------: | -------------: | ---------------: | --------------------------: |
| Foundry — existing reference-relative |                 7 |            5.5 |                4 |                           5 |
| Power — internal coherence            |                 7 |              7 |                5 |                           5 |
| Freight — internal coherence          |                 8 |              7 |                7 |                           5 |

Scores are subjective critiques, not objective metrics or user approval. Power/freight have no inspected equivalent target image, so their scores are not reference-fidelity claims. Freight improves most visibly. Power gains coherent machinery construction. Foundry hardware is more consistent, but the collector path remains partly concealed and its lid is bright. Small-scale detail still disappears; coverage completion does not mean the original concept's fidelity has been reached. A future floorplan/junction study, rather than more scattered fittings, would address the remaining foundry process-reading weakness.

## Time and delivery costs

Work began **16:44:19 UTC**. Final verification completed **17:12:24 UTC**: **28m05s** wall time, including parallel power/freight work, inventory, native geometry, three new meshes, two review rounds, isolated captures, sweeps, repairs and validation. Documentation after the checkpoint is excluded. This measures this coverage pass, not nineteen brand-new asset designs or a sustainable assets/hour rate.

The three new fixed parts built/saved/rendered in **4.08s** and cropped/encoded/exported in **3.67s**, including export browser/server startup. Editable masters total about **306 KB**; GLB masters about **178 KB**. These files are authoring artifacts, excluded from releases.

| Browser cost                                              |                                               Measured result |
| --------------------------------------------------------- | ------------------------------------------------------------: |
| New normal sprites: plenum + terminal + hatch             |                                                  **16.51 KB** |
| Optional close exports for those three                    |                                                      37.91 KB |
| Shared grid + terminal used by power/freight              |                   **12.45 KB** total, reused across instances |
| Fully equipped foundry's nine unique normal sprites       |                 **53.09 KB** total, including shared hardware |
| Fully equipped foundry decoded RGBA pixels                | **1,525,760 bytes** (~1.46 MiB), before overhead/cache copies |
| Full ten-part derivative catalog, normal / optional close |                                             62.41 / 145.89 KB |
| Main JS chunk after pass, raw / build gzip estimate       |                                         **223.89 / 78.24 KB** |
| Main JS change from previous foundry integration          |                    **+14.08 KB raw / +4.90 KB gzip estimate** |

Variable power/freight/access geometry adds code rather than per-seed image files. City drawing requests 256px sprites and shares decode promises. The review catalog remains deferred; sources, GLB and study history stay outside dist. No hosting compression configuration was changed. Texture download/memory are shared per unique part; per-building static caches and CPU/browser overhead remain additional costs.

Local zoom-4 synchronous renderer samples (600 cached draws per role): power cold cache 16.9ms / cached median 0.115ms; foundry 9.1 / 0.110ms; freight 15.7 / 0.095ms. Cached p95 values were 0.875 / 0.755 / 0.700ms. Other validation activity was running. These noisy CPU submission samples exclude terrain, adverts, networks and GPU completion; they are not city FPS or proof of a speedup. Raw measurements are in `asset-studies/current-kit-01/cost/browser-cost.json`.

## Validation and repairs

- `npm run check` passes: lint, frontend/server types, **94 unit tests** and formatting. Production build passes.
- All **15 browser tests** passed; after final hook clearance correction, the affected Atlas/module/isolation and canvas-lifecycle tests passed again.
- **47 browser sweep cases** pass: all three shapes, workshop short/tall heights (24/85), optional-module subsets, scrubber bypass and empty/partial/full warehouse stock. The profiles sheet includes 18 short/tall combinations. Native geometry tests also exercise taller legacy inputs; the workshop schema does not allow height 120/160.
- Power/freight tests check emitted bounds and idle physical persistence. Shared hardware tests check native envelopes and exact power/logistics sockets. Existing assembly, sprite loading, ghost/save, service-state and lifecycle coverage remains.
- Fresh Blender reopening verifies the three new sources, evaluated triangle counts/bounds and actual plenum flange face planes.
- The state sweep exposed transient zero-size previews during layout; drawing now waits for positive dimensions. A first sweep attempted a legacy-only height through the workshop schema; it was corrected to valid workshop inputs rather than weakening validation.
- Visual review caught thick ladder outlines and a network-like blue hoist. Full-stock clearance review caught the hook extending below its safe lane; its geometry now stays above two cargo tiers throughout travel, including short halls, and remains stationary when idle. This has a dedicated regression check.

The spatial checks remain envelope/sample checks, not structural engineering, airflow or general mesh collision certification. Static captures supplement, rather than substitute for, automated state and lifecycle evidence.

Run `node tools/asset-pilot/review_current_kit.mjs` for the sampled state/profile sweep; `node tools/asset-pilot/measure_foundry.mjs <fresh-output-directory>` records payload and per-role cached drawing. `tools/capture-asset.mjs <fresh-output-directory> <recipe.json> --pieces` captures centred individual production parts. Normal city/workshop/ghost behavior uses the same renderer.
