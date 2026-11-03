import { createCanvasLoop } from './frame-loop';
import { paintPixelRain } from './pixel-rain';
import { roofHeight } from './building-layout';
import type { BuildingDraft } from '../../domain/city/model';
import { createArtwork } from './artwork.js';
import { advanceWalkers, syncWalkers } from './pedestrians';
import { readPalette } from '../palette';
import { BUILDINGS } from '../../domain/city/catalog';
import type { Walker } from './view-model';
import { projectWorld, projectPlacement, type RenderFrame } from './view-model';
import {
  tileKey,
  type NetworkLayer,
  type Position,
  type Tool,
  type WorldSnapshot,
} from '../../domain/city/model';

export interface SceneState {
  livePresence?: ReadonlyMap<string, { x: number; y: number; online: boolean }>;
  draft?: BuildingDraft;
  world: WorldSnapshot;
  citizenId: string | null;
  tool: Tool;
  layer: NetworkLayer;
  grid: boolean;
  selectedId: number | null;
  selectedPedestrian?: string | null;
}
export interface SceneEvents {
  preview?(position: Position | null): void;
  select(id: number | null): void;
  selectPedestrian?(key: string): void;
  place(position: Position): void;
  cancel(): void;
}
export interface CityScene {
  atmosphere(pixel: boolean, rain: boolean): void;
  citizenPosition(): { x: number; y: number } | null;
  update(state: SceneState): void;
  zoom(direction: 1 | -1): void;
  home(): void;
  findCitizen(): void;
  findBuilding(id: number): void;
  dispose(): void;
}
export function createCityScene(
  canvas: HTMLCanvasElement,
  initial: SceneState,
  events: SceneEvents,
): CityScene {
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D is unavailable in this browser.');
  const citySurface = document.createElement('canvas');
  const cityContext = citySurface.getContext('2d')!;
  const artwork = createArtwork(cityContext);
  let pixelStyle = true,
    rainEnabled = true;
  const palette = readPalette();
  const controller = new AbortController();
  const signal = controller.signal;
  let source = initial;
  const presencePositions = new Map<string, string>();
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
  let pedestrianPress = false;
  let pressedWalker: Walker | undefined;
  let pointer: Position | null = null;
  let hoveredWalker: Walker | undefined;
  let grabbed: {
    walker: Walker;
    x: number;
    y: number;
    pointerX: number;
    pointerY: number;
  } | null = null;
  const pedestrianKey = (w: Walker) =>
    w.person ? `citizen:${w.person.id}` : `ambient:${w.phase}`;
  let invalidate: (interactive?: boolean) => void = () => {};
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
  const groundPoint = (x: number, y: number): Position => {
    const a = (x - frame.W * 0.53 - frame.panX) / frame.zoom / 27,
      b = (y - frame.H * 0.53 - frame.panY) / frame.zoom / 13.5;
    return { x: (a + b) / 2, y: (b - a) / 2 };
  };
  const screenPoint = (p: Position) => {
    const at = iso(p.x, p.y);
    return {
      x: frame.W * 0.53 + frame.panX + at[0] * frame.zoom,
      y: frame.H * 0.53 + frame.panY + at[1] * frame.zoom,
    };
  };
  const frontBuilding = (x: number, y: number) =>
    [...frame.buildings.values()]
      .sort((a, b) => b.x + b.y - a.x - a.y)
      .find((b) => {
        const p = iso(b.x + 0.5, b.y + 0.5),
          sx = frame.W * 0.53 + frame.panX + p[0] * frame.zoom,
          sy = frame.H * 0.53 + frame.panY + p[1] * frame.zoom;
        return (
          Math.abs(x - sx) < 22 * frame.zoom &&
          y < sy + 5 * frame.zoom &&
          y > sy - Math.max(b.h, roofHeight(b)) * frame.zoom - 8 * frame.zoom
        );
      });
  const hit = (x: number, y: number) => {
    const tile = unproject(x, y);
    return frame.buildings.get(tileKey(tile.x, tile.y));
  };
  const refreshHover = () => {
    const building =
      pointer && frame.mode === 'inspect' && !drag && !grabbed
        ? hit(pointer.x, pointer.y)
        : undefined;
    const occluder =
      pointer && frame.mode === 'inspect' && !drag && !grabbed
        ? frontBuilding(pointer.x, pointer.y)
        : undefined;
    hoveredWalker =
      pointer && frame.mode === 'inspect' && !drag && !grabbed
        ? [...frame.walkers]
            .sort((a, b) => {
              const at = screenPoint(a),
                bt = screenPoint(b);
              const distance =
                Math.hypot(
                  pointer!.x - at.x,
                  pointer!.y - at.y + 4 * frame.zoom,
                ) -
                Math.hypot(
                  pointer!.x - bt.x,
                  pointer!.y - bt.y + 4 * frame.zoom,
                );
              if (Math.abs(distance) > 3) return distance;
              return (
                Number(
                  !!source.citizenId && b.person?.id === source.citizenId,
                ) -
                  Number(
                    !!source.citizenId && a.person?.id === source.citizenId,
                  ) || b.x + b.y - a.x - a.y
              );
            })
            .find((w) => {
              const p = screenPoint(w);
              // Respect the same building/person depth ordering as the artwork.
              if (occluder && occluder.x + occluder.y + 1 > w.x + w.y)
                return false;
              return (
                Math.abs(pointer!.x - p.x) < Math.max(14, 5.5 * frame.zoom) &&
                pointer!.y >= p.y - Math.max(22, 12 * frame.zoom) &&
                pointer!.y <= p.y + Math.max(8, 4 * frame.zoom)
              );
            })
        : undefined;
    frame.hoveredBuilding = hoveredWalker ? null : building;
    for (const w of frame.walkers)
      w.held = w === hoveredWalker || w === grabbed?.walker;
    canvas.style.cursor =
      grabbed || drag
        ? 'grabbing'
        : frame.mode !== 'inspect'
          ? 'crosshair'
          : hoveredWalker
            ? 'pointer'
            : building
              ? 'pointer'
              : 'grab';
    const info = hoveredWalker
      ? `${hoveredWalker.person?.name ?? 'Ambient pedestrian'} · ${hoveredWalker.person ? 'Citizen' : 'Local ambient walker'}${hoveredWalker.person?.id === source.citizenId ? ' · You · Drag to move' : ''}`
      : building
        ? `${BUILDINGS[building.type].label}${building.creator ? ` · ${building.creator}` : ''}`
        : '';
    canvas.setAttribute('aria-description', info);
    canvas.dataset.hoverKind = hoveredWalker
      ? 'pedestrian'
      : building
        ? 'building'
        : '';
  };
  const cancelGrab = () => {
    if (grabbed)
      Object.assign(grabbed.walker, {
        x: grabbed.x,
        y: grabbed.y,
        held: false,
      });
    grabbed = null;
  };
  const dropNode = (p: Position) => {
    let nearest: ReturnType<typeof frame.streets.nodes.get>;
    let distance = 0.8;
    for (const node of frame.streets.nodes.values()) {
      const d = Math.hypot(node.x - p.x, node.y - p.y);
      if (d < distance) {
        nearest = node;
        distance = d;
      }
    }
    return nearest;
  };
  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    frame.W = rect.width;
    frame.H = rect.height;
    frame.dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(frame.W * frame.dpr);
    canvas.height = Math.round(frame.H * frame.dpr);
    invalidate();
  };
  const home = () => {
    invalidate();
    frame.panX = frame.panY = 0;
    frame.zoom = Math.max(
      0.35,
      Math.min(3.5, Math.min(frame.W / 1100, frame.H / 750) * 1.1),
    );
  };
  const update = (state: SceneState) => {
    if (source.world !== state.world) {
      frame = { ...frame, ...projectWorld(state.world, frame) };
      if (source.world.appearances !== state.world.appearances)
        artwork.clearCaches();
    }
    const people = state.livePresence
      ? state.world.citizens.filter(
          (c) =>
            state.livePresence!.get(c.id)?.online || c.id === state.citizenId,
        )
      : state.world.citizens;
    frame.walkers = syncWalkers(frame.walkers, people, frame);
    if (state.livePresence)
      for (const walker of frame.walkers) {
        const id = walker.person?.id;
        if (!id) continue;
        const position = state.livePresence.get(id);
        if (!position) continue;
        const key = `${position.x},${position.y}`,
          first = !presencePositions.has(id);
        if (
          presencePositions.get(id) !== key &&
          (id !== state.citizenId || first)
        ) {
          walker.x = walker.tx = position.x;
          walker.y = walker.ty = position.y;
          walker.route = [];
          walker.node = undefined;
          walker.target = undefined;
        }
        presencePositions.set(id, key);
      }
    frame.citizen =
      state.world.citizens.find((c) => c.id === state.citizenId) ?? null;
    frame.selected =
      [...frame.buildings.values()].find((b) => b.id === state.selectedId) ??
      null;
    frame.draft = state.draft;
    frame.mode = state.tool;
    frame.grid = state.grid;
    frame.layer = state.layer;
    source = state;
    if (
      grabbed &&
      (frame.mode !== 'inspect' ||
        grabbed.walker.person?.id !== source.citizenId)
    )
      cancelGrab();
    refreshHover();
    invalidate();
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
      pointer = p;
      refreshHover();
      pedestrianPress = !!hoveredWalker;
      pressedWalker = hoveredWalker;
      moved = false;
      if (
        frame.mode === 'inspect' &&
        hoveredWalker?.person?.id === source.citizenId &&
        frame.citizen
      ) {
        grabbed = {
          walker: hoveredWalker,
          x: hoveredWalker.x,
          y: hoveredWalker.y,
          pointerX: p.x,
          pointerY: p.y,
        };
        refreshHover();
        invalidate(true);
        return;
      }
      drag = { ...p, px: frame.panX, py: frame.panY };
      moved = false;
    },
    { signal },
  );
  canvas.addEventListener(
    'pointermove',
    (e) => {
      const p = coordinates(e);
      pointer = p;
      frame.hover = unproject(p.x, p.y);
      if (grabbed) {
        if (Math.hypot(p.x - grabbed.pointerX, p.y - grabbed.pointerY) > 4)
          moved = true;
        if (moved) Object.assign(grabbed.walker, groundPoint(p.x, p.y));
      }
      invalidate(true);
      if (drag) {
        const dx = p.x - drag.x,
          dy = p.y - drag.y;
        if (Math.hypot(dx, dy) > 4) moved = true;
        frame.panX = drag.px + dx;
        frame.panY = drag.py + dy;
      }
      refreshHover();
    },
    { signal },
  );
  canvas.addEventListener(
    'pointerup',
    (e) => {
      if (grabbed) {
        if (!moved) {
          const w = grabbed.walker;
          cancelGrab();
          events.selectPedestrian?.(pedestrianKey(w));
          refreshHover();
          invalidate();
          return;
        }
        const w = grabbed.walker,
          node = dropNode(w);
        if (node)
          Object.assign(w, {
            x: node.x,
            y: node.y,
            tx: node.x,
            ty: node.y,
            node: node.id,
            target: undefined,
            route: [],
            wait: 3,
            strollTime: 0,
            moving: false,
            held: false,
          });
        else Object.assign(w, { x: grabbed.x, y: grabbed.y, held: false });
        grabbed = null;
        if (canvas.hasPointerCapture(e.pointerId))
          canvas.releasePointerCapture(e.pointerId);
        refreshHover();
        invalidate();
        return;
      }
      if (e.button === 0 && drag && !moved) {
        const p = coordinates(e),
          tile = unproject(p.x, p.y);
        if (frame.mode === 'inspect') {
          if (pedestrianPress && pressedWalker)
            events.selectPedestrian?.(pedestrianKey(pressedWalker));
          else
            events.select(
              hit(p.x, p.y)?.id ??
                frame.buildings.get(tileKey(tile.x, tile.y))?.id ??
                null,
            );
        } else if (frame.citizen) events.place(tile);
      }
      drag = null;
      refreshHover();
      invalidate();
    },
    { signal },
  );
  canvas.addEventListener(
    'pointerleave',
    () => {
      frame.hover = null;
      pointer = null;
      refreshHover();
      invalidate();
    },
    { signal },
  );
  canvas.addEventListener(
    'pointercancel',
    () => {
      drag = null;
      cancelGrab();
      refreshHover();
      invalidate();
    },
    { signal },
  );
  canvas.addEventListener(
    'lostpointercapture',
    () => {
      drag = null;
      cancelGrab();
      refreshHover();
      invalidate();
    },
    { signal },
  );
  canvas.addEventListener(
    'contextmenu',
    (e) => {
      e.preventDefault();
      cancelGrab();
      drag = null;
      frame.hover = null;
      refreshHover();
      invalidate();
      events.cancel();
    },
    { signal },
  );
  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      invalidate(true);
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
        cancelGrab();
        drag = null;
        frame.hover = null;
        pointer = null;
        refreshHover();
        invalidate();
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
    if (disposed || frame.W <= 0 || frame.H <= 0) return;
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
      events.preview?.(cell && frame.hover ? { ...frame.hover } : null);
    }
    if (!reduceMotion.matches) {
      frame.clock = ms / 1000;
      advanceWalkers(frame.walkers, frame, dt);
    }
    refreshHover();
    const renderDpr = pixelStyle ? 0.5 : frame.dpr;
    const width = Math.ceil(frame.W * renderDpr),
      height = Math.ceil(frame.H * renderDpr);
    if (citySurface.width !== width || citySurface.height !== height) {
      citySurface.width = width;
      citySurface.height = height;
    }
    const paintedFrame = { ...frame, dpr: renderDpr };
    artwork.draw(paintedFrame);
    if (rainEnabled)
      paintPixelRain(
        cityContext,
        paintedFrame,
        palette,
        reduceMotion.matches ? 0 : frame.clock,
      );
    context.setTransform(frame.dpr, 0, 0, frame.dpr, 0, 0);
    context.fillStyle = palette.background;
    context.fillRect(0, 0, frame.W, frame.H);
    context.imageSmoothingEnabled = false;
    context.drawImage(citySurface, 0, 0, frame.W, frame.H);
    context.save();
    context.setTransform(frame.dpr, 0, 0, frame.dpr, 0, 0);
    for (const w of frame.walkers) {
      const own = !!frame.citizen && w.person?.id === frame.citizen.id;
      if (
        !own &&
        w !== hoveredWalker &&
        pedestrianKey(w) !== source.selectedPedestrian
      )
        continue;
      const p = screenPoint(w);
      context.strokeStyle =
        grabbed?.walker === w && !dropNode(w)
          ? palette.danger
          : own
            ? palette.materials
            : palette.foreground;
      context.lineWidth = own ? 2 : 1.5;
      context.beginPath();
      context.ellipse(
        p.x,
        p.y,
        Math.max(7, 4 * frame.zoom),
        Math.max(3, 2 * frame.zoom),
        0,
        0,
        Math.PI * 2,
      );
      context.stroke();
    }
    const text = grabbed
      ? dropNode(grabbed.walker)
        ? 'Drop on this path'
        : 'Move closer to a sidewalk or entrance'
      : canvas.getAttribute('aria-description');
    if (text && pointer) {
      context.font = '12px monospace';
      const width = Math.min(
        frame.W - 16,
        context.measureText(text).width + 20,
      );
      const x = Math.max(8, Math.min(frame.W - width - 8, pointer.x + 14));
      const y = Math.max(8, Math.min(frame.H - 34, pointer.y + 18));
      context.fillStyle = palette.card;
      context.fillRect(x, y, width, 28);
      context.strokeStyle = palette.edge;
      context.strokeRect(x, y, width, 28);
      context.fillStyle = palette.foreground;
      context.textAlign = 'left';
      context.textBaseline = 'middle';
      context.fillText(text, x + 10, y + 14, width - 20);
    }
    context.restore();
  };
  const loop = createCanvasLoop(canvas, render, () => !reduceMotion.matches);
  invalidate = loop.invalidate;
  reduceMotion.addEventListener('change', () => invalidate(), { signal });
  return {
    atmosphere(pixel, rain) {
      pixelStyle = pixel;
      rainEnabled = rain;
      invalidate();
    },
    citizenPosition() {
      const person = frame.walkers.find(
        (w) => w.person?.id === source.citizenId,
      );
      return person ? { x: person.x, y: person.y } : null;
    },
    update,
    home,
    zoom(direction) {
      invalidate(true);
      frame.zoom = Math.max(
        0.35,
        Math.min(3.5, frame.zoom * (direction === 1 ? 1.2 : 1 / 1.2)),
      );
    },
    findCitizen() {
      invalidate(true);
      const w = frame.walkers.find((w) => w.person?.id === source.citizenId);
      if (w) {
        const p = iso(w.x, w.y);
        frame.zoom = 2.5;
        frame.panX = -p[0] * frame.zoom;
        frame.panY = -p[1] * frame.zoom;
      }
    },
    findBuilding(id) {
      const b = source.world.buildings.find((b) => b.id === id);
      if (!b) return;
      invalidate(true);
      const p = iso(b.x, b.y);
      frame.zoom = 1.8;
      frame.panX = -p[0] * frame.zoom - frame.W * 0.12;
      frame.panY = -p[1] * frame.zoom;
    },
    dispose() {
      disposed = true;
      controller.abort();
      observer.disconnect();
      loop.dispose();
      artwork.dispose();
    },
  };
}
