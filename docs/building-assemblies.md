# Building assembly contract

A building is an industrial process arranged on a floorplan. Its silhouette is a consequence of that arrangement. Do not attach interesting shapes to a roof and invent a reason afterward.

## What was wrong

The previous renderer placed parts independently in mixed tile/pixel coordinates. A cooling tower, control room, rooflight and optional module could occupy the same space. Categories were painted in a fixed order, so services could appear in front of physically nearer machinery. Equipment had gameplay effects but lacked credible mounting and process connections.

## Composition sequence

1. Choose the process: generation, melting or storage. Record what each visible part does.
2. Lay out the foundation, hall, equipment bays, door approaches and maintenance lanes in one local coordinate system.
3. Define mounting sockets before fitting parts. Each socket has a supporting part, mounting face, permitted part kinds and maximum envelope. Optional modules fill an existing bay; they cannot invent a new location.
4. Snap each part to its mount. Check containment, support contact, solid intersections and access clearances.
5. Define service ports on the actual part surface and connect compatible output/input ports. Internal pipe runs must reach their endpoints and avoid solids and reserved access space.
6. Render the validated arrangement. Resolve depth from spatial placement and support relationships, never from semantic layers. Apply material and small details inside the reserved envelope.
7. Inspect the assembled asset, its isolated parts, every optional-module combination, the placement ghost and the asset at city scale.

## Current kit

One tile contains a **12 × 12 local-unit kit**. Local z uses the same authored units; conversion to Canvas happens at the rendering boundary. These are art units, not certified engineering dimensions. Touching support faces are permitted; penetrating volumes are not. A frame's empty space is represented by separate solid legs and beam, not by disabling collision checks for the frame.

| Building  | Main process                                 | Heavy equipment                                                        | Roof                                                        | Access                                                         |
| --------- | -------------------------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------- | -------------------------------------------------------------- |
| Power     | Primary generating unit enclosed by the hall | Cooling cell, optional second generator enclosure, heat-exchanger skid | Control room and electrical rack                            | Facade ladder, roof lane, front apron                          |
| Foundry   | Primary melting furnace enclosed by the hall | Extraction stack or scrubber; optional second furnace bay              | Rooflights in their own strip, controls and electrical rack | Facade ladder, roof lane, furnace approach                     |
| Warehouse | Sheltered stock and loading doors            | Actual inventory stacks; two-legged handling gantry                    | Controls, electrical rack, optional supported solar array   | Clear door approach, roof lane; free gantry travel above stock |

The scrubber replaces the extraction bypass in the same bay. It does not appear as an unrelated cylinder. Extra turbines and furnaces are ground-mounted enclosed units. Solar panels sit on support rails. The balcony option is a front terrace deck with a guardrail; the ladder reaches that terrace whether or not the deck is fitted. The internal core connects the upper floors.

Functional references: the [EIA explanation of turbine generators](https://www.eia.gov/energyexplained/electricity/how-electricity-is-generated.php) informs the distinction between generation and cooling; [DHS basic plant components](https://cdp.dhs.gov/shared/se/courses/default/AWR-923-W%2005122021%201.2-20210512144644/groups/241.html) identifies the cooling loop's role. [HSE furnace-work guidance](https://www.hse.gov.uk/pubns/guidance/fd2.pdf) informed the visible extraction path. These are references for legible industrial function, not certification of the fictional facility.

## Modular architecture

The actual city now uses the WFC piece kit. The hall envelope reserves space while its solids are 25 non-overlapping, ground-supported stacks. All ground bays are occupied to enclose the industrial process and attach the existing service ports. The taller rear pads carry controls, the grid mast and an internal core. Rooflights and solar panels occupy their own pinned terraces; the front terrace, entrance approach and facade ladder stay connected.

Shape, role, height and appearance seed determine the layout. Warehouse halls are wider and lower, with a light court above the process floor; power halls can grow taller; foundries reserve a rooflight pad beside the extraction equipment. Modules and stock never reroll the hall. Equipment still changes the existing domain capacities, output, storage and emissions rules.

The generator uses the same adjacency propagation and core reachability as the Atlas lab with different pinned cells. Each roof attachment is validated against actual contact area across the underlying stacks. A conservative bounding envelope alone is no longer sufficient proof of roof support. No generated stack reaches into neighbouring plots or reserved ground equipment bays.

`modular-hall.ts` projects the shared floor/window/brace kit into the hall volume. It caches the static facade in two raster layers, inserting the animated right-side display at its correct depth. Windows follow activity; names remain directly on the front wall. Geometry and raster caches are reused between frames, and offscreen structures are culled. These caches do not claim production-scale performance for 2,500 buildings.

No save migration is required. Existing buildings acquire modular appearances deterministically while their IDs, positions, authors, modules and inventories remain intact. Workshop seed controls reproduce the same layout in preview, ghost, placement and reload.

## Ownership in code

- `src/rendering/assembly/model.ts`: presentation-only parts, mounts, solid envelopes, clearances, ports, routes and validation.
- `mounts.ts`: reserved floorplans and mounting sockets, independent of fitted equipment.
- `compose.ts`: role/module/stock configuration becomes an assembly with reasons and connections.
- `draw-order.ts`: support-aware fixed-camera part ordering.
- `src/rendering/generation`: deterministic WFC solver, industrial constraints, exposed-bay kit and shared artwork.
- `src/rendering/canvas/buildings.ts`: draws equipment and services; `modular-hall.ts` draws cached modular floors using the common palette.
- `building-layout.ts`: external wires and heat pipes read the same physical ports as the artwork.
- `BuildingPreview`: framing derives from the assembled bounds; city, workshop and Atlas share the same renderer.

The domain still owns capacities, production and saved module choices. It does not import geometry. No save migration is needed: assembly geometry is derived from existing records.

## Acceptance and limits

Tests additionally cover 432 role/shape/height/seed combinations, actual roof contact failures and preview/ghost/save recipe equality. Existing tests cover all module subsets, all three core shapes, balcony on/off and representative heights including legacy limits (360 configurations), plus deliberately invalid collisions, support/mount failures, blocked access and broken routes. The Atlas can isolate each part and explains its role and support. Module changes must affect both the intended domain rule and its actual visible assembly.

This is a constrained procedural kit, not a general CAD or structural solver. Collision checks use conservative solid envelopes; they do not calculate mass, load, thermal performance, fluid physics or human-code compliance. Part-level painter ordering is intended for these floorplans and fixed camera; arbitrary intersecting meshes require a different renderer. City-wide cable/pipe routing still does not avoid every intervening building. The single-tile footprint, local simulation and multiplayer limitations are unchanged.

For a new asset, begin with its process diagram and floorplan. Add a bay, support, clearance and ports before drawing details. Reject a module combination that cannot fit; do not shrink or hide equipment to make the preview pass.
