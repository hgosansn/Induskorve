# Asset creation and browser-delivery costs

Measured locally on 2026-10-30, pilot 01. Sizes below use decimal KB/MB. No source assets were modified by the encoding experiments.

| Revised asset      | Triangles | Editable Blender source |     GLB | Diagnostic triangle JSON | 1024-square beauty PNG |
| ------------------ | --------: | ----------------------: | ------: | -----------------------: | ---------------------: |
| Electrical rack    |    40,768 |                 1.89 MB | 1.67 MB |                  7.25 MB |                 636 KB |
| Furnace/extraction |    48,932 |                 2.06 MB | 2.04 MB |                  8.93 MB |                 516 KB |

The entire local run is 159.07 MB, including candidates, repaired/rejected versions, duplicate anonymous review data and screenshots. This is local authoring/review storage, not a visitor's required download. The production build excludes the pilot and these generated artifacts.

## Actual gallery load

Before the delivery audit, a cold gallery load fetched six diagnostic JSON meshes (36.26 MB) and twelve beauty/idle PNG URLs (7.71 MB): about 43.97 MB. It fetched neither `.blend` nor GLB. The review gallery now loads a diagnostic mesh and its city context only after **Load mesh and city context** is selected. Browser checks confirm zero mesh requests/context renderers initially, exactly one after one selection, and all six still work for automated capture. The capture runner explicitly loads the full batch for review.

The initial image workload remains a review-tool cost; production should use appropriately sized delivery images and lazy-load optional close inspection. Electrical active and idle images are identical and should share a resource rather than duplicate delivery data.

## Measured delivery options

Browser Canvas cropped transparent margins and encoded the existing beauty images as WebP quality 0.85. These are file-size measurements, not a visual acceptance of the lossy export.

| Longest sprite edge | Rack WebP | Furnace WebP | Rack decoded RGBA | Furnace decoded RGBA |
| ------------------- | --------: | -----------: | ----------------: | -------------------: |
| 128 px              |   3.77 KB |      2.72 KB |           54.8 KB |              37.9 KB |
| 256 px              |   8.61 KB |      6.15 KB |          218.1 KB |             151.6 KB |
| 512 px              |  20.90 KB |     14.45 KB |          870.4 KB |             606.2 KB |

A decoded 1024 × 1024 RGBA image occupies 4 MiB before browser overhead regardless of its compressed PNG size. The two raw meshes use approximately 3.42/4.11 MB of typed position/normal/index data in the current inspector, plus parsed JSON arrays and browser/GPU overhead. Download compression does not remove this decoded geometry or its triangle cost.

Local Brotli quality-5 experiments compressed the rack/furnace GLB to 180/201 KB and diagnostic JSON to 572/668 KB. Those are conditional transport sizes: hosting must actually serve the appropriate Content-Encoding. No production hosting compression configuration was verified or changed. The assets retain the same triangle count and decoded data after decompression.

## Production direction

Keep real 3D editable masters and generate delivery artifacts automatically. The fixed camera supports cached part sprites/atlases with precise mounting/wire/pipe anchors, occlusion layers and separate activity overlays. Retain genuine meshes for authoring and selected close inspection. Load each unique part once and reuse it across buildings; do not create independent downloads for every city instance. Avoid baking every complete building seed/module combination.

Starting delivery targets, subject to visual checks: 128–256 px normal piece images, 512 px optional close images, roughly 5–25 KB per piece/state for content comparable to this pilot. A small initial kit should target a low-single-digit-MB asset budget with later families loaded on demand. These are proposed budgets, not measured catalog-wide guarantees. If runtime 3D becomes necessary, author lower-detail runtime meshes, share geometry/materials, batch/instance repeated pieces and benchmark actual city-scale frame time.

## Creation efficiency

The pilot included new authoring/export/validation tools, independent review, round-trip bugs and targeted repairs. It did not record a reliable standardized seconds-per-new-asset benchmark; do not promise a production rate from it.

The next creation workflow should build families from reusable tested recipes: flanges, elbows, ducts, saddles, frames, cabinets, insulators, louvers and service platforms. Deeply review a new construction pattern once; generate dimensional/style variants in batches and compare contact sheets. Use inexpensive low-resolution previews during iteration and reserve full beauty rendering/export for selected candidates. Keep high-detail masters when baking; remove invisible runtime bevels/bores from any actual runtime-mesh profile.

Track generator, render, validation and review time separately for the next batch. Report useful accepted pieces per batch, not attempt counts or polygon counts. Preserve role, mounting, clearance and connection tests while avoiding repeated full art-direction reconsideration of unchanged hardware.
