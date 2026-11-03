# Single-asset iteration

This is a working local review workflow for the city's procedural assets. Start with one fixed asset and improve it through captured evidence. It is not model training, an automatic image-to-mesh system, or an unattended background job.

## Run

Use Node 24 and the existing dependencies. No new software is required. The capture tool launches installed headless Edge by default; set `E2E_CHANNEL=chrome` to use installed Chrome, or `chromium` for an existing Playwright browser. It does not download browsers.

```sh
npm run assets:capture -- asset-studies/foundry/captures/next-pass asset-studies/foundry/recipe.json
```

The destination must be new. Each run starts and stops its own local Vite server on `127.0.0.1:4181` and browser. A successful run writes four PNGs of the visible city camera, a full contact sheet and `manifest.json`. The manifest records the validated recipe, assembly, fit errors, palette, viewport, frozen clock, browser version, Git HEAD and SHA-256 of the current `src/` tree. It records working source rather than assuming HEAD includes pending changes. A missing manifest means the capture did not complete successfully.

For manual inspection, run `npm run dev -- --configLoader native` and open `/asset-study.html` on the displayed localhost address. Paste a recipe into the input. This development entry is intentionally excluded from the published application build. It does not initialize the city store or access browser storage; the capture runner makes any storage access throw.

## What is captured

- Operating, idle, close and small-scale views use the same `BuildingPreview` and production renderer as the city, with reduced motion freezing the clock at zero. The close view enlarges the camera image to inspect fittings; the normal and small captures remain the readability checks. Improvements target this one fixed camera, as requested by the user.
- Geometry diagnostics are optional: tick the checkbox on the manual study page. Front (+Y), right (+X), back (-Y), left (-X), top (+Z) and isometric diagnostics project the actual assembly solids. They show conservative collision/support masses, not textured surfaces. Orthographic views use local kit units; the isometric diagnostic uses the city's stylized vertical proportion.
- Side and rear diagnostic views omit facade details, service routes and small fittings. Use them only to resolve a spatial question. Creating rear artwork or a turntable is outside the current asset brief.
- The small view is a readability sample, not a measurement of one exact city zoom. Production behavior and animated transitions still need separate browser inspection.

## Agent loop

1. **Freeze the subject.** Save a recipe: role, shape, height, seed, modules, stock and display. Write the intended process and the visual problem. Keep baseline inputs unchanged through the comparison.
2. **Capture and inspect.** Open the operating, idle, close and small images from the city camera. Name the three largest visible shortcomings. Request a geometry diagnostic only if it will resolve a specific fit question. Passing fit checks alone is not visual acceptance.
3. **Generate one reference.** Use the baseline screenshot with the built-in imagegen workflow. Ask for the same asset, feasible functional detailing, the project's palette and close studies of the weakest parts. Save the generated image and exact prompt beside the recipe. Inspect the reference; record useful ideas and rejected inventions. Generated back views are proposals and may contradict other views.
4. **Translate into geometry.** List the concrete changes before editing. Follow process → floorplan → mounts → solids/clearances → ports → artwork. New protrusions need reserved space and validation. Surface detail must remain inside its declared envelope. Keep all authored colors in `palette.css`.
5. **Change one level at a time.** Fix silhouette/proportion first when needed, then structural rhythm, equipment/services, and finally fittings/material detail. Richness comes from purposeful detail and quiet surfaces. Preserve deterministic seeds, module behavior and renderer lifecycle/cache gates.
6. **Recapture identically.** Use a new output directory. Compare baseline and candidate at the same scale and state. Check whether detail actually improves readability, whether powered lights turn off, and whether lettering and equipment overlap.
7. **Critique and retry.** Record observed improvements, remaining defects and what was rejected. Default to at most three code-and-capture passes per brief. Stop earlier if the planned changes pass. If progress stalls, preserve the best candidate and report the unresolved design decision instead of adding detail indefinitely.
8. **Verify and report.** Run `npm run check`, `npm run build`, `npm run test:e2e`. Inspect actual screenshots; verify module-off states and placement/preview consistency through the existing suite. Record candid acceptance: technical checks, visual assessment and remaining user review are distinct. Never claim the reference has been reached merely because tests pass.

## Review criteria

| Criterion                | Evidence needed                                                                 |
| ------------------------ | ------------------------------------------------------------------------------- |
| Role and silhouette      | Recognizable at small scale without network overlays                            |
| Proportion and structure | Intentional massing, supported equipment, consistent bay rhythm                 |
| Process                  | Extraction, cooling, loading and access have clear purposes                     |
| Detail hierarchy         | Readable large forms, medium equipment, close-only fittings; quiet faces remain |
| State                    | Actual operating/idle difference, no phantom stock or disabled modules          |
| Integration              | Existing save recipes, placement and cached rendering remain valid              |

The user requested self-ratings after each iteration. Record separate 1–10 scores for roof logic, process/connection clarity, support/access and visual richness, with one concrete observation per score. Use 1–4 for major unresolved defects, 5–6 for plausible but ambiguous work, 7–8 for coherent work with remaining weaknesses, and 9–10 only when no important defect is identified within the current brief. Keep baseline and intermediate scores, including unchanged or lower scores. Prioritize the weakest functional issue before adding cosmetic detail. These are subjective critique scores; passing technical checks is separate evidence, and the scores do not certify user acceptance.

## First exercise

See `asset-studies/foundry/review.md` for the fixed foundry, generated reference, selected details, before/after captures and known limits. Keep selected compact evidence; do not create ZIP bundles or ship study references as game textures.
