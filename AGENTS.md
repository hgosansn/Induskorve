# Induskorve — agent handover

Updated: 2026-10-28. This file captures the product direction and decisions from the founding conversation. Read it before changing the experience. Distinguish implemented prototype behavior from proposed future simulation rules.

## Current engineering foundation (2026-10-28)

This section supersedes historical implementation/layout/run instructions below. Product and art decisions remain applicable.

- React 19, Vite, strict TypeScript, Tailwind 4, official shadcn/ui primitives, Radix, Motion, Zod and Zustand form the frontend foundation.
- Source now lives under `src/`, separated into domain, application, features, infrastructure and Canvas rendering. See README and `docs/architecture.md`.
- `docs/index.html` was replaced by the built app. Use Node 24, `npm ci`, `npm run dev`; builds go to `dist/`.
- Preserve saves: `onecity-v2` migrates to namespaced version 3 without deletion. Invalid saved data must not be overwritten by a fresh city.
- Verification: `npm run check`, `npm run build`, `npm run test:e2e`. Pages deploys dist on main. Pages activation and effective protections remain external settings to verify separately.
- `spacetimedb/src/index.ts` is a typechecked schema workspace only; no reducers, published database or live multiplayer. See `docs/spacetimedb.md`.
- Generic controls come from shadcn/ui. Do not create a parallel design system.
- Artwork remains isolated JS behind `artwork.d.ts`; other application code uses TypeScript. Do not claim full artwork type coverage or production readiness.

## Product identity and goal

- Product name: **Induskorve** (user originally wrote “IndusKorve”; current repository and prototype use Induskorve).
- Repository: https://github.com/hgosansn/Induskorve
- Original working concept: **ONE CITY, EVERYONE**.
- The emotional core is **leaving a lasting mark online**: a visitor's contribution becomes part of a persistent industrial city collectively built and operated by strangers.
- It is a living internet artifact and social experiment, not a conventional city-builder with individual private worlds.
- One shared city, one interconnected economy, no central planner. Meaningful dependencies should create cooperation without requiring chat.
- Initial priority was validating the aesthetic. The user likes the foundation; preserve it while developing the actual systems.
- Previous naming alternatives are superseded; do not restart naming exploration.

## Non-negotiable experience direction

1. One webpage with a seamless city canvas, smooth pan and zoom, no separate rooms, levels, or sector loading screens.
2. Fixed isometric / 2.5D presentation. A logical square ground grid supports buildings that appear three-dimensional. Sprites are an acceptable initial asset approach; the current prototype instead draws procedural geometry in Canvas 2D. Full 3D is not required.
3. Start in a quiet **display / spectator mode**. Remove marketing copy and keep UI minimal.
4. A deliberate **Join city / identify yourself** step unlocks editing and gives the person a small pedestrian in the city.
5. The desired finished version needs actual identity and authoritative permissions. The current name form is only a browser-local interaction prototype, not authentication.
6. Left click places a building in build mode. **Right click or Escape cancels placement**, without placing anything or opening the context menu over the canvas.
7. Preserve drag-to-pan and scroll-to-zoom. Spectators may inspect structures but cannot mutate them through the UI.
8. Every person who interacts should eventually have their own little character walking through the shared city. Current ambient walkers are explicitly separate from named citizens.
9. Buildings should retain creator attribution. Long term: everyone can connect infrastructure, contribute and repair; do not allow unrestricted demolition of others' work.

## World expansion — important correction

The user explicitly replaced global circular expansion:

- Each placed building reveals its own **small circular area of available ground**.
- The world's terrain is the **union of those local disks**.
- Building toward one edge must NOT reveal an entire larger circle around the origin.
- New construction starts on revealed, empty ground and reveals nearby ground after placement.
- The resulting city grows organically and irregularly outward from the founding core.
- Chunking, bounds and frontier rules can evolve, but preserve this local reveal behavior.

## Art direction

Industrial, dense, interconnected, mechanical, slightly hostile. Heavy factories, steel, chimneys, pipes, rails, cables, utility infrastructure and warm furnace light. Charcoal / muted green / olive steel palette with restrained cyberpunk accents. Avoid turning the scene into a bright generic city-building game.

The user wants procedural variety that makes architectural sense:

- Different heights, footprints, tiered masses, roof equipment and chimney configurations.
- Balconies, service platforms, ladders, antennas, sheds, vents and small industrial details.
- Uneven window illumination: not all lights on and not identical patterns.
- Deterministic per-building variety; do not randomize the building's appearance each frame.
- Animation should increasingly reflect real state: working machinery, smoke, outage darkness, repairs and damage.

### Advertising and building lettering

Specific user decisions:

- **Front facades:** small names / lettering directly on the wall, not text inside little boxed panels.
- **Right-hand side walls:** large LED adverts spanning most of the broad facade.
- Animated, distinct adverts for different buildings; images and GIFs are part of the desired direction.
- Current implementation uses procedural animated graphics with waves, orbit patterns, geometric designs, scanlines and fictional industrial brands.
- A local image/GIF upload picker and reset-to-procedural option exist in the inspector after joining. File limit is 1.5 MB. Verify actual animated GIF playback before promising it works; acceptance as an image file is not proof of animation in a canvas.
- Adverts dim with building activity/power. Preserve the right-side placement.
- Do not introduce real brand assets or paid advertising infrastructure without a new request.

## Color and connection language

The city should visually communicate dependencies rather than merely decorate buildings.

- **Yellow:** electricity / power stations and electrical connections.
- **Blue:** storage / material links. The user has also called these “data” or “data flow”; current simulation calls them materials. Their final semantic role is still open. Do not quietly claim that wireless dots physically transport bulk metal.
- **Copper / warm orange:** production / foundries.
- Color accents identify building purpose; retain the muted architectural palette underneath.
- Network filters allow all networks, power only, materials only, or buildings without connections.
- Selecting a building highlights its links and shows requirements/capacity.

### Latest cable feedback — preserve this

- The user likes the tangled yellow wiring, but connections must attach to meaningful physical hardware.
- Yellow cables now attach to rooftop masts with crossbars and insulators, using continuous sagging curves.
- **Do not restore circular endpoint bubbles, glowing attachment circles or pulsing missing-port rings.**
- **Do not restore angular, flat, right-angle blue cable routes.**
- Blue flow is now small moving dots following an **upward airborne arc**, visually the inverse of hanging electrical cables. No continuous blue cable.
- Inactive power wires remain physical wires, dimmed rather than disappearing.
- Missing dependencies can be explained through inspection/status without endpoint bubbles.

## Current implementation and repository layout

- `docs/index.html`: complete static prototype; inline styles and JavaScript, browser-native Canvas 2D.
- No dependencies, framework, bundler or build step currently.
- `docs/.nojekyll`: static Pages hosting.
- `.github/workflows/pages.yml`: automatic Pages deployment on push to main and manual dispatch.
- `.github/CODEOWNERS`: all files owned by @hgosansn.
- `README.md`: local serving and prototype scope.
- This root file is the handover; future agents should keep it accurate.

Run:

```sh
python3 -m http.server 8000 --directory docs
```

Then visit http://localhost:8000.

Key implementation concepts/functions:

- `buildings` and `terrain` maps; `reveal` unions per-building disks.
- `variation` gives deterministic building variation.
- `rebuildNetworks`, `net`, `links`, `networkDirty` calculate local services after changes.
- `attachment` and `port` share hardware coordinates with cable endpoints.
- `drawConnections` renders hanging power wires and airborne dot streams.
- `drawAdvert` caches small offscreen canvases, updating procedural adverts at about 12 fps.
- `buildingIdentity` renders purpose accents and roof connection hardware.
- `setMode` / `cancel` manage editing; retain both Escape and right-click.
- `persist` saves buildings, custom art and citizens to browser storage.
- Current local-storage keys include `onecity-v2` and `onecity-name`. Preserve existing saved cities when refactoring, or supply a migration.

### Current service model (prototype parameters, not final balancing)

- Power stations serve nearby buildings within 4.5 tiles, capacity 80 units.
- Foundry demand: 12 units; warehouse demand: 6 units.
- Foundries need a powered warehouse within 3.5 tiles.
- Each warehouse serves up to 8 foundries.
- Links form automatically using nearby eligible sources and capacity.
- Pausing a plant affects dependent warehouses/foundries; missing powered storage stops foundries.
- Displayed metal output (12/cycle) is illustrative, not a persistent resource economy.
- All simulation, identities, pedestrians and edits are local to one browser. There is no SpacetimeDB module or shared state yet.
- New hostnames start with a separate browser-local city. The original hosted prototype's saved edits will not automatically appear on GitHub Pages.
- No hidden online-player claims: ambient population is not real users.

## Intended multiplayer and simulation architecture

The user explicitly chose **SpacetimeDB** for the eventual live shared world. React + PixiJS was proposed for the frontend; it is a future option, not an implemented or mandatory migration. Preserve the working visual direction when modularizing.

Proposed industrial chain:

- Mine produces ore and fuel.
- Power station consumes fuel and supplies electricity.
- Foundry consumes ore and electricity and produces metal.
- Warehouse stores/distributes resources.
- Substation extends the electrical network.
- Conveyors connect material networks.
- Construction spends materials from a connected stockpile.

Proposed MVP choices, still to validate:

- Begin with network-level resource pools, not server-simulated individual items.
- A public bootstrap power source and starter stockpile prevent circular startup deadlocks.
- Immediate placements/topology updates; roughly 10-second production ticks; slower maintenance; smooth local visual animation.
- Cache network components and recompute affected topology after changes, not the full world each tick.
- Authoritative reducers validate identity, coordinates, occupancy, costs, action allowance and permissions. Concurrent placements must not overlap.
- Spatial chunks / viewport subscriptions plus lightweight global summary for scaling.
- Earlier suggestions of a fixed 128×128 world, action cooldowns and six building types were planning baselines, not approved hard limits. Local terrain reveal is the later, explicit world decision.
- Candidate tables: players, buildings, terrain/tiles, networks, memberships, construction, requests, world events, internal scheduled simulation state.
- Server-owned schedules/internal bookkeeping should not be public.
- Exact SDK APIs must be checked against current SpacetimeDB docs before implementation.

Social direction:

- Cooperation through power/material needs, requests, blueprints and repairs before adding global chat.
- Shareable building/location links, creator attribution, milestones and persistent event history.
- Limited actions / cooldowns and anti-spam measures for a public multiplayer launch.
- Avoid private ownership that blocks cooperation, and avoid arbitrary griefing/destruction.
- Success criterion: two strangers affect one another's structures and immediately see the result.

## GitHub Pages and security — unfinished work

User explicitly requested:

1. Public repository.
2. Automatic GitHub Pages deployment.
3. Only approved contributors may modify main and create releases.

Known state at handover:

- Public repository created by the user, source successfully imported.
- Import commit: `f8bd423ff3e4fa9676d81252f84065fb132e3e60`.
- Workflow uploads `docs/` and deploys via official Pages actions.
- Initial workflow run **40682722932** passed JavaScript validation but failed at `actions/configure-pages@v5`.
- Error: **Create Pages site failed: Resource not accessible by integration**. The workflow token could not perform initial site enablement.
- Pages activation was NOT verified complete. Inspect current settings/run state before assuming it is still blocked.
- Branch/tag/release restrictions were NOT configured by the previous agent.
- **CODEOWNERS exists but does not itself enforce reviews or restrict releases.**
- No releases have intentionally been created.

Finish in an authenticated admin environment:

```sh
gh auth status
gh api --method POST repos/hgosansn/Induskorve/pages -f build_type=workflow
gh workflow run pages.yml --repo hgosansn/Induskorve
```

Check current Pages state first; if a site already exists, update it rather than blindly POSTing. Verify a successful deployment and use the returned URL.

For repository protection:

- @hgosansn is the only explicitly identified approved maintainer so far. Do not guess additional approved people or grant access broadly.
- Inspect existing collaborators, rulesets, bypass actors, branch protection, tag protection and release workflows.
- Enforce main protection through rulesets/branch settings: pull requests, code-owner approval, block force pushes and deletion, and limit bypass privileges deliberately.
- Account for a solo owner being unable to approve their own PR; use a narrowly scoped maintainer/admin bypass if appropriate and clearly report it.
- Release permission is not controlled by CODEOWNERS. Audit write/maintain/admin access and any automation with contents:write. Restrict release-tag creation/update/deletion with supported rulesets as appropriate.
- Tag protection alone is not proof that GitHub release creation/editing is fully restricted. Verify the effective permissions and explain any platform limitation.
- Do not add a release workflow that lets unapproved users obtain a privileged write token.
- Respect any protections added since this handover; use branches/PRs when required rather than weakening them.
- Confirm actual applied settings; do not describe proposed controls as enforced.

Prior environment blockers (not architectural requirements):

- Previous sandbox lacked `gh`, CLI credentials and GitHub download network access.
- Connected GitHub tools could push files but lacked Pages/settings/ruleset operations.
- Browser was signed out; secure sign-in requests were declined.
- A new cloud sandbox may have authenticated `gh`. Check rather than repeating the old browser flow.
- Never request tokens/passwords in chat or commit credentials.

## Verification and next-agent priorities

1. Read current repository state and pending runs; do not overwrite unrelated changes.
2. Finish/verify Pages and effective contributor/release restrictions.
3. Preserve the approved appearance and latest cable/advert decisions.
4. Split the monolithic HTML only when useful for further development; keep a working static preview and simple deployment.
5. Then introduce shared SpacetimeDB persistence, identities and actual industrial production incrementally.
6. Verify two-client synchronization before claiming multiplayer support.

Existing verification:

- JavaScript parsed successfully using `new Function`.
- Browser checks covered join gating, inspection, placement, Escape/right-click cancellation and persistence after refresh.
- Local service checks covered connected chains, plant outages, missing storage, range and capacity.
- Latest roof cable/airborne-flow rendering was visually inspected.
- Production-scale performance, robust identity, shared state, real resource ticks, animated uploaded GIFs and full abuse resistance remain unverified.

For visual changes, inspect the rendered result, including a closer zoom. For simulation changes, test real dependencies and state transitions. Keep user-facing updates concise and candid about what is actually implemented.
