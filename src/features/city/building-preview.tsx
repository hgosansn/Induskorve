import { useEffect, useRef } from 'react';
import type { BuildingDraft } from '../../domain/city/model';
import { createArtwork } from '../../rendering/canvas/artwork.js';
import { projectWorld } from '../../rendering/canvas/view-model';
import type { BuildingStudy } from '../../rendering/canvas/building-layout';

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
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    let raf = 0;
    const draw = (time: number) => {
      const rect = el.getBoundingClientRect(),
        dpr = Math.min(devicePixelRatio, 2);
      if (
        el.width !== Math.round(rect.width * dpr) ||
        el.height !== Math.round(rect.height * dpr)
      ) {
        el.width = Math.round(rect.width * dpr);
        el.height = Math.round(rect.height * dpr);
      }
      const roof = draft.height * (draft.kind === 'warehouse' ? 0.42 : 0.55);
      const top = Math.max(
        draft.kind === 'power'
          ? draft.height * 0.45 + 8
          : draft.kind === 'factory'
            ? draft.height * 0.34 + 12
            : 18,
        draft.design.shape === 'tower' ? draft.height * 0.34 + 6 : 12,
      );
      const upper = roof + top + (study?.exploded ? 76 : 0);
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
      raf = requestAnimationFrame(draw);
    };
    const visibility = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden) raf = requestAnimationFrame(draw);
    };
    document.addEventListener('visibilitychange', visibility);
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', visibility);
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
