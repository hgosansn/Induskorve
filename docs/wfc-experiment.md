# WFC building experiment

Open **City → Design atlas → WFC lab**. Try Terraces, Spire and Courtyard, change the seed, lower the floor section and toggle the structural frame. The plan beside the preview shows the occupied bays at the selected floor. This is an experiment in massing and assembly, not the final art direction or a new playable building.

## What is being solved

This is a small **simple tiled WFC** implementation inspired by [Maxim Gumin's original algorithm](https://github.com/mxgmn/WaveFunctionCollapse). A 5 × 5 plan has a domain of possible stack heights at each cell. A tile represents an entire ground-supported stack, rather than an individual mesh or a full 3D voxel. Zero means open ground.

1. Pin the stair core, front-centre entrance, two open approach corners and (for Courtyard) the empty centre.
2. Remove stack heights with no compatible neighbour. Terraces permits a one-storey difference; Spire and Courtyard permit two.
3. At every storey, remove heights that cannot retain a potential route to the stair core. This additional global connectivity constraint goes beyond ordinary local WFC adjacency.
4. Select the unresolved cell with the lowest weighted entropy. Weights favour taller stacks near the core.
5. Collapse it using a deterministic random stream, propagate again and backtrack on contradiction. Stop at a bounded observation budget and report failure explicitly.

`wfc.ts` owns this pure model and its validator. Seed, style and generator version identify the recipe; the solved height array is explicit. No palette, Canvas or React imports belong in the solver. Version 1 is experimental: changes to constraints or randomness should bump the version before any generated recipes become persistent.

## How a solution becomes an asset

`wfc-kit.ts` compiles each occupied storey into a bay with exposed-face, roof, entrance, core, brace and lighting flags. Shared internal faces disappear. Each floor rests on the preceding floor down to the ground. A brace pattern repeats vertically; it does not change randomly between frames.

`draw-wfc.ts` renders slabs, wall/window panels, vertical supports, braces, roof caps/rails and the core/entry markers on common bay and storey datums. The renderer consumes the shared CSS palette through `readPalette()`. Sectioning clamps the displayed heights only, leaving the original solution and seed intact. The lab draws on resize/control changes, not a continuous animation loop.

The current six-piece kit is a rendering grammar with semantic roles, not six independently solved mesh assets. Connectivity represents unobstructed floor adjacency; stair geometry, interior circulation, loads, fire egress, terrain adaptation, cantilevers and physical equipment routing are not solved. Lighting is illustrative, not powered by city services. The fixed camera displays the two camera-facing sides of each exposed bay.

## Experiment boundary

The lab has local React state and no city commands, persistence writes or SpacetimeDB schema changes. Existing city and workshop assets continue to use `rendering/assembly`. Its conservative volume validator is not used as proof that these experimental buildings are valid. No new dependencies are required.

The next useful experiments are multi-bay hall tiles, typed edge sockets, service cores, roof equipment clearances and role-specific room constraints. Those should be judged visually and through meaningful industrial functions before promoting generated buildings into placement. Full 3D WFC may be worthwhile for bridges and overhangs; it adds support and access constraints that this height-field model intentionally cannot express.

## Verification

Unit checks cover 300 seeds over three grammars, repeatability, shape diversity, adjacent height rules, per-floor connectivity, bounded failure and shared-face removal. A deliberately disconnected upper floor is rejected. Browser checks exercise seed replay, grammar changes, cutaways, structure view, mobile scrolling and unchanged city storage. This verifies the experiment's constraints, not architectural realism.
