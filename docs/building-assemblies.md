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

| Building  | Main process                                 | Heavy equipment                                                        | Roof                                                             | Access                                                         |
| --------- | -------------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------- |
| Power     | Primary generating unit enclosed by the hall | Cooling cell, optional second generator enclosure, heat-exchanger skid | Integrated operator floor and electrical rack                    | Facade ladder, roof lane, front apron                          |
| Foundry   | Primary melting furnace enclosed by the hall | Extraction stack or scrubber; optional second furnace bay              | Rooflights in their own strip and electrical rack                | Facade ladder, roof lane, furnace approach                     |
| Warehouse | Sheltered stock and loading doors            | Actual inventory stacks; two-legged handling gantry                    | Integrated operator floor, electrical rack, optional solar array | Clear door approach, roof lane; free gantry travel above stock |

The scrubber replaces the extraction bypass in the same bay. It does not appear as an unrelated cylinder. Extra turbines and furnaces are ground-mounted enclosed units. Solar panels sit on support rails. The balcony option is a front terrace deck with a guardrail; the ladder reaches that terrace whether or not the deck is fitted. The internal core connects the upper floors.

Functional references: the [EIA explanation of turbine generators](https://www.eia.gov/energyexplained/electricity/how-electricity-is-generated.php) informs the distinction between generation and cooling; [DHS basic plant components](https://cdp.dhs.gov/shared/se/courses/default/AWR-923-W%2005122021%201.2-20210512144644/groups/241.html) identifies the cooling loop's role. [HSE furnace-work guidance](https://www.hse.gov.uk/pubns/guidance/fd2.pdf) informed the visible extraction path. These are references for legible industrial function, not certification of the fictional facility.

## Modular architecture

Foundations follow the actual ground-contact solids of the hall and fitted machinery. Crane legs have separate footings; the span beneath the beam and the surrounding apron stay open at street level. Support validation checks each lowest solid against its supporting faces, so an empty envelope no longer requires a full rectangular plinth. Flat pedestrian paths use the reserved outer margin and front door approach; they never traverse the machinery bays.

The actual city now uses the WFC piece kit. The hall envelope reserves space while its solids are 25 non-overlapping, ground-supported stacks. All ground bays are occupied to enclose the industrial process and attach the existing service ports. The rear-right pad carries the grid mast beside the internal core. The separate control-room box and its rear-left height constraint are removed; operator glazing is integrated into upper hall floors. Rooflights and solar panels occupy their own pinned terraces; the front terrace, entrance approach and facade ladder stay connected.

Shape, role, height and appearance seed determine the layout. Warehouse halls are wider and lower, with a light court above the process floor; power halls can grow taller; foundries reserve a rooflight pad beside the extraction equipment. Modules and stock never reroll the hall. Equipment still changes the existing domain capacities, output, storage and emissions rules.

The generator uses the same adjacency propagation and core reachability as the Atlas lab with different pinned cells. Each roof attachment is validated against actual contact area across the underlying stacks. A conservative bounding envelope alone is no longer sufficient proof of roof support. No generated stack reaches into neighbouring plots or reserved ground equipment bays.

`modular-hall.ts` projects the shared floor/window/brace kit into the hall volume. It caches the static facade in two raster layers, inserting the animated right-side display at its correct depth. Windows follow activity; names remain directly on the front wall. Geometry and raster caches are reused between frames, and offscreen structures are culled. These caches do not claim production-scale performance for 2,500 buildings.

Kit version 2 deliberately updates appearances with glazing, clerestories, louvers, ribbed cladding, braced frames and folded daylight roofs. Facade columns keep their construction language between floors. Roles and seeds select these pieces without changing production capacities. IDs, authors, modules and inventories remain intact. Separately, the exact origin founding station moves onto a free plot; see `streets.md`. Workshop seed controls reproduce the same layout in preview, ghost, placement and reload.

## Silhouette families (kit version 3)

`assembly/building-form.ts` owns the hall proportions and adjacent equipment aisle. The existing saved `block`, `stepped` and `tower` values now select **Wide hall**, **Terraces** and **Slender tower**. Buildings without a saved shape use a deterministic seed split across all three. Each still occupies one plot; this is not multi-tile construction.

- Wide halls use the broadest footprint and a lower process enclosure, leaving a continuous rear roof.
- Terraces have an intermediate footprint, a connected middle service terrace and an offset lower landing. The stair core connects the occupied storeys; daylight and solar mounts retain their flat reserved pads.
- Towers have a narrower process podium and a concentrated upper core. The electrical deck stays low beside the tower instead of forcing a tall slab across the entire rear wall. Sharp vertical setbacks are intentional; floor reachability remains required.

Equipment bays move with the hall edge, and pipes use the same wall coordinate and clear aisle. Wire endpoints read the actual rack elevation. Right-side displays use the supported rear facade height, including the lower tower deck. Machinery retrofits and inventory changes never reroll the profile.

Tests compare actual width/height ratios, concentrated tower crowns, terrace bands and service-port alignment. The 432 role/shape/height/seed checks still validate stack support and floor connectivity; all 360 module/shape combinations remain collision-checked. Pedestrian-clearance checks now cover all three shapes for every building role.

## Ownership in code

- `src/rendering/assembly/model.ts`: presentation-only parts, mounts, solid envelopes, clearances, ports, routes and validation.
- `building-form.ts`: deterministic proportions, shared architecture labels and equipment aisle coordinates.
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
