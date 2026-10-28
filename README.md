# Induskorve

An isometric industrial city with interdependent infrastructure. The current app is a **browser-local prototype** with a production-oriented frontend foundation. Authentication and shared multiplayer are not implemented yet.

## Develop

Use Node.js 24 LTS (`.nvmrc`) and npm.

```sh
npm ci
npm run dev
```

```sh
npm run check       # lint, frontend/server types, domain tests, formatting
npm run build       # production bundle in dist/
npm run preview
npx playwright install chromium
npm run test:e2e
```

## Structure

```text
src/
  app/                      # Theme and application-level error handling
  application/              # Commands, Zustand store, repository/live ports
  domain/city/              # Validated entities, catalog, networks, terrain
  features/city/            # React compositions for city interactions
  components/ui/            # Official shadcn/ui primitives
  infrastructure/
    persistence/            # Versioned browser saves and migration
    spacetimedb/            # Validated wire contracts and lossless live IDs
  rendering/canvas/         # Scene, projection, pedestrians, procedural artwork
  lib/                      # Shared shadcn utilities
spacetimedb/src/             # Isolated, typechecked server schema
public/                     # Static files
tests/                     # Domain and browser tests
docs/                      # Architecture, deployment and integration guides
.github/workflows/          # Quality checks and Pages deployment
```

React 19 handles the UI; Canvas 2D preserves the approved artwork. Tailwind 4, shadcn/ui and Radix provide styling and accessible controls. Motion uses LazyMotion and respects reduced motion. Zod validates saves/transport; Zustand handles changes outside the frame loop. See [architecture](docs/architecture.md).

## GitHub Pages

The workflow builds/uploads `dist/` on pushes to `main`. Relative asset URLs support `/Induskorve/` and custom domains. Select **GitHub Actions** in **Settings → Pages** once; initial activation needs admin access. See [deployment](docs/deployment.md).

## Saves

Existing `onecity-v2` cities migrate to `induskorve:city:v3` on the next saved action. The old key remains intact. Entities and appearances persist separately. Invalid saves remain untouched and show a temporary-session warning. Changing hosts still changes browser storage origin.

## SpacetimeDB preparation

The isolated server workspace defines structures, appearances, citizens, presence, terrain, networks, inventory, media, events and private server state. It is typechecked against the official SDK. It has **no write reducers and is not published or connected**. See [contracts and integration steps](docs/spacetimedb.md).

## Current boundaries

- Names provide local editing convenience, not authentication. Joined local citizens may operate structures; there is no demolition action.
- Power/storage dependencies are simulated. Metal output is illustrative.
- Ambient walkers are visual agents, not real users.
- Local billboard uploads accept PNG/JPEG/WebP/GIF up to 1.5 MB. Animated GIF playback is not guaranteed by Canvas.
- The preserved artwork module is JavaScript behind a typed boundary. Other application code and the server schema use strict TypeScript.
- Public multiplayer, server operations, abuse controls and production load acceptance remain future work.
