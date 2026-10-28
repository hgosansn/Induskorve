import type { BuildingDraft } from '../../domain/city/model';
import { createArtwork } from './artwork.js';
import { advanceWalkers, syncWalkers } from './pedestrians';
import { projectWorld, projectPlacement, type RenderFrame } from './view-model';
import {
  tileKey,
  type NetworkLayer,
  type Position,
  type Tool,
  type WorldSnapshot,
} from '../../domain/city/model';

export interface SceneState {
  draft?: BuildingDraft;
  world: WorldSnapshot;
  citizenId: string | null;
  tool: Tool;
  layer: NetworkLayer;
  grid: boolean;
  selectedId: number | null;
}
export interface SceneEvents {
  select(id: number | null): void;
  place(position: Position): void;
  cancel(): void;
}
export interface CityScene {
  update(state: SceneState): void;
  zoom(direction: 1 | -1): void;
  home(): void;
  findCitizen(): void;
  dispose(): void;
}
export function createCityScene(
  canvas: HTMLCanvasElement,
  initial: SceneState,
  events: SceneEvents,
): CityScene {
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D is unavailable in this browser.');
  const artwork = createArtwork(context);
  const controller = new AbortController();
  const signal = controller.signal;
  let source = initial;
  let frame: RenderFrame = {
    ...projectWorld(initial.world),
    W: 0,
    H: 0,
    dpr: 1,
    zoom: 1,
    panX: 0,
    panY: 0,
    clock: 0,
    mode: initial.tool,
    grid: initial.grid,
    hover: null,
    selected: null,
    citizen: null,
    layer: initial.layer,
    walkers: [],
  };
  let drag: { x: number; y: number; px: number; py: number } | null = null;
  let moved = false;
  let raf = 0;
  let last = 0;
  let disposed = false;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const iso = (x: number, y: number) => [(x - y) * 27, (x + y) * 13.5] as const;
  const coordinates = (e: PointerEvent) => {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };
  const unproject = (x: number, y: number): Position => {
    const a = (x - frame.W * 0.53 - frame.panX) / frame.zoom / 27,
      b = (y - frame.H * 0.53 - frame.panY) / frame.zoom / 13.5;
    return { x: Math.floor((a + b) / 2), y: Math.floor((b - a) / 2) };
  };
  const hit = (x: number, y: number) =>
    [...frame.buildings.values()]
      .sort((a, b) => b.x + b.y - a.x - a.y)
      .find((b) => {
        const p = iso(b.x + 0.5, b.y + 0.5),
          sx = frame.W * 0.53 + frame.panX + p[0] * frame.zoom,
          sy = frame.H * 0.53 + frame.panY + p[1] * frame.zoom;
        return (
          Math.abs(x - sx) < 22 * frame.zoom &&
          y < sy + 5 * frame.zoom &&
          y > sy - b.h * frame.zoom - 8 * frame.zoom
        );
      });
  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    frame.W = rect.width;
    frame.H = rect.height;
    frame.dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(frame.W * frame.dpr);
    canvas.height = Math.round(frame.H * frame.dpr);
  };
  const home = () => {
    frame.panX = frame.panY = 0;
    frame.zoom = Math.max(
      0.35,
      Math.min(3.5, Math.min(frame.W / 1100, frame.H / 750) * 1.1),
    );
  };
  const update = (state: SceneState) => {
    if (source.world !== state.world) {
      frame = { ...frame, ...projectWorld(state.world) };
      artwork.clearCaches();
    }
    frame.walkers = syncWalkers(frame.walkers, state.world.citizens, frame);
    frame.citizen =
      state.world.citizens.find((c) => c.id === state.citizenId) ?? null;
    frame.selected =
      [...frame.buildings.values()].find((b) => b.id === state.selectedId) ??
      null;
    frame.draft = state.draft;
    frame.mode = state.tool;
    frame.grid = state.grid;
    frame.layer = state.layer;
    canvas.style.cursor = state.tool === 'inspect' ? 'grab' : 'crosshair';
    source = state;
  };
  canvas.addEventListener(
    'pointerdown',
    (e) => {
      if (e.button !== 0) {
        events.cancel();
        return;
      }
      canvas.setPointerCapture(e.pointerId);
      const p = coordinates(e);
      drag = { ...p, px: frame.panX, py: frame.panY };
      moved = false;
    },
    { signal },
  );
  canvas.addEventListener(
    'pointermove',
    (e) => {
      const p = coordinates(e);
      frame.hover = unproject(p.x, p.y);
      if (drag) {
        const dx = p.x - drag.x,
          dy = p.y - drag.y;
        if (Math.hypot(dx, dy) > 4) moved = true;
        frame.panX = drag.px + dx;
        frame.panY = drag.py + dy;
      }
    },
    { signal },
  );
  canvas.addEventListener(
    'pointerup',
    (e) => {
      if (e.button === 0 && drag && !moved) {
        const p = coordinates(e),
          tile = unproject(p.x, p.y);
        if (frame.mode === 'inspect')
          events.select(
            hit(p.x, p.y)?.id ??
              frame.buildings.get(tileKey(tile.x, tile.y))?.id ??
              null,
          );
        else if (frame.citizen) events.place(tile);
      }
      drag = null;
    },
    { signal },
  );
  canvas.addEventListener(
    'pointerleave',
    () => {
      frame.hover = null;
    },
    { signal },
  );
  canvas.addEventListener(
    'pointercancel',
    () => {
      drag = null;
    },
    { signal },
  );
  canvas.addEventListener(
    'lostpointercapture',
    () => {
      drag = null;
    },
    { signal },
  );
  canvas.addEventListener(
    'contextmenu',
    (e) => {
      e.preventDefault();
      drag = null;
      frame.hover = null;
      events.cancel();
    },
    { signal },
  );
  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      frame.zoom = Math.max(
        0.35,
        Math.min(3.5, frame.zoom * Math.exp(-e.deltaY * 0.001)),
      );
    },
    { passive: false, signal },
  );
  window.addEventListener(
    'keydown',
    (e) => {
      if (e.key === 'Escape') {
        drag = null;
        frame.hover = null;
        events.cancel();
      }
    },
    { signal },
  );
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  resize();
  home();
  update(initial);
  let previewWorld: WorldSnapshot | undefined;
  let previewDraft: BuildingDraft | undefined;
  let previewCell = '';
  const render = (ms: number) => {
    if (disposed) return;
    const dt = Math.min(0.05, (ms - last) / 1000 || 0);
    last = ms;
    const cell =
      frame.hover && frame.mode !== 'inspect'
        ? tileKey(frame.hover.x, frame.hover.y)
        : '';
    if (
      cell !== previewCell ||
      previewWorld !== source.world ||
      previewDraft !== source.draft
    ) {
      frame.preview =
        cell && frame.hover && source.draft
          ? projectPlacement(source.world, source.draft, frame.hover)
          : undefined;
      previewCell = cell;
      previewWorld = source.world;
      previewDraft = source.draft;
    }
    if (!reduceMotion.matches) {
      frame.clock = ms / 1000;
      advanceWalkers(frame.walkers, frame, dt);
    }
    artwork.draw(frame);
    raf = requestAnimationFrame(render);
  };
  const visibility = () => {
    cancelAnimationFrame(raf);
    if (!document.hidden) {
      last = 0;
      raf = requestAnimationFrame(render);
    }
  };
  document.addEventListener('visibilitychange', visibility, { signal });
  raf = requestAnimationFrame(render);
  return {
    update,
    home,
    zoom(direction) {
      frame.zoom = Math.max(
        0.35,
        Math.min(3.5, frame.zoom * (direction === 1 ? 1.2 : 1 / 1.2)),
      );
    },
    findCitizen() {
      const w = frame.walkers.find((w) => w.person?.id === source.citizenId);
      if (w) {
        const p = iso(w.x, w.y);
        frame.zoom = 2.5;
        frame.panX = -p[0] * frame.zoom;
        frame.panY = -p[1] * frame.zoom;
      }
    },
    dispose() {
      disposed = true;
      controller.abort();
      observer.disconnect();
      cancelAnimationFrame(raf);
      artwork.dispose();
    },
  };
}
