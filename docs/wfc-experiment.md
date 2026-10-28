# Modular WFC buildings

Open **City → Design atlas → WFC lab**. Try Terraces, Spire and Courtyard, change the seed, lower the floor section and toggle the structural frame. The plan beside the preview shows the occupied bays at the selected floor. The lab remains a massing study. The same solver and piece artwork now also build the actual city halls through an industrial constraint profile.

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

The current six-piece kit is a rendering grammar with semantic roles, not six independently solved mesh assets. Connectivity represents unobstructed floor adjacency; stair geometry, interior circulation, loads, fire egress, terrain adaptation, cantilevers and physical equipment routing are not solved. Lighting in the standalone lab is illustrative; city windows follow the actual local service activity. The fixed camera displays the two camera-facing sides of each exposed bay.

## City profile and integration

`city-massing.ts` is city kit version 2. It derives a recipe from the existing appearance seed, shape, height and building role. The front row stays one storey tall, the rear-right service pad carries electrical hardware while operator spaces are integrated into upper floors, and all ground cells enclose a continuous process floor. The core connects every upper floor. Foundries reserve a rooflight pad; warehouses reserve a solar terrace even before a retrofit and leave a light court above the ground floor. The role caps upper floor counts and determines the hall proportions.

The solver has a bounded budget. A constructive, deterministic lower-bound layout is available on exhaustion and exposes a `fallback` flag for diagnostics; tested recipes do not exhaust. It is built from the same pinned heights and height-step bounds. Kit version 2 deliberately frees the former control-room pad and expands facade pieces; subsequent changes must preserve determinism or declare another kit revision; the current saves retain their existing schema and fractional appearance seed.

`massingSolids` compiles actual stack volumes for assembly support checks. `modular-hall.ts` scales the common piece renderer into those same volumes; it draws two cached layers with an animated advert between them. `composeBuilding` attaches functional equipment using reserved pads. Domain production/network rules remain independent of floor geometry: more floors do not silently add capacity.

Workshop, ghost, city and Assembly Atlas share this production renderer. Layout seeds are editable and replayable. The separate WFC lab has local React state and continues to demonstrate unconstrained terraces, spires and courtyards. It never writes a city save. No new dependency or SpacetimeDB change was introduced.

Future experiments can add multi-bay hall tiles, typed sockets, service routing and more room constraints. Full 3D WFC would be needed to explore bridges and overhangs beyond the current ground-supported height field. Structural loads and interior egress remain outside the model.

## Verification

Unit checks cover 300 seeds over three grammars, repeatability, shape diversity, adjacent height rules, per-floor connectivity, bounded failure and shared-face removal. A deliberately disconnected upper floor is rejected. City checks cover another 432 role/shape/height/seed combinations, all fitted modules, actual roof support failures and preview/ghost/save recipe equality. Browser checks exercise seed replay, grammar changes, cutaways, structure view, mobile scrolling and unchanged city storage. This verifies the experiment's constraints, not architectural realism.
