# Reusable service kit — first measured batch

Built and reviewed 2026-10-30. Open **City → Design atlas → Reusable parts**. The atlas kit ships on demand; `/parts-batch.html` is development-only. Existing city recipes and saves are unchanged.

![Eight-part contact sheet](../asset-studies/parts-batch-01-r1/contact-sheet.png)

Eight parts: two duct lengths, swept elbow, vertical reducer, saddle stand, braced frame, wall louver and service cabinet. The two duct lengths share a recipe. Seven distinct parts are demonstrated together. Independent review accepted all eight as reusable visual candidates and the corrected service cell as an assembly study. The louver still needs a host wall. This is not a complete functional extraction process or building/module integration. Static active/idle artwork is shared.

## Time and useful output

Work began **14:06:58 UTC**; build/shipping verification completed **14:19:55 UTC**: **12m57s** to the reviewed batch, including authoring, atlas/export wiring, independent review, one repair round and checks. Documentation after that checkpoint is excluded. Seven assembly-demonstrated parts average **1m51s each**, including setup/repairs; this is a first-batch result, not an established production rate.

| Automated phase                                                   | Corrected eight-part batch |
| ----------------------------------------------------------------- | -------------------------: |
| Generate geometry                                                 |                     0.97 s |
| Save Blender sources and GLB masters                              |                     0.70 s |
| Eight 512px Cycles renders, eight samples each                    |                     7.97 s |
| Complete Blender script                                           |                     9.65 s |
| Crop and encode both WebP sizes, including browser/server startup |                     3.23 s |
| Fresh-process source verification                                 |                     0.12 s |
| Atlas loading/cache/capture verification, including startup       |                     4.48 s |

The initial pass took 9.54 s to build and 3.62 s to export. Initial and repaired artifacts are retained. Rerunning recipes in approximately 13 seconds does not mean designing eight new assets in that time: authoring, fit and review dominate.

## Delivery costs

Decimal KB/MB below; decoded image memory is separate.

| Part       | Normal 256px WebP | Optional 512px WebP |
| ---------- | ----------------: | ------------------: |
| Long duct  |           6.03 KB |            14.12 KB |
| Short duct |           7.08 KB |            16.92 KB |
| Elbow      |           7.18 KB |            16.69 KB |
| Reducer    |           6.90 KB |            16.21 KB |
| Saddle     |           5.80 KB |            14.50 KB |
| Frame      |          11.71 KB |            30.78 KB |
| Louver     |           7.54 KB |            17.53 KB |
| Cabinet    |           5.03 KB |            11.00 KB |
| **Total**  |      **57.26 KB** |       **137.75 KB** |

Both image sets total **195.01 KB**. The optional atlas implementation/catalog chunk is 13.77 KB raw / 5.09 KB gzip in this build; it includes the study UI and loader. No server compression configuration was changed.

Browser checks measured zero kit image requests before opening the kit; eight normal images on opening; zero close images until closer view; no repeated normal-image requests on return. The shared promise cache deduplicates simultaneous requests and repeated stands. Normal textures decode to **1,635,328 RGBA bytes** (~1.56 MiB), before browser overhead. Drawing uses cached images; no per-frame modeling or mesh rasterization. Callers own culling and depth placement. City-scale frame time was not benchmarked.

All eight compressed editable Blender files total **0.94 MB**, and the eight GLB masters total **0.94 MB**. These remain outside the release. Corrected sources/evidence are in `asset-studies/parts-batch-01-r1/`; delivery sprites/catalog are in `src/rendering/assets/parts-batch-01/`. `reusable-parts.ts` loads and paints at native kit scale with XYZ anchors.

## What review caught

The first assembly exposed mirrored camera X, a cabinet missing perimeter frame rails, flange-centre ports overlapping plates, and a stand intersecting a joint flange. Repairs added a projection-basis gate, cabinet bearing rails, actual face-plane ports, supports clear of larger bands, and cabinet-after-frame painting. The demonstrated arrangement uses two stands; the reducer/elbow connection is seated.

Fresh Blender reopening verified all sources, evaluated triangle counts, cameras and real annular mating-face planes. Three unit tests cover delivery budget/projection, opposed matching ports and demonstrated supports. `npm run check` passed with 83 tests; production build, atlas/cache browser checks and the production shipping test passed. Release checks exclude masters, study directories and development pages.

The remaining painter order is specific to this arrangement. Arbitrary intersecting sprites, structural loads, cabinet door clearance, host walls, full process endpoints and operating/module behavior need validation when incorporated into buildings. The flat-topped saddle could gain retaining clamps in a future functional variant; further cosmetic iteration was not needed for this bounded batch.

## Repeat the workflow

Use the existing trusted Blender runtime and Node 24. The builder refuses to overwrite an existing source output directory.

```powershell
& 'C:\Users\Ktz\Documents\MAKE_YOUR_OWN_GAME\.runtime\blender\blender-5.2.2-windows-x64\blender.exe' --background --factory-startup --python tools/asset-pilot/build_parts.py -- --out asset-studies/parts-batch-02
node tools/asset-pilot/export_parts.mjs asset-studies/parts-batch-02
& 'C:\Users\Ktz\Documents\MAKE_YOUR_OWN_GAME\.runtime\blender\blender-5.2.2-windows-x64\blender.exe' --background --factory-startup --python tools/asset-pilot/verify_parts.py -- asset-studies/parts-batch-02
```

The exporter replaces the delivery library at its existing `parts-batch-01` path; it is not a catalog append tool. Update recipes deliberately for a new batch. `node tools/asset-pilot/check_parts_browser.mjs` verifies the atlas path and refreshes current batch captures/evidence. Preserve camera, palette, mounting rules and inexpensive preview review when adding families.
