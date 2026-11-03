import {
  lazy,
  Suspense,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
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
import { Toaster, toast } from 'sonner';
import type { CityStore } from '../../application/city-store';
import type { NetworkLayer } from '../../domain/city/model';
import type { CityScene } from '../../rendering/canvas/scene';
import { CityCanvas } from './city-canvas';
import { BuildingWorkshop } from './building-workshop';
import { DesignAtlas } from './design-atlas';
import { PedestrianInspector } from './pedestrian-inspector';
import { CityGuide } from './city-guide';
import { PlacementForecast } from './placement-forecast';
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
    layer = store((s) => s.layer),
    grid = store((s) => s.grid),
    warning = store((s) => s.warning),
    selectedId = store((s) => s.selectedId),
    guideOpen = store((s) => s.guideOpen),
    mode = store((s) => s.mode),
    signedIn = store((s) => s.signedIn),
    connectionStatus = store((s) => s.connectionStatus),
    pending = store((s) => s.pending),
    joinPrompt = store((s) => s.joinPrompt);
  const hydrated = store(
    (s) => s.mode !== 'live' || s.liveRevision !== undefined,
  );
  const citizen = world.citizens.find((c) => c.id === citizenId);
  const scene = useRef<CityScene | null>(null);
  const shell = useRef<HTMLElement>(null),
    header = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    if (!shell.current || !header.current) return;
    const measure = () =>
      shell.current?.style.setProperty(
        '--city-panel-top',
        `${header.current!.offsetTop + header.current!.offsetHeight + 16}px`,
      );
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(header.current);
    return () => observer.disconnect();
  }, []);
  const onReady = useCallback((value: CityScene | null) => {
    scene.current = value;
  }, []);
  const [joinOpenLocal, setJoinOpenLocal] = useState(false);
  const [pixelStyle, setPixelStyle] = useState(true);
  const [rain, setRain] = useState(true);
  const joinOpen = joinOpenLocal || joinPrompt;
  const setJoinOpen = (open: boolean) => {
    setJoinOpenLocal(open);
    if (!open) store.setState({ joinPrompt: false });
  };
  const [workshopOpen, setWorkshopOpen] = useState(false);
  return (
    <MotionConfig reducedMotion="user">
      <main
        ref={shell}
        className="relative h-dvh min-h-80 overflow-hidden bg-background text-foreground"
      >
        {hydrated ? (
          <CityCanvas store={store} onReady={onReady} />
        ) : (
          <p
            role="status"
            className="grid h-full place-items-center text-sm text-muted-foreground"
          >
            Waiting for the shared city…
          </p>
        )}
        <header
          ref={header}
          className="absolute inset-x-4 top-5 flex flex-wrap items-center justify-between gap-3 sm:inset-x-9"
        >
          <div>
            <h1 className="text-lg font-black tracking-tight">INDUSKORVE</h1>
            <p className="text-xs text-muted-foreground">
              The founding district ·{' '}
              {mode === 'live'
                ? connectionStatus === 'ready'
                  ? 'shared city'
                  : connectionStatus
                : 'local city'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              aria-expanded={guideOpen}
              onClick={() =>
                store.getState().setGuideOpen(!store.getState().guideOpen)
              }
            >
              {citizen ? 'Contribute' : 'City projects'}
            </Button>
            {citizen ? (
              <BuildingWorkshop
                store={store}
                open={workshopOpen}
                onOpenChange={setWorkshopOpen}
              />
            ) : (
              <Dialog open={joinOpen} onOpenChange={setJoinOpen}>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    disabled={
                      pending ||
                      (mode === 'live' &&
                        signedIn &&
                        connectionStatus !== 'ready')
                    }
                    onClick={(event) => {
                      if (mode === 'live' && !signedIn) {
                        event.preventDefault();
                        void store
                          .getState()
                          .signIn()
                          .catch(() =>
                            toast.error(
                              'Sign-in could not start. Please try again.',
                            ),
                          );
                      }
                    }}
                  >
                    Join city ↗
                  </Button>
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
                    {world.citizens.length}{' '}
                    {mode === 'live' ? 'citizens' : 'local citizens'} · 24
                    ambient walkers.
                    {mode === 'live'
                      ? 'Saved to the shared city. Production advances every 10 seconds, including while you are away.'
                      : 'Saved in this browser. Local production runs every 10 seconds while joined and visible.'}{' '}
                    Raw feedstock is unlimited in this pilot.
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
                <DesignAtlas />
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    aria-pressed={pixelStyle}
                    onClick={() => {
                      setPixelStyle(!pixelStyle);
                      scene.current?.atmosphere(!pixelStyle, rain);
                    }}
                  >
                    Pixel style
                  </Button>
                  <Button
                    variant="outline"
                    aria-pressed={rain}
                    onClick={() => {
                      setRain(!rain);
                      scene.current?.atmosphere(pixelStyle, !rain);
                    }}
                  >
                    Rain
                  </Button>
                </div>
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
                {mode === 'live' && signedIn && (
                  <Button
                    variant="outline"
                    disabled={pending}
                    onClick={() => {
                      void store
                        .getState()
                        .signOut()
                        .catch(() =>
                          toast.error('Sign-out could not complete.'),
                        );
                    }}
                  >
                    Sign out
                  </Button>
                )}
              </DialogContent>
            </Dialog>
          </div>
          {warning && (
            <div
              role="alert"
              className="basis-full border-l-2 border-power bg-background p-3 text-sm text-power"
            >
              <p>{warning}</p>
              {mode === 'live' && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  disabled={
                    connectionStatus === 'connecting' ||
                    connectionStatus === 'synchronizing'
                  }
                  onClick={() => {
                    void store
                      .getState()
                      .reconnect()
                      .catch(() =>
                        toast.error('The city is still unavailable.'),
                      );
                  }}
                >
                  Reconnect
                </Button>
              )}
            </div>
          )}
        </header>
        <CityGuide
          store={store}
          onInspect={(id) => {
            store.getState().select(id);
            scene.current?.findBuilding(id);
          }}
          onPlan={() => {
            store.getState().cancel();
            setWorkshopOpen(true);
          }}
        />
        <PlacementForecast store={store} />
        {selectedId !== null && (
          <Suspense fallback={null}>
            <StructureInspector
              store={store}
              onInspect={(id) => scene.current?.findBuilding(id)}
            />
          </Suspense>
        )}
        <PedestrianInspector store={store} />
      </main>
      <Toaster theme="dark" position="top-center" closeButton />
    </MotionConfig>
  );
}
