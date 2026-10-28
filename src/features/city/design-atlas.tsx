import { useState } from 'react';
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
import { BuildingPreview } from './building-preview';
import {
  defaultDraft,
  moduleKinds,
  type BuildingKind,
  type BuildingModule,
} from '../../domain/city/model';
import { MODULES } from '../../domain/city/catalog';
import {
  ASSEMBLY_LAYERS,
  type AssemblyLayer,
} from '../../rendering/canvas/building-layout';

const families: Record<BuildingKind, { name: string; description: string }> = {
  power: {
    name: 'Power station',
    description:
      'Cooling towers rise above the turbine gallery. Yellow insulators mark the electrical connection; the copper radiator recovers heat.',
  },
  factory: {
    name: 'Foundry',
    description:
      'A sawtooth roof lights the production hall. Hot furnace throats, braced walls and exhaust stacks reveal the working process.',
  },
  warehouse: {
    name: 'Freight hub',
    description:
      'Recessed loading shutters sit below freight terraces. A gantry adds handling capacity; stored metal forms stacks on the apron.',
  },
};
const layerDescriptions: Record<AssemblyLayer, string> = {
  all: 'The complete building. Every fitted module is the same geometry used in the city.',
  foundation:
    'Raised base, service apron and inset marker lights anchor the building to its plot.',
  shell:
    'The structural skin: gallery, production hall or stepped freight terraces.',
  machinery:
    'Working cooling towers, furnaces and stockpiles establish the purpose of each building.',
  modules:
    'Optional equipment changes the silhouette and the corresponding game statistics.',
  services:
    'The control core, access balcony and network hardware connect people and machinery.',
};
export function DesignAtlas() {
  const [kind, setKind] = useState<BuildingKind>('power');
  const [modules, setModules] = useState<BuildingModule[]>([
    'turbine',
    'heat-exchanger',
  ]);
  const [focus, setFocus] = useState<AssemblyLayer>('all');
  const [exploded, setExploded] = useState(false);
  const [active, setActive] = useState(true);
  const [stock, setStock] = useState(true);
  const draft = {
    ...defaultDraft,
    kind,
    height: 58,
    modules,
    design: {
      ...defaultDraft.design,
      shape: 'stepped' as const,
      display: 'none' as const,
    },
  };
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">Design atlas</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92dvh] grid-rows-[auto_minmax(0,1fr)] sm:max-w-6xl">
        <DialogHeader>
          <DialogTitle>Design atlas</DialogTitle>
          <DialogDescription>
            Study the city's parts. These controls only change the preview.
          </DialogDescription>
        </DialogHeader>
        <div className="grid min-h-0 gap-6 overflow-y-auto lg:grid-cols-[1.5fr_1fr]">
          <div className="min-w-0">
            <BuildingPreview
              draft={draft}
              active={active}
              stock={kind === 'warehouse' && stock ? 150 : 0}
              study={{ focus, exploded }}
              className="h-[38dvh] min-h-64 lg:h-[58dvh]"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                variant={exploded ? 'default' : 'outline'}
                aria-pressed={exploded}
                onClick={() => setExploded(!exploded)}
              >
                Separate layers
              </Button>
              <Button
                variant="outline"
                aria-pressed={active}
                onClick={() => setActive(!active)}
              >
                {active ? 'Operating' : 'Idle'}
              </Button>
              {kind === 'warehouse' && (
                <Button
                  variant="outline"
                  aria-pressed={stock}
                  onClick={() => setStock(!stock)}
                >
                  {stock ? 'Show empty stock' : 'Show stored metal'}
                </Button>
              )}
            </div>
          </div>
          <div className="space-y-6">
            <ToggleGroup
              type="single"
              value={kind}
              aria-label="Asset family"
              onValueChange={(v) => {
                if (v) {
                  setKind(v as BuildingKind);
                  setModules(
                    (Object.keys(MODULES) as BuildingModule[]).filter(
                      (m) => moduleKinds[m] === v,
                    ),
                  );
                }
              }}
            >
              <ToggleGroupItem value="power">Power</ToggleGroupItem>
              <ToggleGroupItem value="factory">Foundry</ToggleGroupItem>
              <ToggleGroupItem value="warehouse">Freight</ToggleGroupItem>
            </ToggleGroup>
            <div>
              <h3 className="mb-2 text-xl font-semibold">
                {families[kind].name}
              </h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {families[kind].description}
              </p>
            </div>
            <fieldset>
              <legend className="mb-2 text-sm">Isolate a layer</legend>
              <ToggleGroup
                type="single"
                value={focus}
                aria-label="Assembly layer"
                className="flex-wrap justify-start"
                onValueChange={(v) => {
                  if (v) setFocus(v as AssemblyLayer);
                }}
              >
                {ASSEMBLY_LAYERS.map((v) => (
                  <ToggleGroupItem key={v} value={v} className="capitalize">
                    {v === 'all' ? 'Complete' : v}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                {layerDescriptions[focus]}
              </p>
            </fieldset>
            <fieldset className="space-y-4 border-t border-border pt-4">
              <legend className="text-sm">Fitted equipment</legend>
              {(Object.keys(MODULES) as BuildingModule[])
                .filter((m) => moduleKinds[m] === kind)
                .map((m) => (
                  <Label key={m} className="items-start">
                    <input
                      type="checkbox"
                      checked={modules.includes(m)}
                      onChange={(e) =>
                        setModules(
                          e.target.checked
                            ? [...modules, m]
                            : modules.filter((v) => v !== m),
                        )
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
            </fieldset>
            <div className="flex gap-4 border-t border-border pt-4 text-xs">
              <span className="text-power">Electricity</span>
              <span className="text-materials">Logistics</span>
              <span className="text-production">Heat / metal</span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
