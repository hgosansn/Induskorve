import { createCanvasLoop } from '../../rendering/canvas/frame-loop';
import { useEffect, useRef } from 'react';
import type { BuildingDraft } from '../../domain/city/model';
import { createArtwork } from '../../rendering/canvas/artwork.js';
import { projectWorld } from '../../rendering/canvas/view-model';
import type { BuildingStudy } from '../../rendering/canvas/building-layout';
import { assemblyOffset } from '../../rendering/canvas/building-layout';
import { buildingAssembly } from '../../rendering/assembly/compose';
import { KIT_Z } from '../../rendering/assembly/model';

// Workshop and Atlas share the production renderer; no parallel mockup assets.
export function BuildingPreview({
  draft,
  active = true,
  study,
  stock = 0,
  className = 'h-64',
}: {
  draft: BuildingDraft;
  active?: boolean;
  study?: BuildingStudy;
  stock?: number;
  className?: string;
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
    const upper = Math.max(
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
      if (
        el.width !== Math.round(rect.width * dpr) ||
        el.height !== Math.round(rect.height * dpr)
      ) {
        el.width = Math.round(rect.width * dpr);
        el.height = Math.round(rect.height * dpr);
      }
      const zoom = Math.min(
        6,
        rect.width / 85,
        (rect.height - 48) / (upper + 34),
      );
      art.draw({
        ...world,
        W: rect.width,
        H: rect.height,
        dpr,
        zoom,
        panX: -rect.width * 0.03,
        panY: -rect.height * 0.03 + ((upper - 34) * zoom) / 2,
        clock: reduced.matches ? 0 : time / 1000,
        mode: 'inspect',
        grid: false,
        hover: null,
        selected: null,
        citizen: null,
        layer: 'off',
        walkers: [],
        study,
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
  }, [draft, active, study, stock]);
  return (
    <canvas
      ref={canvas}
      aria-label="Configured building preview"
      className={`${className} w-full border border-border`}
    />
  );
}
