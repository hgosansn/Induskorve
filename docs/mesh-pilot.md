# Real-mesh asset loop

The pilot authors real indexed meshes in existing Blender, retaining editable `.blend` sources, GLB exports, materials, sockets and joint metadata. It installs no software and does not retrain an AI model. Experimental assets remain isolated from the shipped city until their acceptance gates pass.

## Tools

Use Node 24. Set `INDUSKORVE_BLENDER` to an existing trusted Blender executable, or pass `--blender`. The initial batch builds two alternatives per family. Completed candidate directories are immutable; partial outputs are retained as incomplete evidence.

For subsequent work, read `asset-studies/mesh-pilot/queue.json` and the prior independent reports first. Its starting artifacts are promising prototypes, not accepted city replacements. Continue a concrete unresolved job rather than regenerating the initial rejected alternatives. `batch --candidate electrical-termination-A-r1` limits generation to an existing builder identity; a genuinely new geometry candidate needs a fresh identity in the builder.

```sh
npm run assets:pilot -- batch --id NEW_RUN_ID --blender PATH_TO_BLENDER
npm run assets:pilot:capture -- NEW_RUN_ID review-r0
npm run assets:pilot -- status --id NEW_RUN_ID
```

`--skip-build` ingests already completed outputs without launching Blender. `register --dir PATH` registers a newly authored correction within the run. Open `/mesh-pilot.html?run=NEW_RUN_ID` on the Vite dev server for anonymous normal/close/idle captures, same-renderer city context, electrical module-off context and a rotatable depth-tested triangle inspector. The development page and study assets are excluded from production output.

The Codex coordinator orchestrates the agents. Node scripts build, validate, persist, capture and enforce decisions; they do not call a hidden model API or manufacture reviewer votes. One Codex run can execute the bounded batch without input between attempts. This pilot does not create a recurring schedule or permanent background service.

## Replay instruction

> Run the real-mesh pilot using this document and its frozen benchmark. Delegate a builder, a read-only spatial reviewer and a blind visual reviewer. Preserve existing city changes. Produce competing candidates, capture them in the city camera, record independent reviews, and make at most one targeted correction per family. Retain the incumbent on ties or missing evidence. Finish with actual gate outcomes and useful model/render links; do not request input after each attempt.

Four roles suffice: coordinator, builder, spatial reviewer and visual reviewer. Reviewers do not edit candidates. Builders own their generator and fresh artifact directories. Only the coordinator writes ledgers or integrates winners. Capture servers use separate ports; artifacts live outside `src/`, avoiding shared live-source capture races.

## Persistent loop

1. **Freeze the brief.** Preserve reference crops, native kit envelope, camera, state/variant matrix and `asset-studies/mesh-pilot/benchmark.md`. Treat the old mast as a negative example, including where the generated reference inherited it.
2. **Build alternatives.** Author function, supports and interfaces before detail. Retain source, GLB, normalized triangle JSON, beauty/idle images, provenance and a fresh-process Blender reopen report. Source-header checks alone do not prove a successful reload.
3. **Validate.** The validator checks signed file identities, bounded modern/legacy compressed Blender headers, PNG extent, indexed finite nondegenerate geometry, normals, bounds, materials, sockets/joints near actual triangles and triangle budgets. Actual world-space GLB triangles match the normalized source one-to-one at `1e-6` kit-unit tolerance. These checks do not establish general collision freedom, engineering design, artistic quality or continuous internal airflow cavities.
4. **Capture anonymously.** Normal-size, close, idle and contextual views expose failures hidden by isolated beauty renders. Captures record the context-renderer fingerprint; browser-storage access throws. A shared GPU context rasterizes actual triangles, preventing per-view browser context exhaustion.
5. **Review independently.** Visual reviewers receive anonymous images and the benchmark/reference. Spatial reviewers inspect geometry, interfaces, support/access and integration evidence without reading visual reports. Both explain defects and uncertainty. Relative improvement is separate from full benchmark acceptance.
6. **Record.** Review JSON contains `label`, `reviewerId`, `role`, `verdict`, `reasons`, explicit `benchmarkPassed` and `integrationReady`, and `evidenceDir`. Visual reviews also contain `anonymous: true` and the current `againstId`. Run `review --file PATH` for each report.
7. **Decide.** `decide --label E1` requires machine pass, independent spatial pass, anonymous visual win, explicit benchmark/integration acceptance from both reviewers, unchanged artifact bytes and the same captured context renderer. Ties, stale comparisons, vetoes and missing evidence preserve the incumbent. Promotion changes an experimental library incumbent; it does not deploy a city replacement.
8. **Correct or stop.** `queue-revision --label E1 --defect "OBSERVED_DEFECT" --expected "PREDICTED_CHANGE"` records one concrete builder job. The coordinator dispatches it; the builder writes a fresh `A-r1` candidate. Register/capture/review it independently. Stop after the one agreed correction if it still fails. `finish --reason "..."` closes a fully decided batch. Remaining candidate slots do not authorize extra polishing rounds.

`run.json` summarizes the per-family ledgers. `jobs.json` records correction objectives/outcomes. `blind-map.json` is coordinator-only identity information. `review-sheet.json` drives the gallery. Atomic ledger saves and an exclusive run lock protect decisions. Geometry fingerprints identify duplicate geometry; raw SHA-256 file hashes protect approvals. Generated artifacts are excluded from formatting so their signed hashes remain stable.

## Pilot 01

The first run generated four alternatives and two targeted corrections. Validation exposed modern compressed Blender-header and float32/JSON rounding assumptions; regression tests fixed the validator without weakening geometry matching. Independent spatial review found a missing electrical feed path, an inaccessible ladder and a fan intersecting a cleanout fastening. Visual review exposed equipment shrinking beside the hall despite better isolated renders.

The correction round models actual insulated feed-through bores and a deck gland, and reauthors the furnace assembly at native aisle scale with ground-service access. Files, captures and reports are in `asset-studies/mesh-pilot/runs/2026-10-30-pilot-01/`. Full optional furnace-module routing/state integration remains pending. The ledgers record final acceptance; an attractive image or relative visual win cannot override those gates.
