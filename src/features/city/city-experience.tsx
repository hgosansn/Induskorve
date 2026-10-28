import { lazy, Suspense, useCallback, useRef, useState } from 'react';
import { MotionConfig } from 'motion/react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Toaster } from 'sonner';
import type { CityStore } from '../../application/city-store';
import type { NetworkLayer } from '../../domain/city/model';
import type { CityScene } from '../../rendering/canvas/scene';
import { CityCanvas } from './city-canvas';
import { BuildingWorkshop } from './building-workshop';
const JoinCityDialog = lazy(() =>
  import('./join-city-dialog').then((m) => ({ default: m.JoinCityDialog })),
);
const StructureInspector = lazy(() =>
  import('./structure-inspector').then((m) => ({
    default: m.StructureInspector,
  })),
);
export function CityExperience({ store }: { store: CityStore }) {
  const citizenId = store((s) => s.citizenId),
    world = store((s) => s.world),
    tool = store((s) => s.tool),
    layer = store((s) => s.layer),
    grid = store((s) => s.grid),
    warning = store((s) => s.warning),
    selectedId = store((s) => s.selectedId);
  const citizen = world.citizens.find((c) => c.id === citizenId);
  const scene = useRef<CityScene | null>(null);
  const onReady = useCallback((value: CityScene | null) => {
    scene.current = value;
  }, []);
  const [joinOpen, setJoinOpen] = useState(false);
  return (
    <MotionConfig reducedMotion="user">
      <main className="relative h-dvh min-h-80 overflow-hidden bg-background text-foreground">
        <CityCanvas store={store} onReady={onReady} />
        <header className="absolute inset-x-4 top-5 flex flex-wrap items-center justify-between gap-3 sm:inset-x-9">
          <div>
            <h1 className="text-lg font-black tracking-tight">INDUSKORVE</h1>
            <p className="text-[9px] uppercase tracking-widest text-muted-foreground">
              The founding district
            </p>
          </div>
          <div className="flex gap-2">
            {citizen ? (
              <BuildingWorkshop store={store} />
            ) : (
              <Dialog open={joinOpen} onOpenChange={setJoinOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">Join city ↗</Button>
                </DialogTrigger>
                {joinOpen && (
                  <Suspense fallback={null}>
                    <JoinCityDialog store={store} onOpenChange={setJoinOpen} />
                  </Suspense>
                )}
              </Dialog>
            )}
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline">City</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>City controls</DialogTitle>
                  <DialogDescription>
                    {world.buildings.length} structures ·{' '}
                    {world.citizens.length} local citizens · 24 ambient walkers.
                    Saved in this browser. Local production runs every 10
                    seconds while joined and visible; raw feedstock is unlimited
                    in this pilot.
                  </DialogDescription>
                </DialogHeader>
                <p className="border-t border-border pt-3 font-mono text-xs">
                  Cycle {world.economy?.cycle ?? 0} ·{' '}
                  {world.economy?.shippedMetal ?? 0} metal dispatched
                </p>
                <ToggleGroup
                  type="single"
                  value={layer}
                  onValueChange={(v) => {
                    if (v) store.getState().setLayer(v as NetworkLayer);
                  }}
                  aria-label="Network visibility"
                >
                  {[
                    ['all', 'All'],
                    ['power', 'Power'],
                    ['materials', 'Materials'],
                    ['off', 'Buildings'],
                  ].map(([value, label]) => (
                    <ToggleGroupItem key={value} value={value!}>
                      {label}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    onClick={() => scene.current?.zoom(-1)}
                  >
                    Zoom out
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => scene.current?.home()}
                  >
                    Reset camera
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => scene.current?.zoom(1)}
                  >
                    Zoom in
                  </Button>
                  <Button
                    variant="outline"
                    aria-pressed={grid}
                    onClick={() => store.getState().toggleGrid()}
                  >
                    Grid
                  </Button>
                </div>
                {citizen && (
                  <>
                    <p className="text-sm">{citizen.name}</p>
                    <Button
                      variant="outline"
                      onClick={() => scene.current?.findCitizen()}
                    >
                      Find my pedestrian
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => store.getState().leave()}
                    >
                      Leave edit mode
                    </Button>
                  </>
                )}
              </DialogContent>
            </Dialog>
          </div>
        </header>
        {tool !== 'inspect' && (
          <div
            className="surface absolute left-4 top-24 flex max-w-[calc(100%-2rem)] flex-wrap items-center gap-3 p-3 text-xs"
            role="status"
          >
            <span>
              Choose revealed ground · click to place · Esc / right click to
              cancel
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => store.getState().cancel()}
            >
              Cancel placement
            </Button>
          </div>
        )}
        {selectedId !== null && (
          <Suspense fallback={null}>
            <StructureInspector store={store} />
          </Suspense>
        )}
        {warning && (
          <p
            role="alert"
            className="surface absolute left-4 top-40 max-w-sm p-3 text-xs text-power"
          >
            {warning}
          </p>
        )}
      </main>
      <Toaster theme="dark" position="top-center" closeButton />
    </MotionConfig>
  );
}
