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

The scrubber replaces the extraction bypass in the same bay. It does not appear as an unrelated cylinder. Extra turbines and furnaces are ground-mounted enclosed units. Solar panels sit on support rails. The balcony option is a roof service deck with a guardrail; the ladder reaches the roof whether or not the deck is fitted.

Functional references: the [EIA explanation of turbine generators](https://www.eia.gov/energyexplained/electricity/how-electricity-is-generated.php) informs the distinction between generation and cooling; [DHS basic plant components](https://cdp.dhs.gov/shared/se/courses/default/AWR-923-W%2005122021%201.2-20210512144644/groups/241.html) identifies the cooling loop's role. [HSE furnace-work guidance](https://www.hse.gov.uk/pubns/guidance/fd2.pdf) informed the visible extraction path. These are references for legible industrial function, not certification of the fictional facility.

## Facade architecture

The user's futuristic-city reference adds a second level of composition inside the hall: readable floors, recessed glazing, large service panels, setbacks and exposed structural bays. `facade.ts` derives this architecture from the existing shape, height and deterministic appearance seed.

The working floor retains its process/loading openings. Upper floors use window and panel bays with stable, uneven occupancy lighting; loss of activity extinguishes lit windows. Stepped and tower profiles recess the infill while corner columns, diagonal braces and floor outriggers support the outer roof and floor edges. A backed right-side panel hosts the existing animated advert with readable lettering. Small joints and mullions appear only at closer zoom.

Facade solids stay inside the hall's conservative reserved envelope. The envelope remains occupied for mounting/collision purposes: a visual recess is not a new equipment socket. Roof mounts, heavy-equipment bays and service-port coordinates remain unchanged. This does not introduce structural-load simulation or new gameplay floors.

The Atlas exposes architecture and facade-display controls; the workshop's existing shape choice now drives both hall setbacks and the control room. No new persisted fields are needed.

## Ownership in code

- `src/rendering/assembly/model.ts`: presentation-only parts, mounts, solid envelopes, clearances, ports, routes and validation.
- `mounts.ts`: reserved floorplans and mounting sockets, independent of fitted equipment.
- `compose.ts`: role/module/stock configuration becomes an assembly with reasons and connections.
- `draw-order.ts`: support-aware fixed-camera part ordering.
- `facade.ts`: deterministic floor, window, panel and frame layout inside the hall envelope.
- `src/rendering/canvas/buildings.ts`: draws equipment and services; `hall.ts` draws the facade architecture using the common palette.
- `building-layout.ts`: external wires and heat pipes read the same physical ports as the artwork.
- `BuildingPreview`: framing derives from the assembled bounds; city, workshop and Atlas share the same renderer.

The domain still owns capacities, production and saved module choices. It does not import geometry. No save migration is needed: assembly geometry is derived from existing records.

## Acceptance and limits

Tests cover all module subsets, all three core shapes, balcony on/off and representative heights including legacy limits (360 configurations), plus deliberately invalid collisions, support/mount failures, blocked access and broken routes. The Atlas can isolate each part and explains its role and support. Module changes must affect both the intended domain rule and its actual visible assembly.

This is a constrained procedural kit, not a general CAD or structural solver. Collision checks use conservative solid envelopes; they do not calculate mass, load, thermal performance, fluid physics or human-code compliance. Part-level painter ordering is intended for these floorplans and fixed camera; arbitrary intersecting meshes require a different renderer. City-wide cable/pipe routing still does not avoid every intervening building. The single-tile footprint, local simulation and multiplayer limitations are unchanged.

For a new asset, begin with its process diagram and floorplan. Add a bay, support, clearance and ports before drawing details. Reject a module combination that cannot fit; do not shrink or hide equipment to make the preview pass.
