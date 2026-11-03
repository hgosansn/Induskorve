import { useState } from 'react';
import { BuildingPreview } from './building-preview';
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
  isCivicKind,
  moduleKinds,
  type BuildingModule,
  type BuildingDraft,
  type BuildingKind,
  type BuildingDesign,
} from '../../domain/city/model';
import type { CityStore } from '../../application/city-store';
import { BUILDINGS, MODULES, buildingStats } from '../../domain/city/catalog';
import { Plus } from 'lucide-react';
import { architectureForms } from '../../rendering/assembly/building-form';

export function BuildingWorkshop({
  store,
  open: controlledOpen,
  onOpenChange,
}: {
  store: CityStore;
  open?: boolean;
  onOpenChange?(open: boolean): void;
}) {
  const [localOpen, setLocalOpen] = useState(false);
  const open = controlledOpen ?? localOpen;
  const setOpen = onOpenChange ?? setLocalOpen;
  const [draft, setDraft] = useState<BuildingDraft>(defaultDraft);
  const stats = buildingStats({
    id: -1,
    x: 0,
    y: 0,
    type: draft.kind,
    on: true,
    modules: draft.modules,
  });
  const forms = architectureForms(draft.kind),
    civic = isCivicKind(draft.kind);
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
      <DialogContent className="max-h-[90dvh] grid-rows-[auto_minmax(0,1fr)_auto] sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Design your building</DialogTitle>
          <DialogDescription>
            Choose its purpose, configure its machinery, then preview nearby
            services before placing it.
          </DialogDescription>
        </DialogHeader>
        <div className="grid min-h-0 gap-6 overflow-y-auto sm:grid-cols-2">
          <div className="self-start sm:sticky sm:top-0">
            <BuildingPreview draft={draft} />
            <p className="mt-3 text-xs text-muted-foreground">
              {civic
                ? 'One tile footprint · homes and shops use local power; population and trade are not simulated yet.'
                : 'One tile footprint · machinery shown in operating condition. Power, storage and neighboring heat recovery determine actual output.'}
            </p>
          </div>
          <div className="space-y-5">
            <fieldset>
              <legend className="mb-2 text-sm">Purpose</legend>
              <ToggleGroup
                type="single"
                value={draft.kind}
                onValueChange={(v) => {
                  if (v)
                    setDraft((d) => ({
                      ...d,
                      kind: v as BuildingKind,
                      modules: [],
                      height:
                        v === 'skyscraper' ? Math.max(72, d.height) : d.height,
                      design: {
                        ...d.design,
                        shape:
                          v === 'skyscraper'
                            ? 'tower'
                            : v === 'shop'
                              ? 'block'
                              : d.design.shape,
                        display:
                          v === 'skyscraper'
                            ? 'animated'
                            : v === 'residential' || v === 'shop'
                              ? 'none'
                              : d.design.display,
                      },
                    }));
                }}
                aria-label="Building purpose"
                className="flex-wrap justify-start"
              >
                {(Object.keys(BUILDINGS) as BuildingKind[]).map((value) => (
                  <ToggleGroupItem key={value} value={value}>
                    {BUILDINGS[value].shortLabel}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {BUILDINGS[draft.kind].description}
              </p>
            </fieldset>
            <fieldset>
              <legend className="mb-2 text-sm">Architecture</legend>
              <ToggleGroup
                type="single"
                value={draft.design.shape}
                onValueChange={(v) => {
                  if (v) design({ shape: v as BuildingDesign['shape'] });
                }}
                aria-label="Building shape"
              >
                {(['block', 'stepped', 'tower'] as const).map((v) => (
                  <ToggleGroupItem key={v} value={v} className="capitalize">
                    {forms[v].label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              <p className="mt-2 text-xs text-muted-foreground">
                {forms[draft.design.shape].description}
              </p>
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
              <legend className="mb-2 text-sm">
                {civic ? 'Local services' : 'Functional modules'}
              </legend>
              {(Object.keys(MODULES) as BuildingModule[])
                .filter((m) => moduleKinds[m] === draft.kind)
                .map((m) => (
                  <Label
                    key={m}
                    className="items-start border border-border p-3"
                  >
                    <input
                      type="checkbox"
                      checked={draft.modules?.includes(m) ?? false}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          modules: e.target.checked
                            ? [...(d.modules ?? []), m]
                            : d.modules?.filter((v) => v !== m),
                        }))
                      }
                    />
                    <span>
                      {MODULES[m].label}
                      <span className="mt-1 block text-xs font-normal leading-relaxed text-muted-foreground">
                        {MODULES[m].description}
                      </span>
                    </span>
                  </Label>
                ))}
              <p className="border-l-2 border-primary pl-3 font-mono text-xs leading-relaxed">
                {draft.kind === 'power'
                  ? `${stats.powerCapacity} power available`
                  : `${stats.demand} power required`}
                {draft.kind === 'factory' &&
                  ` · ${stats.output} metal / 10 s + recovered heat`}
                {draft.kind === 'warehouse' &&
                  ` · ${stats.storageCapacity} connections · ${stats.metalCapacity} metal capacity`}
              </p>
            </fieldset>
            <fieldset className="space-y-2">
              <legend className="mb-2 text-sm">Facade details</legend>
              <Label>
                <input
                  type="checkbox"
                  checked={draft.design.balcony}
                  onChange={(e) => design({ balcony: e.target.checked })}
                />
                {civic ? 'Balconies / entrance canopy' : 'Service balcony'}
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
            <div className="space-y-2">
              <Label htmlFor="layout-seed">Layout seed</Label>
              <Input
                id="layout-seed"
                type="number"
                min={0}
                max={1000000}
                value={Math.round(draft.seed * 1000000)}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    seed:
                      Math.max(
                        0,
                        Math.min(
                          1000000,
                          Math.trunc(Number(e.target.value) || 0),
                        ),
                      ) / 1000000,
                  }))
                }
              />
              <Button
                variant="outline"
                onClick={() =>
                  setDraft((d) => ({
                    ...d,
                    seed:
                      ((Math.round(d.seed * 1000000) + 1) % 1000001) / 1000000,
                  }))
                }
              >
                Generate another layout
              </Button>
              <p className="text-xs text-muted-foreground">
                Keep a seed to rebuild the same layout. It also sets the
                facade's lighting and display pattern.
              </p>
            </div>
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
