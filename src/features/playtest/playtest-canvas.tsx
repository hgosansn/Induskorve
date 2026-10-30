import { useEffect, useRef } from 'react';
import {
  PLAYTEST_PLOTS,
  type PlaytestAction,
  type PlaytestState,
} from '../../domain/city/playtest';
import { createArtwork } from '../../rendering/canvas/artwork.js';
import { createCanvasLoop } from '../../rendering/canvas/frame-loop';
import {
  projectPlaytest,
  playtestDraft,
} from '../../rendering/canvas/playtest-projection';
import type {
  RenderFrame,
  RenderWorld,
} from '../../rendering/canvas/view-model';

export function PlaytestCanvas({
  world,
  action,
  onPlot,
  onCancel,
}: {
  world: PlaytestState;
  action: PlaytestAction | null;
  onPlot(plot: number): void;
  onCancel(): void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const render = useRef<RenderWorld | undefined>(undefined);
  const preview = useRef<RenderFrame['preview']>(undefined);
  const latest = useRef({ world, action, onPlot, onCancel });
  const invalidate = useRef<(() => void) | undefined>(undefined);
  useEffect(() => {
    latest.current = { world, action, onPlot, onCancel };
    render.current = projectPlaytest(world, render.current);
    preview.current = undefined;
    if (
      action?.type === 'place' &&
      !world.foundries.some((f) => f.plot === action.plot)
    ) {
      const projected = projectPlaytest({
        ...world,
        foundries: [
          ...world.foundries,
          {
            plot: action.plot,
            shape: action.shape,
            furnace: false,
            heat: false,
            creator: 0,
          },
        ],
      });
      const plot = PLAYTEST_PLOTS[action.plot]!;
      const building = projected.buildings.get(`${plot.x},${plot.y}`)!;
      preview.current = {
        building,
        service: projected.net.get(building)!,
        links: projected.links.filter(
          (l) => l.to.id === building.id || l.from.id === building.id,
        ),
      };
    }
    invalidate.current?.();
  }, [world, action, onPlot, onCancel]);
  useEffect(() => {
    const el = canvas.current!,
      ctx = el.getContext('2d');
    if (!ctx) return;
    const art = createArtwork(ctx),
      reduced = matchMedia('(prefers-reduced-motion: reduce)');
    let zoomFactor = 1,
      panX = 0,
      panY = 0;
    let drag: { x: number; y: number; px: number; py: number } | null = null;
    const camera = () => ({
      zoom: Math.min(el.clientWidth / 350, el.clientHeight / 210) * zoomFactor,
      panX:
        panX -
        18 * Math.min(el.clientWidth / 350, el.clientHeight / 210) * zoomFactor,
      panY:
        panY -
        70 * Math.min(el.clientWidth / 350, el.clientHeight / 210) * zoomFactor,
    });
    const loop = createCanvasLoop(
      el,
      (time) => {
        if (!render.current) return;
        const W = el.clientWidth,
          H = el.clientHeight,
          dpr = Math.min(devicePixelRatio, 2);
        if (
          el.width !== Math.round(W * dpr) ||
          el.height !== Math.round(H * dpr)
        ) {
          el.width = Math.round(W * dpr);
          el.height = Math.round(H * dpr);
        }
        const current = latest.current.action;
        art.draw({
          ...render.current,
          W,
          H,
          dpr,
          ...camera(),
          clock: reduced.matches ? 0 : time / 1000,
          mode: current?.type === 'place' ? 'factory' : 'inspect',
          grid: true,
          draft:
            current?.type === 'place'
              ? playtestDraft(current.shape, current.plot)
              : undefined,
          preview: preview.current,
          hover:
            current?.type === 'place' ? PLAYTEST_PLOTS[current.plot]! : null,
          selected:
            current &&
            current.type !== 'place' &&
            typeof current.target === 'number'
              ? render.current.buildings.get(
                  `${PLAYTEST_PLOTS[current.target]!.x},${PLAYTEST_PLOTS[current.target]!.y}`,
                )!
              : null,
          citizen: { id: 'playtest', name: 'Playtest' },
          layer: 'all',
          walkers: [],
        });
      },
      () => !reduced.matches,
    );
    invalidate.current = () => loop.invalidate();
    const resize = new ResizeObserver(() => loop.invalidate());
    resize.observe(el);
    const down = (e: PointerEvent) => {
      if (e.button !== 0) return;
      drag = { x: e.clientX, y: e.clientY, px: panX, py: panY };
      el.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!drag) return;
      panX = drag.px + e.clientX - drag.x;
      panY = drag.py + e.clientY - drag.y;
      loop.invalidate(true);
    };
    const up = (e: PointerEvent) => {
      if (!drag) return;
      if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 5) {
        const rect = el.getBoundingClientRect(),
          c = camera();
        const x =
          (e.clientX - rect.left - el.clientWidth * 0.53 - c.panX) / c.zoom;
        const y =
          (e.clientY - rect.top - el.clientHeight * 0.53 - c.panY) / c.zoom;
        const tx = Math.floor((x / 27 + y / 13.5) / 2),
          ty = Math.floor((y / 13.5 - x / 27) / 2);
        const plot = PLAYTEST_PLOTS.findIndex((p) => p.x === tx && p.y === ty);
        if (plot >= 0) latest.current.onPlot(plot);
      }
      drag = null;
    };
    const cancel = () => {
      drag = null;
    };
    const context = (e: MouseEvent) => {
      e.preventDefault();
      latest.current.onCancel();
    };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      zoomFactor = Math.max(
        0.65,
        Math.min(2.5, zoomFactor * (e.deltaY > 0 ? 0.9 : 1.1)),
      );
      loop.invalidate(true);
    };
    const preference = () => loop.invalidate();
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', cancel);
    el.addEventListener('contextmenu', context);
    el.addEventListener('wheel', wheel, { passive: false });
    reduced.addEventListener('change', preference);
    return () => {
      invalidate.current = undefined;
      loop.dispose();
      art.dispose();
      resize.disconnect();
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', cancel);
      el.removeEventListener('contextmenu', context);
      el.removeEventListener('wheel', wheel);
      reduced.removeEventListener('change', preference);
    };
  }, []);
  return (
    <canvas
      ref={canvas}
      aria-label="Daily playtest district"
      className="h-full min-h-72 w-full touch-none"
    />
  );
}
