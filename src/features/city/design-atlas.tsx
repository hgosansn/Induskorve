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
import { WfcLab } from './wfc-lab';
import {
  defaultDraft,
  moduleKinds,
  type BuildingKind,
  type BuildingModule,
  type BuildingDesign,
} from '../../domain/city/model';
import { MODULES } from '../../domain/city/catalog';
import { composeBuilding } from '../../rendering/assembly/compose';
import { validateAssembly } from '../../rendering/assembly/model';
import {
  ASSEMBLY_LAYERS,
  type AssemblyLayer,
} from '../../rendering/canvas/building-layout';

const families: Record<BuildingKind, { name: string; description: string }> = {
  power: {
    name: 'Power station',
    description:
      'The generator hall connects to a ground-mounted cooling cell. Extra generation and heat recovery each have a separate equipment bay.',
  },
  factory: {
    name: 'Foundry',
    description:
      'The furnace belongs inside the melting hall. A side duct carries fumes to the extraction bay; rooflights stay clear of machinery.',
  },
  warehouse: {
    name: 'Freight hub',
    description:
      'Loading doors open onto a clear approach. Stock occupies a marked apron under the gantry; solar panels stay on a dedicated roof rack.',
  },
};
const layerDescriptions: Record<AssemblyLayer, string> = {
  all: 'The complete building. Every fitted module is the same geometry used in the city.',
  foundation:
    'Raised base, service apron and inset marker lights anchor the building to its plot.',
  shell:
    'The structural skin: gallery, production hall or stepped freight terraces.',
  machinery:
    'Ground-supported cooling, extraction and stored inventory, each in its own bay.',
  modules:
    'Optional equipment changes the silhouette and the corresponding game statistics.',
  services:
    'Controls, grid hardware and a ladder provide operation, connection and roof access.',
};
export function DesignAtlas() {
  const [mode, setMode] = useState('assembly');
  const [kind, setKind] = useState<BuildingKind>('power');
  const [modules, setModules] = useState<BuildingModule[]>([
    'turbine',
    'heat-exchanger',
  ]);
  const [focus, setFocus] = useState<AssemblyLayer>('all');
  const [exploded, setExploded] = useState(false);
  const [active, setActive] = useState(true);
  const [stock, setStock] = useState(true);
  const [partId, setPartId] = useState('all');
  const [shape, setShape] = useState<BuildingDesign['shape']>('stepped');
  const [display, setDisplay] = useState(false);
  const draft = {
    ...defaultDraft,
    kind,
    height: 78,
    modules,
    design: {
      ...defaultDraft.design,
      shape,
      display: display ? ('animated' as const) : ('none' as const),
    },
  };
  const assembly = composeBuilding({
    type: kind,
    h: draft.height,
    variant: draft.seed,
    design: draft.design,
    modules,
    stock: kind === 'warehouse' && stock ? 150 : 0,
  });
  const part = assembly.parts.find((p) => p.id === partId);
  const mount = assembly.mounts.find((m) => m.id === part?.mount);
  const support = assembly.parts.find((p) => p.id === mount?.support);
  const fitErrors = validateAssembly(assembly);
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
          <ToggleGroup
            type="single"
            value={mode}
            aria-label="Atlas mode"
            onValueChange={(v) => {
              if (v) setMode(v);
            }}
          >
            <ToggleGroupItem value="assembly">Assembly</ToggleGroupItem>
            <ToggleGroupItem value="wfc">WFC lab</ToggleGroupItem>
          </ToggleGroup>
        </DialogHeader>
        {mode === 'wfc' ? (
          <WfcLab />
        ) : (
          <div className="grid min-h-0 gap-6 overflow-y-auto lg:grid-cols-[1.5fr_1fr]">
            <div className="min-w-0">
              <BuildingPreview
                draft={draft}
                active={active}
                stock={kind === 'warehouse' && stock ? 150 : 0}
                study={{ focus, exploded, part: part?.id }}
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
                <Button
                  variant="outline"
                  aria-pressed={display}
                  onClick={() => setDisplay(!display)}
                >
                  Facade display
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
                    setPartId('all');
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
                <legend className="mb-2 text-sm">Architecture</legend>
                <ToggleGroup
                  type="single"
                  value={shape}
                  aria-label="Architecture"
                  onValueChange={(value) => {
                    if (value) setShape(value as BuildingDesign['shape']);
                  }}
                >
                  <ToggleGroupItem value="block">Block</ToggleGroupItem>
                  <ToggleGroupItem value="stepped">Stepped</ToggleGroupItem>
                  <ToggleGroupItem value="tower">Tower</ToggleGroupItem>
                </ToggleGroup>
                <p className="mt-2 text-xs text-muted-foreground">
                  Floor setbacks and exposed frames shape the hall; machinery
                  keeps its reserved bays.
                </p>
              </fieldset>
              <div className="space-y-2 border-t border-border pt-4">
                <Label htmlFor="atlas-part">Why is this part here?</Label>
                <select
                  id="atlas-part"
                  className="w-full border border-border bg-card p-2 text-sm"
                  value={part ? part.id : 'all'}
                  onChange={(e) => {
                    setPartId(e.target.value);
                    setFocus('all');
                  }}
                >
                  <option value="all">Complete assembly</option>
                  {assembly.parts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                      {p.kind === 'cargo' ? ` ${p.id.slice(6)}` : ''}
                    </option>
                  ))}
                </select>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {part?.purpose ??
                    'Each part occupies a reserved bay and attaches to a support. Select a part to isolate it and read its job.'}
                </p>
                {part && (
                  <p className="text-xs text-muted-foreground">
                    {support
                      ? `Mounted on: ${support.label} · ${mount?.face === 'front' ? 'facade' : 'top surface'}`
                      : 'Root support: ground'}
                  </p>
                )}
                <p
                  className={
                    fitErrors.length
                      ? 'text-xs text-destructive'
                      : 'text-xs text-muted-foreground'
                  }
                >
                  {fitErrors.length
                    ? fitErrors.join(' · ')
                    : 'Fit checked: supports, equipment volumes, access lanes and internal pipe routes.'}
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
                    if (v) {
                      setFocus(v as AssemblyLayer);
                      setPartId('all');
                    }
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
        )}
      </DialogContent>
    </Dialog>
  );
}
