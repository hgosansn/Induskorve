# Streets and pedestrian access

`src/domain/city/streets.ts` derives a local street and walking graph from revealed terrain and occupied plots. Canvas uses the same graph to paint asphalt, sidewalks, crossings, access paths and public lamps. There is no separate random tile-walking rule.

- The existing every-fourth-row/column roads remain. A road arm exists only when its revealed, unoccupied neighbor is also a road. Junctions, corners and ends therefore have matching curbs; saved buildings on road coordinates are preserved and cap neighboring roads, except the exact founding-station correction described below. New buildings cannot occupy road corridors; the ghost and domain command enforce the same rule.
- Sidewalks run along each side of the asphalt. Pedestrians change sides at marked zebra crossings at junctions, turns and ends, never in the middle of a straight road.
- Occupied plots have flat perimeter access and a stopping bay in front of the hall. Adjacent plots connect so interior buildings can be reached. Pedestrians can pause there; named citizens spawn on their own plot when available and periodically choose an owned plot as a destination.
- Routes never jump between disconnected components. Construction invalidates removed paths and moves affected walkers to the nearest remaining path node. Ambient walkers and local named citizens remain distinct; this is not authoritative multiplayer navigation.
- Lamp posts stand on the sidewalk and cast visible warm ground pools. Fixtures and light pools are cached. They are ambient public lighting, not simulated power consumers, and do not perform dynamic shadow occlusion.

Topology is reused across production and appearance changes. Route searches happen when choosing destinations, not on every animation frame. Motion uses the existing bounded Canvas loop and pauses when the canvas is hidden or covered. Reduced motion leaves pedestrians stationary.

The geometry contract reserves the outside margin of each 12-unit plot plus the front approach. Tests check paths against all building families with fitted ground equipment, routes across crossings, plot access, waiting, placement invalidation and cache reuse. Any new machinery floorplan must retain these access clearances or update the shared routing contract.

## Founding intersection repair

The old unowned founding power station (ID 0, origin, appearance height 85 and seed 0.6) occupied the intersection. New cities place it on the nearest empty revealed non-road plot. Loading an old city applies the same deterministic correction in memory; the next normal city action persists it. No records are deleted, IDs/equipment/appearance remain intact, occupied plots are skipped, and player-authored or differently configured structures are not relocated. Reopening a city does not repeatedly move the station.
