import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { createPlaytestStore } from '../../application/playtest-store';
import {
  actInPlaytest,
  PARTICIPANTS,
  PLAYTEST,
  PLAYTEST_PLOTS,
  playtestMetrics,
  type PlaytestAction,
} from '../../domain/city/playtest';
import type { BuildingDesign } from '../../domain/city/model';
import { BUILDING_FORMS } from '../../rendering/assembly/building-form';
import { PlaytestCanvas } from './playtest-canvas';

const number = (v: number) =>
  v.toLocaleString(undefined, { maximumFractionDigits: 1 });
const energyNumber = (v: number) =>
  (Math.floor((v + 1e-9) * 100) / 100).toFixed(2);
type Store = ReturnType<typeof createPlaytestStore>;

export function DailyPlaytest() {
  const [store] = useState(() =>
    createPlaytestStore({
      getItem: (key) => localStorage.getItem(key),
      setItem: (key, value) => localStorage.setItem(key, value),
    }),
  );
  return <PlaytestPanel store={store} />;
}

function PlaytestPanel({ store }: { store: Store }) {
  const world = store((s) => s.world),
    warning = store((s) => s.warning),
    readOnly = store((s) => s.readOnly);
  const [actor, setActor] = useState(0),
    [running, setRunning] = useState(false);
  const [mode, setMode] = useState<'place' | 'expand' | 'connect'>('place');
  const [shape, setShape] = useState<BuildingDesign['shape']>('block');
  const [action, setAction] = useState<PlaytestAction | null>(null);
  useEffect(() => {
    const cancel = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setAction(null);
    };
    window.addEventListener('keydown', cancel);
    return () => window.removeEventListener('keydown', cancel);
  }, []);
  const [resetting, setResetting] = useState(false);
  const [notice, setNotice] = useState(
    'Choose a contribution. Planning is free.',
  );
  const metrics = useMemo(() => playtestMetrics(world), [world]);
  const forecast = useMemo(() => {
    if (!action) return null;
    try {
      const energy = [...world.energy] as typeof world.energy;
      energy[actor] = Math.max(1, energy[actor]!);
      return {
        metrics: playtestMetrics(
          actInPlaytest({ ...world, energy }, actor, action),
        ),
        error: '',
      };
    } catch (error) {
      return { metrics: null, error: (error as Error).message };
    }
  }, [world, actor, action]);
  useEffect(() => {
    if (!running || readOnly) return;
    const timer = window.setInterval(() => {
      if (!document.hidden) store.getState().advance(1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [running, readOnly, store]);
  const choosePlot = (plot: number) => {
    const foundry = world.foundries.find((f) => f.plot === plot);
    if (mode === 'place') {
      if (foundry) {
        setNotice(
          'That plot is occupied. Choose Expand or Connect to work on it.',
        );
        return;
      }
      setAction({ type: 'place', plot, shape });
    } else setAction({ type: mode, target: plot });
  };
  const ready =
    !!forecast?.metrics && world.energy[actor]! >= 1 - 1e-9 && !readOnly;
  const exportRun = () => {
    const blob = new Blob(
      [
        JSON.stringify(
          { rules: PLAYTEST, participants: PARTICIPANTS, world },
          null,
          2,
        ),
      ],
      { type: 'application/json' },
    );
    const url = URL.createObjectURL(blob),
      link = document.createElement('a');
    link.href = url;
    link.download = `induskorve-playtest-hour-${world.hour}.json`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <main
      aria-label="Daily playtest / The freight terminal"
      className="flex h-dvh w-full flex-col gap-3 overflow-y-auto bg-background p-4 text-foreground lg:overflow-hidden lg:p-6"
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <h1 className="text-lg font-semibold">
            Daily playtest / The freight terminal
          </h1>
          <p className="text-sm text-muted-foreground">
            Three local test participants. One shared project. Separate save;
            your founding city is untouched. Development only; excluded from
            release builds.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <a href="./">Return to city</a>
        </Button>
      </header>
      <div className="flex flex-wrap items-center justify-between gap-3 border-y border-border py-3">
        <div>
          <p className="font-mono text-sm" data-testid="playtest-clock">
            Day {Math.floor(world.hour / 24) + 1} ·{' '}
            {String(world.hour % 24).padStart(2, '0')}:00
          </p>
          <p className="text-xs text-muted-foreground">
            1 game hour / second · clock pauses when hidden or closed
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant={running ? 'default' : 'outline'}
            disabled={readOnly}
            onClick={() => setRunning(!running)}
          >
            {running ? 'Pause clock' : 'Run clock'}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={readOnly}
            onClick={() => store.getState().advance(1)}
          >
            +1 hour
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={readOnly}
            onClick={() => store.getState().advance(24)}
          >
            +1 day
          </Button>
          <Button size="sm" variant="outline" onClick={exportRun}>
            Export run
          </Button>
        </div>
      </div>
      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(340px,1fr)]">
        <div className="flex min-h-0 flex-col gap-3">
          <div className="grid grid-cols-3 border border-border text-sm">
            <div className="p-3">
              <p className="eyebrow">Power demand / capacity</p>
              <p className="font-mono text-power">
                {metrics.demand} / {metrics.power}
              </p>
            </div>
            <div className="border-x border-border p-3">
              <p className="eyebrow">Output / freight per day</p>
              <p className="font-mono text-materials">
                {metrics.output} / {metrics.freight}
              </p>
            </div>
            <div className="p-3">
              <p className="eyebrow">Buffer</p>
              <p className="font-mono">
                {number(world.stock)} / {PLAYTEST.buffer}
              </p>
            </div>
          </div>
          <div className="relative min-h-80 flex-1 overflow-hidden border border-border">
            <PlaytestCanvas
              world={world}
              action={action}
              onPlot={choosePlot}
              onCancel={() => setAction(null)}
            />
            <p className="pointer-events-none absolute left-3 top-3 bg-background/90 p-2 font-mono text-xs">
              {metrics.bottleneck}
            </p>
            <p className="pointer-events-none absolute right-3 top-3 max-w-44 bg-background/90 p-2 text-xs text-muted-foreground">
              Drag to pan · scroll to zoom. Choose a plot below to preview a
              contribution.
            </p>
          </div>
          <div className="border border-border p-3">
            <div className="flex justify-between gap-3 text-sm">
              <strong>
                {world.completedAt === null
                  ? 'Public freight terminal'
                  : 'Terminal operational · +24 freight/day'}
              </strong>
              <span data-testid="playtest-project">
                {number(Math.min(PLAYTEST.projectCost, world.delivered))} /{' '}
                {PLAYTEST.projectCost}
              </span>
            </div>
            <div
              role="progressbar"
              aria-label="Freight terminal construction"
              aria-valuenow={Math.min(PLAYTEST.projectCost, world.delivered)}
              aria-valuemin={0}
              aria-valuemax={PLAYTEST.projectCost}
              className="mt-2 h-2 w-full bg-muted"
            >
              <div
                className="h-full bg-materials"
                style={{
                  width: `${Math.min(100, (world.delivered / PLAYTEST.projectCost) * 100)}%`,
                }}
              />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Automatic deliveries build the terminal.{' '}
              {world.completedAt === null
                ? 'Completion adds permanent freight capacity.'
                : `Completed at hour ${world.completedAt}. ${number(world.delivered - PLAYTEST.projectCost)} surplus materials delivered.`}
            </p>
          </div>
        </div>
        <div className="space-y-4 lg:overflow-y-auto lg:pr-2">
          <section aria-label="Test participants">
            <p className="eyebrow mb-2">Whose contribution?</p>
            <ToggleGroup
              type="single"
              value={String(actor)}
              onValueChange={(value) => {
                if (value) {
                  setActor(Number(value));
                  setNotice(
                    'Participant changed. Each has an independent energy reserve.',
                  );
                }
              }}
              aria-label="Participant"
            >
              {PARTICIPANTS.map((name, i) => (
                <ToggleGroupItem
                  key={name}
                  value={String(i)}
                  className="flex-1"
                >
                  {name} · {energyNumber(world.energy[i]!)} E
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            <p
              className="mt-2 text-xs text-muted-foreground"
              data-testid="playtest-energy"
            >
              {PARTICIPANTS[actor]}: {energyNumber(world.energy[actor]!)} / 3
              energy · +1 every 24 game hours.{' '}
              {world.energy[actor]! < 1 - 1e-9
                ? `${Math.ceil((1 - world.energy[actor]!) * 24 - 1e-8)}h until next action.`
                : 'Each contribution costs 1 energy.'}
            </p>
          </section>
          <section
            aria-label="Contribution workshop"
            className="space-y-3 border-t border-border pt-3"
          >
            <ToggleGroup
              type="single"
              value={mode}
              aria-label="Contribution type"
              onValueChange={(value) => {
                if (value) {
                  setMode(value as typeof mode);
                  setAction(null);
                }
              }}
            >
              {(['place', 'expand', 'connect'] as const).map((value) => (
                <ToggleGroupItem
                  key={value}
                  value={value}
                  className="flex-1 capitalize"
                >
                  {value}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            {mode === 'place' && (
              <>
                <p className="text-sm">
                  Place a foundry · 12 output/day · 12 power. Basic electricity
                  and depot access are included.
                </p>
                <ToggleGroup
                  type="single"
                  value={shape}
                  aria-label="Foundry form"
                  onValueChange={(value) => {
                    if (value) {
                      setShape(value as typeof shape);
                      if (action?.type === 'place')
                        setAction({ ...action, shape: value as typeof shape });
                    }
                  }}
                >
                  {Object.entries(BUILDING_FORMS).map(([key, form]) => (
                    <ToggleGroupItem
                      key={key}
                      value={key}
                      className="flex-1 text-xs"
                    >
                      {form.label}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </>
            )}
            {mode === 'expand' && (
              <>
                <p className="text-sm">
                  Fit a functional module. Generator: +18 power. Handling: +24
                  freight/day. Furnace: +6 output/day and +6 power demand.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setAction({ type: 'expand', target: 'generator' })
                    }
                  >
                    Generator · stage {world.generator}/4
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setAction({ type: 'expand', target: 'handling' })
                    }
                  >
                    Freight handling · stage {world.handling}/2
                  </Button>
                </div>
              </>
            )}
            {mode === 'connect' && (
              <>
                <p className="text-sm">
                  Choose compatible endpoints: generator → foundry recovers heat
                  (+4/day); depot → terminal approach adds 24 freight/day.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setAction({ type: 'connect', target: 'freight' })
                  }
                >
                  Connect depot → terminal
                </Button>
              </>
            )}
            <div className="grid grid-cols-3 gap-2" aria-label="District plots">
              {PLAYTEST_PLOTS.map((plot, i) => {
                const f = world.foundries.find((f) => f.plot === i);
                const chosen =
                  action?.type === 'place'
                    ? action.plot === i
                    : action?.target === i;
                return (
                  <Button
                    key={i}
                    variant={chosen ? 'default' : 'outline'}
                    className="h-auto flex-col items-start px-2 py-2 text-left text-xs"
                    onClick={() => choosePlot(i)}
                    disabled={mode === 'place' ? !!f : !f}
                    aria-label={`Plot ${i + 1} · ${f ? 'foundry' : 'empty'}`}
                    aria-pressed={chosen}
                  >
                    <span>
                      Plot {i + 1} · {plot.x},{plot.y}
                    </span>
                    <span className="text-[10px]">
                      {f
                        ? `${PARTICIPANTS[f.creator]}${f.furnace ? ' · furnace' : ''}${f.heat ? ' · heat' : ''}`
                        : 'Empty plot'}
                    </span>
                  </Button>
                );
              })}
            </div>
            {action && (
              <div
                className="space-y-2 border border-border bg-card p-3"
                aria-label="Contribution forecast"
              >
                <p className="eyebrow">Forecast · 1 energy</p>
                {forecast?.metrics ? (
                  <>
                    <p className="text-sm">
                      Powered output {metrics.output} →{' '}
                      {forecast.metrics.output}/day
                      <br />
                      Freight {metrics.freight} → {forecast.metrics.freight}/day
                      <br />
                      Power {forecast.metrics.demand} needed /{' '}
                      {forecast.metrics.power} available
                    </p>
                    <p className="text-xs text-power">
                      {forecast.metrics.bottleneck}
                      {forecast.metrics.output > forecast.metrics.freight
                        ? ' — the buffer will eventually fill.'
                        : ''}
                    </p>
                  </>
                ) : (
                  <p role="alert" className="text-sm text-destructive">
                    {forecast?.error}
                  </p>
                )}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    disabled={!ready}
                    onClick={() => {
                      if (store.getState().act(actor, action)) {
                        setAction(null);
                        setNotice(
                          `${PARTICIPANTS[actor]}'s contribution is part of the district. 1 energy spent.`,
                        );
                      }
                    }}
                  >
                    Confirm contribution
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setAction(null)}
                  >
                    Cancel
                  </Button>
                </div>
                {!ready && forecast?.metrics && !readOnly && (
                  <p className="text-xs">
                    Waiting for energy. Advance the clock or switch participant.
                  </p>
                )}
              </div>
            )}
            <p role="status" className="text-xs text-muted-foreground">
              {notice}
            </p>
            {warning && (
              <p role="alert" className="text-sm text-destructive">
                {warning}
              </p>
            )}
          </section>
          <section
            className="border-t border-border pt-3"
            aria-label="Run diagnostics"
          >
            <p className="eyebrow mb-2">Where the loop breaks</p>
            <p className="text-xs">
              {world.actions} contributions · {number(world.produced)} produced
              · {number(world.delivered)} delivered
            </p>
            <p className="mt-1 text-xs">
              Lost potential: {number(world.powerLost)} from power shortages ·{' '}
              {number(world.freightLost)} from full storage.
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Experimental rates. Raw feedstock and construction are free. Six
              plots, fixed service routes, no authentication or live
              multiplayer. The clock advances only here; no offline catch-up.
            </p>
            <ol
              className="mt-3 space-y-2 text-xs"
              aria-label="Contribution history"
            >
              {world.log.slice(0, 12).map((entry, index) => (
                <li
                  key={`${entry.hour}-${index}`}
                  className="border-l border-border pl-2"
                >
                  <span className="text-muted-foreground">
                    H{entry.hour} ·{' '}
                  </span>
                  {entry.text}
                </li>
              ))}
            </ol>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setRunning(false);
                  setResetting(!resetting);
                }}
              >
                Reset experiment
              </Button>
              {resetting && (
                <>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => {
                      store.getState().reset();
                      setAction(null);
                      setResetting(false);
                      setNotice(
                        'Experiment reset. Each participant has 1 energy.',
                      );
                    }}
                  >
                    Discard playtest progress
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setResetting(false)}
                  >
                    Keep progress
                  </Button>
                </>
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
