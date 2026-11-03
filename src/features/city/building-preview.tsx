import { createCanvasLoop } from '../../rendering/canvas/frame-loop';
import { useEffect, useRef } from 'react';
import type { BuildingDraft } from '../../domain/city/model';
import { createArtwork } from '../../rendering/canvas/artwork.js';
import { projectWorld } from '../../rendering/canvas/view-model';
import type { BuildingStudy } from '../../rendering/canvas/building-layout';
import { assemblyOffset } from '../../rendering/canvas/building-layout';
import { buildingAssembly } from '../../rendering/assembly/compose';
import { KIT_Z } from '../../rendering/assembly/model';
import { iso } from '../../rendering/canvas/geometry';
import type { BuildingPartOverrides } from '../../rendering/canvas/buildings';

// Workshop and Atlas share the production renderer; no parallel mockup assets.
export function BuildingPreview({
  draft,
  active = true,
  study,
  stock = 0,
  className = 'h-64',
  maxZoom = 6,
  partOverrides,
  framingTop = 0,
}: {
  draft: BuildingDraft;
  active?: boolean;
  study?: BuildingStudy;
  stock?: number;
  className?: string;
  maxZoom?: number;
  partOverrides?: BuildingPartOverrides;
  framingTop?: number;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const el = canvas.current,
      ctx = el?.getContext('2d');
    if (!el || !ctx) return;
    const art = createArtwork(ctx);
    const world = projectWorld({
      version: 3,
      citizens: [],
      buildings: [
        {
          id: 0,
          x: 0,
          y: 0,
          type: draft.kind,
          on: active,
          modules: draft.modules,
        },
      ],
      appearances: [
        {
          buildingId: 0,
          height: draft.height,
          seed: draft.seed,
          design: draft.design,
        },
      ],
    });
    world.terrain = new Map([['0,0', { x: 0, y: 0 }]]);
    for (const n of world.net.values()) n.active = active;
    world.buildings.get('0,0')!.stock = stock;
    const assembly = buildingAssembly(world.buildings.get('0,0')!);
    const isolated = study?.isolate
      ? assembly.parts.find((p) => p.id === study.part)
      : undefined;
    if (isolated) world.terrain = new Map();
    const isolatedPoints = isolated
      ? [0, 1].flatMap((xx) =>
          [0, 1].flatMap((yy) =>
            [0, 1].map((zz) => {
              const v = isolated.volume;
              return iso(
                (v.x + xx * v.w) / 12,
                (v.y + yy * v.d) / 12,
                (v.z + zz * v.h) * KIT_Z,
              );
            }),
          ),
        )
      : [];
    const bounds = isolated
      ? {
          minX: Math.min(...isolatedPoints.map((p) => p[0])),
          maxX: Math.max(...isolatedPoints.map((p) => p[0])),
          minY: Math.min(...isolatedPoints.map((p) => p[1])),
          maxY: Math.max(...isolatedPoints.map((p) => p[1])),
        }
      : undefined;
    const upper = Math.max(
      framingTop,
      ...assembly.parts.map(
        (part) =>
          (part.volume.z + part.volume.h) * KIT_Z +
          assemblyOffset(part.layer, study),
      ),
    );
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const draw = (time: number) => {
      // Layout size is stable during the dialog opening transform.
      const rect = { width: el.clientWidth, height: el.clientHeight },
        dpr = Math.min(devicePixelRatio, 2);
      if (rect.width <= 0 || rect.height <= 0) return;
      if (
        el.width !== Math.round(rect.width * dpr) ||
        el.height !== Math.round(rect.height * dpr)
      ) {
        el.width = Math.round(rect.width * dpr);
        el.height = Math.round(rect.height * dpr);
      }
      const zoom = bounds
        ? Math.min(
            maxZoom,
            (rect.width - 32) / (bounds.maxX - bounds.minX),
            (rect.height - 32) / (bounds.maxY - bounds.minY),
          )
        : Math.min(maxZoom, rect.width / 85, (rect.height - 48) / (upper + 34));
      art.draw({
        ...world,
        W: rect.width,
        H: rect.height,
        dpr,
        zoom,
        panX:
          -rect.width * 0.03 -
          (bounds ? ((bounds.minX + bounds.maxX) * zoom) / 2 : 0),
        panY:
          -rect.height * 0.03 +
          (bounds
            ? (-(bounds.minY + bounds.maxY) * zoom) / 2
            : ((upper - 34) * zoom) / 2),
        clock: reduced.matches ? 0 : time / 1000,
        mode: 'inspect',
        grid: false,
        hover: null,
        selected: null,
        citizen: null,
        layer: 'off',
        walkers: [],
        study,
        partOverrides,
      });
    };
    const loop = createCanvasLoop(el, draw, () => !reduced.matches);
    const resize = new ResizeObserver(() => loop.invalidate());
    resize.observe(el);
    const preference = () => loop.invalidate();
    reduced.addEventListener('change', preference);
    return () => {
      loop.dispose();
      resize.disconnect();
      reduced.removeEventListener('change', preference);
      art.dispose();
    };
  }, [draft, active, study, stock, maxZoom, partOverrides, framingTop]);
  return (
    <canvas
      ref={canvas}
      aria-label="Configured building preview"
      className={`${className} w-full border border-border`}
    />
  );
}
