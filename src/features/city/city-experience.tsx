import { lazy, Suspense, useCallback, useRef, useState } from 'react';
import {
  AnimatePresence,
  LazyMotion,
  domAnimation,
  MotionConfig,
} from 'motion/react';
import * as m from 'motion/react-m';
import {
  Factory,
  Zap,
  Warehouse,
  MousePointer2,
  Grid2X2,
  Minus,
  Plus,
  House,
  LocateFixed,
  LogOut,
  ArrowUpRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Toaster } from 'sonner';
import type { CityStore } from '../../application/city-store';
import type { NetworkLayer, Tool } from '../../domain/city/model';
import type { CityScene } from '../../rendering/canvas/scene';
import { CityCanvas } from './city-canvas';
import { Dialog, DialogTrigger } from '@/components/ui/dialog';
const JoinCityDialog = lazy(() =>
  import('./join-city-dialog').then((module) => ({
    default: module.JoinCityDialog,
  })),
);
const StructureInspector = lazy(() =>
  import('./structure-inspector').then((module) => ({
    default: module.StructureInspector,
  })),
);

const tools = [
  { id: 'inspect', label: 'Explore', icon: MousePointer2 },
  { id: 'factory', label: 'Foundry', icon: Factory },
  { id: 'power', label: 'Power', icon: Zap },
  { id: 'warehouse', label: 'Storage', icon: Warehouse },
] as const;
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
      <LazyMotion features={domAnimation} strict>
        <TooltipProvider>
          <Dialog open={joinOpen} onOpenChange={setJoinOpen}>
            <main className="relative h-dvh min-h-80 overflow-hidden bg-background text-foreground">
              <CityCanvas store={store} onReady={onReady} />
              <header className="pointer-events-none absolute left-5 top-7 sm:left-10 sm:top-8">
                <h1 className="text-lg font-black tracking-[-0.06em] sm:text-[22px]">
                  INDUSKORVE
                </h1>
                <p className="mt-1 text-[9px] uppercase tracking-[.23em] text-muted-foreground">
                  The founding district
                </p>
              </header>
              <div className="absolute right-4 top-6 flex items-center gap-1 sm:right-8">
                {citizen ? (
                  <>
                    <span className="mr-2 max-w-24 truncate text-xs text-primary sm:max-w-40">
                      {citizen.name} ●
                    </span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="icon"
                          aria-label="Find my pedestrian"
                          onClick={() => scene.current?.findCitizen()}
                        >
                          <LocateFixed />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Find my pedestrian</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="icon"
                          aria-label="Leave edit mode"
                          onClick={() => store.getState().leave()}
                        >
                          <LogOut />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Leave edit mode</TooltipContent>
                    </Tooltip>
                  </>
                ) : (
                  <DialogTrigger asChild>
                    <Button variant="outline">
                      Join city <ArrowUpRight />
                    </Button>
                  </DialogTrigger>
                )}
              </div>
              {selectedId !== null && (
                <Suspense fallback={null}>
                  <StructureInspector store={store} />
                </Suspense>
              )}
              {warning && (
                <p
                  role="alert"
                  className="surface absolute left-4 right-4 top-24 z-20 p-3 text-xs text-amber-200 sm:left-10 sm:right-auto sm:max-w-sm"
                >
                  {warning}
                </p>
              )}
              <div
                className={`absolute left-4 flex flex-col gap-3 sm:left-9 ${citizen ? 'bottom-32 sm:bottom-24' : 'bottom-20'}`}
              >
                <ToggleGroup
                  type="single"
                  value={layer}
                  onValueChange={(value) => {
                    if (value) store.getState().setLayer(value as NetworkLayer);
                  }}
                  aria-label="Network visibility"
                  className="surface p-1"
                >
                  <ToggleGroupItem value="all" aria-label="All networks">
                    All
                  </ToggleGroupItem>
                  <ToggleGroupItem
                    value="power"
                    className="text-[#ebca5e]"
                    aria-label="Power network"
                  >
                    Power
                  </ToggleGroupItem>
                  <ToggleGroupItem
                    value="materials"
                    className="text-[#70b7e3]"
                    aria-label="Materials network"
                  >
                    Materials
                  </ToggleGroupItem>
                  <ToggleGroupItem value="off" aria-label="Buildings only">
                    Buildings
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>
              <p className="pointer-events-none absolute bottom-5 left-5 max-w-[calc(100%-10rem)] text-[9px] uppercase leading-relaxed tracking-wider text-muted-foreground sm:bottom-8 sm:left-9">
                {world.buildings.length} structures · {world.citizens.length}{' '}
                local citizens · 24 ambient walkers
                <span className="block text-[8px] opacity-70">
                  Local city · saved in this browser
                </span>
              </p>
              <AnimatePresence>
                {citizen && (
                  <m.div
                    key="build-tools"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 12 }}
                    className="absolute bottom-16 left-1/2 -translate-x-1/2 sm:bottom-7"
                  >
                    {tool !== 'inspect' && (
                      <p
                        role="status"
                        className="mb-3 text-center text-[9px] uppercase tracking-wider text-primary"
                      >
                        Click to build · Right click / Esc to cancel
                      </p>
                    )}
                    <div className="surface flex items-center gap-1 p-1">
                      <ToggleGroup
                        type="single"
                        value={tool}
                        aria-label="Construction tools"
                        onValueChange={(value) => {
                          if (value) store.getState().setTool(value as Tool);
                        }}
                      >
                        {tools.map(({ id, label, icon: Icon }) => (
                          <ToggleGroupItem
                            key={id}
                            value={id}
                            aria-label={label}
                            className="gap-2 px-3"
                          >
                            <Icon className="size-4" />
                            <span className="hidden min-[440px]:inline">
                              {label}
                            </span>
                          </ToggleGroupItem>
                        ))}
                      </ToggleGroup>
                      <Button
                        variant={grid ? 'secondary' : 'ghost'}
                        size="icon"
                        aria-label="Toggle grid"
                        aria-pressed={grid}
                        onClick={() => store.getState().toggleGrid()}
                      >
                        <Grid2X2 />
                      </Button>
                    </div>
                  </m.div>
                )}
              </AnimatePresence>
              <nav
                className="surface absolute bottom-5 right-4 flex p-1 sm:bottom-7 sm:right-8"
                aria-label="Camera controls"
              >
                {[
                  { label: 'Zoom out', icon: Minus, action: 'out' },
                  { label: 'Reset camera', icon: House, action: 'home' },
                  { label: 'Zoom in', icon: Plus, action: 'in' },
                ].map(({ label, icon: Icon, action }) => (
                  <Tooltip key={label}>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={label}
                        onClick={() => {
                          if (action === 'home') scene.current?.home();
                          else scene.current?.zoom(action === 'in' ? 1 : -1);
                        }}
                      >
                        <Icon />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{label}</TooltipContent>
                  </Tooltip>
                ))}
              </nav>
              {joinOpen && (
                <Suspense fallback={null}>
                  <JoinCityDialog store={store} onOpenChange={setJoinOpen} />
                </Suspense>
              )}
            </main>
            <Toaster
              theme="dark"
              position="top-center"
              closeButton
              richColors
            />
          </Dialog>
        </TooltipProvider>
      </LazyMotion>
    </MotionConfig>
  );
}
