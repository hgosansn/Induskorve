# Homes, skyscrapers and neighborhood shops

The city now accepts six building kinds. **Homes**, **Skyscraper** and **Shops** are available through Add building and City → Design atlas. Workshop previews, placement ghosts and placed structures share the same civic assembly and renderer. Each family keeps deterministic seed, height, architecture, balcony/canopy and optional facade-display settings.

- Apartments have occupied stepped floors, inset window bays, uneven illumination, thick balcony decks and a front entrance.
- Residential skyscrapers have a glazed podium, tall occupied shaft and supported stepped crown. Their default large animated display occupies one continuous right-wall surface; it never bridges a setback. The display can be disabled.
- Small shops have recessed storefront glazing, shelves, transoms, a pedestrian doorway, optional canopy and fictional lettering directly on the frontage. Idle shops close their shutters.

These use native XYZ surfaces projected into Canvas 2D, with static back/front raster caches around the existing live advert callback. They are not new GLB meshes. The palette remains centralized. Electrical service stands on its own ground footing; civic assemblies contain no furnace, extraction route, freight bay, heat or material endpoint. Conservative assembly solids validate envelope, support and pedestrian clearances, not general mesh collision or engineering feasibility.

## Local rules and persistence

Homes consume 4 power units, skyscrapers 10 and shops 3. They do not require a warehouse, produce metal or emit industrial pollution. Their lighting reflects operating/power state. Residents, rent, customers and trade are not simulated. Existing ambient pedestrians continue to use the shared sidewalk/access graph.

The version-3 schema accepts the three additional kinds. Existing saved structures, appearances, identities and inventory are preserved; there is no automatic conversion of a saved industrial district. Only a newly generated city includes a mixed town quarter with homes, shops and screened towers. Building placement still requires joining and respects revealed terrain, road corridors and occupancy. Shared multiplayer remains unimplemented.

## Review and delivery cost

Actual-renderer review captures live in `asset-studies/civic-01/`: the original three family captures, a second depth pass in `residential-depth`, `skyscraper-depth`, `shop-depth`, and `mixed-town.png`. The second pass added window jambs/sills, balcony returns, roof edges, deeper storefronts, opaque screen hardware and shaft/podium facade detail after the first pass read too flat.

The production main JavaScript is **244,908 bytes raw**, **84,670 bytes gzip estimate**, versus 232.44 KB raw / 81.40 KB gzip estimate immediately before civic work: about **12.47 KB raw / 3.27 KB compressed** extra. Decimal KB; gzip is measured locally and is not a network transfer guarantee. There are **no additional bitmap downloads or dependencies** for civic architecture; it reuses the existing service asset and advert runtime. Authoring screenshots are excluded from production. This is a bundle-size comparison, not a claim about browser frame time or city-scale memory.

Validation includes the complete lint/type/format checks, civic assembly combinations and negative support cases, native-surface containment, cache/live-display behavior, placement and save reload, warehouse-independent power service, outages and unchanged industrial production. Browser checks exercise distinct Atlas renders, live/disabled display behavior and Atlas isolation from city storage. Visual acceptance remains subjective: this is the first civic kit, not reference-matched final art.
