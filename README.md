# Induskorve

An isometric industrial city visual prototype. Built with browser-native Canvas 2D and JavaScript; no dependencies or build step.

## Run locally

```sh
python3 -m http.server 8000 --directory docs
```

Open http://localhost:8000.

## GitHub Pages

The Pages workflow deploys `docs/` on every push to `main`. In **Settings → Pages**, use **GitHub Actions** as the source.

## Prototype features

- Procedural industrial buildings with animated wall adverts
- Power cables anchored to rooftop insulators and arcing wireless traffic
- Local power capacity, storage dependencies, and network filters
- Circular terrain reveal around each building
- Citizen pedestrians, pan/zoom, and building placement
- Right-click or Escape to cancel placement

Identity, city edits, and custom adverts are saved in browser local storage. There is no shared multiplayer backend or production authentication yet. The join flow is a local prototype identity only.

Moving to a new hostname starts a new local city; browser data does not transfer from the original prototype URL.
