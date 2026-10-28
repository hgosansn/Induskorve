import { useEffect, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Input } from '@/components/ui/input';
import {
  defaultDraft,
  type BuildingDraft,
  type BuildingKind,
  type BuildingDesign,
} from '../../domain/city/model';
import type { CityStore } from '../../application/city-store';
import { createArtwork } from '../../rendering/canvas/artwork.js';
import { projectWorld } from '../../rendering/canvas/view-model';
import { Plus } from 'lucide-react';

function BuildingPreview({ draft }: { draft: BuildingDraft }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const ctx = el.getContext('2d');
    if (!ctx) return;
    const art = createArtwork(ctx);
    const world = projectWorld({
      version: 3,
      citizens: [],
      buildings: [{ id: 0, x: 0, y: 0, type: draft.kind, on: true }],
      appearances: [
        {
          buildingId: 0,
          height: draft.height,
          seed: draft.seed,
          design: draft.design,
        },
      ],
    });
    for (const n of world.net.values()) n.active = true;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = 0;
    const draw = (time: number) => {
      const rect = el.getBoundingClientRect();
      const dpr = Math.min(devicePixelRatio, 2);
      el.width = rect.width * dpr;
      el.height = rect.height * dpr;
      art.draw({
        ...world,
        W: rect.width,
        H: rect.height,
        dpr,
        zoom: 1.8,
        panX: 0,
        panY: 100,
        clock: reduced ? 0 : time / 1000,
        mode: 'inspect',
        grid: false,
        hover: null,
        selected: null,
        citizen: null,
        layer: 'off',
        walkers: [],
      });
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      art.dispose();
    };
  }, [draft]);
  return (
    <canvas
      ref={canvas}
      aria-label="Configured building preview"
      className="h-80 w-full rounded border border-border"
    />
  );
}
export function BuildingWorkshop({ store }: { store: CityStore }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<BuildingDraft>(defaultDraft);
  const design = (patch: Partial<BuildingDesign>) =>
    setDraft((d) => ({ ...d, design: { ...d.design, ...patch } }));
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (value) {
          store.getState().cancel();
          setDraft(store.getState().draft);
        }
        setOpen(value);
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Plus />
          Add building
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Design your building</DialogTitle>
          <DialogDescription>
            Choose its purpose, silhouette and details. Then find its place in
            the city.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <BuildingPreview draft={draft} />
            <p className="mt-3 text-xs text-muted-foreground">
              One tile footprint · appearance stays the same when placed.
              Activity and lighting respond to nearby services.
            </p>
          </div>
          <div className="space-y-5">
            <fieldset>
              <legend className="mb-2 text-sm">Purpose</legend>
              <ToggleGroup
                type="single"
                value={draft.kind}
                onValueChange={(v) => {
                  if (v) setDraft((d) => ({ ...d, kind: v as BuildingKind }));
                }}
                aria-label="Building purpose"
              >
                {[
                  ['factory', 'Foundry'],
                  ['power', 'Power'],
                  ['warehouse', 'Storage'],
                ].map(([value, label]) => (
                  <ToggleGroupItem key={value} value={value!}>
                    {label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </fieldset>
            <fieldset>
              <legend className="mb-2 text-sm">Shape</legend>
              <ToggleGroup
                type="single"
                value={draft.design.shape}
                onValueChange={(v) => {
                  if (v) design({ shape: v as BuildingDesign['shape'] });
                }}
                aria-label="Building shape"
              >
                {['block', 'stepped', 'tower'].map((v) => (
                  <ToggleGroupItem key={v} value={v} className="capitalize">
                    {v}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </fieldset>
            <div>
              <Label htmlFor="building-height">Height · {draft.height}</Label>
              <Input
                id="building-height"
                type="range"
                min={24}
                max={85}
                value={draft.height}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, height: Number(e.target.value) }))
                }
              />
            </div>
            <fieldset className="space-y-2">
              <legend className="mb-2 text-sm">Features</legend>
              <Label>
                <input
                  type="checkbox"
                  checked={draft.design.stacks}
                  disabled={draft.kind === 'warehouse'}
                  onChange={(e) => design({ stacks: e.target.checked })}
                />
                Chimney stacks{' '}
                {draft.kind === 'warehouse' && '(industrial plants only)'}
              </Label>
              <Label>
                <input
                  type="checkbox"
                  checked={draft.design.balcony}
                  onChange={(e) => design({ balcony: e.target.checked })}
                />
                Service balcony
              </Label>
            </fieldset>
            <fieldset>
              <legend className="mb-2 text-sm">Facade display</legend>
              <ToggleGroup
                type="single"
                value={draft.design.display}
                onValueChange={(v) => {
                  if (v) design({ display: v as BuildingDesign['display'] });
                }}
                aria-label="Facade display"
              >
                <ToggleGroupItem value="animated">Animated LED</ToggleGroupItem>
                <ToggleGroupItem value="none">No display</ToggleGroupItem>
              </ToggleGroup>
            </fieldset>
            <Button
              variant="outline"
              onClick={() => setDraft((d) => ({ ...d, seed: Math.random() }))}
            >
              Vary finish and display artwork
            </Button>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              store.getState().prepare(draft);
              setOpen(false);
            }}
          >
            Choose location
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
