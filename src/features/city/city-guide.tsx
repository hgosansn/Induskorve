import { useMemo, useState } from 'react';
import { ArrowRight, Check, Package, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import type { CityStore } from '../../application/city-store';
import type { CityCommand } from '../../domain/city/commands';
import { BUILDINGS, RULES } from '../../domain/city/catalog';
import { cityOverview, explainNeed } from '../../domain/city/guidance';
import {
  availableStock,
  hasCapability,
  projectStatus,
  unlockedTechnologies,
} from '../../domain/city/progression';
import {
  PROJECTS,
  TECHNOLOGIES,
  type ProjectId,
  type TechnologyId,
} from '../../domain/city/technology';
import { CommandConfirmation } from './command-confirmation';

export function CityGuide({
  store,
  onInspect,
  onPlan,
}: {
  store: CityStore;
  onInspect(id: number): void;
  onPlan(): void;
}) {
  const world = store((s) => s.world),
    open = store((s) => s.guideOpen),
    citizenId = store((s) => s.citizenId),
    mode = store((s) => s.mode);
  const view = store((s) => s.guideView);
  const setView = store((s) => s.setGuideView);
  const [pending, setPending] = useState<CityCommand | null>(null);
  const [warehouseId, setWarehouseId] = useState<number | null>(null);
  const [pooled, setPooled] = useState(false);
  const [amounts, setAmounts] = useState<Partial<Record<ProjectId, string>>>(
    {},
  );
  const overview = useMemo(
    () => (open ? cityOverview(world) : null),
    [world, open],
  );
  const stocks = useMemo(
    () => (overview ? availableStock(world, overview.networks) : []),
    [world, overview],
  );
  const unlocked = unlockedTechnologies(world);
  const source = stocks.find((s) => s.buildingId === warehouseId) ?? stocks[0];
  const canPool = hasCapability(world, 'pooled-funding');
  const totalReady = stocks.reduce((sum, s) => sum + s.metal, 0);
  const events = [...(world.progression?.events ?? [])].reverse();
  if (!open || !overview) return null;
  const fundingSources = (id: ProjectId) => {
    const maximum = Math.min(
      projectStatus(world, id).remaining,
      pooled && canPool ? totalReady : (source?.metal ?? 0),
    );
    let remaining = amounts[id] === undefined ? maximum : Number(amounts[id]);
    if (
      !Number.isSafeInteger(remaining) ||
      remaining <= 0 ||
      remaining > maximum
    )
      return [];
    return (pooled && canPool ? stocks : source ? [source] : [])
      .map((s) => {
        const amount = Math.min(remaining, s.metal);
        remaining -= amount;
        return { warehouseId: s.buildingId, amount };
      })
      .filter((s) => s.amount > 0);
  };
  return (
    <>
      <aside
        aria-label="City guide"
        className="surface city-context-panel absolute right-4 z-10 w-[calc(100%-2rem)] max-w-sm overflow-y-auto sm:right-8"
      >
        <div className="flex items-center justify-between gap-3 px-5 pt-4">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            The founding district
          </p>
          <Button
            size="icon"
            variant="ghost"
            aria-label="Close city guide"
            onClick={() => store.getState().setGuideOpen(false)}
          >
            <X aria-hidden="true" />
          </Button>
        </div>
        <h2 className="px-5 text-xl font-semibold">
          {view === 'needs'
            ? 'Find your next contribution'
            : view === 'projects'
              ? 'Build what comes next'
              : 'The marks we leave'}
        </h2>
        <nav
          aria-label="City guide sections"
          className="flex flex-wrap gap-1 border-b border-border p-3"
        >
          {(
            [
              ['needs', 'Needs'],
              ['projects', 'Projects'],
              ['history', 'History'],
            ] as const
          ).map(([value, label]) => (
            <Button
              key={value}
              variant={view === value ? 'secondary' : 'ghost'}
              aria-pressed={view === value}
              onClick={() => setView(value)}
            >
              {label}
            </Button>
          ))}
        </nav>
        <div className="space-y-5 p-5 text-sm leading-relaxed">
          <p className="text-xs text-muted-foreground">
            {mode === 'live'
              ? 'Shared city · saved by the server. Production continues while you are away.'
              : 'Local city · saved in this browser. Production pauses when you leave.'}
          </p>
          {view === 'needs' && (
            <>
              <p>
                Restore a connection, improve machinery or help fund a shared
                goal. Choose where your contribution matters.
              </p>
              <dl className="grid grid-cols-2 gap-4 border-y border-border py-4">
                <div>
                  <dt className="text-xs text-muted-foreground">
                    Metal in storage
                  </dt>
                  <dd className="mt-1 font-mono text-xl">{overview.stored}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">
                    Added next cycle
                  </dt>
                  <dd className="mt-1 font-mono text-xl">
                    +{overview.nextCycleMetal}
                  </dd>
                </div>
              </dl>
              <p className="text-xs text-muted-foreground">
                Next-cycle output accounts for power, storage and remaining
                space. A cycle lasts {RULES.cycleMs / 1000} seconds
                {mode === 'live'
                  ? ' in the shared city.'
                  : ' while joined and visible.'}
              </p>
              <div>
                <h3 className="mb-3 font-medium">
                  {overview.needs.length
                    ? `${overview.needs.length} ${overview.needs.length === 1 ? 'structure needs' : 'structures need'} attention`
                    : 'Required services are available'}
                </h3>
                <ul className="divide-y divide-border">
                  {overview.needs.slice(0, 3).map(({ building, service }) => {
                    const need = explainNeed(building, service);
                    return (
                      <li key={building.id} className="py-3">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <span>
                            {need.label} #{building.id}
                          </span>
                          <span className="text-xs text-power">
                            {need.status}
                          </span>
                        </div>
                        <p className="my-2 text-xs text-muted-foreground">
                          {need.explanation}
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onInspect(building.id)}
                        >
                          Inspect structure <ArrowRight aria-hidden="true" />
                        </Button>
                      </li>
                    );
                  })}
                </ul>
                {!overview.needs.length && (
                  <p className="text-muted-foreground">
                    Explore an upgrade or put available metal toward the next
                    project.
                  </p>
                )}
              </div>
              <div className="grid gap-2">
                <Button variant="outline" onClick={() => setView('projects')}>
                  <Package aria-hidden="true" />
                  Explore city projects
                </Button>
                {citizenId && <Button onClick={onPlan}>Plan a building</Button>}
              </div>
              {!citizenId && (
                <p className="text-muted-foreground">
                  You can inspect freely. Join city to build or contribute.
                </p>
              )}
            </>
          )}
          {view === 'projects' && (
            <>
              <p>
                Contribute stored metal to unlock useful capabilities for this
                city. Existing buildings keep working.
              </p>
              {citizenId && stocks.length > 0 && (
                <fieldset className="space-y-3 border-y border-border py-4">
                  <legend className="font-medium">Contribution source</legend>
                  <Label htmlFor="project-warehouse">Powered warehouse</Label>
                  <select
                    id="project-warehouse"
                    className="min-h-11 w-full border border-input bg-background px-3 text-sm"
                    value={source?.buildingId ?? ''}
                    onChange={(e) => setWarehouseId(Number(e.target.value))}
                    disabled={pooled && canPool}
                  >
                    {stocks.map((s) => (
                      <option key={s.buildingId} value={s.buildingId}>
                        #{s.buildingId} · {s.metal} metal
                      </option>
                    ))}
                  </select>
                  {canPool && (
                    <Label className="min-h-11">
                      <input
                        type="checkbox"
                        checked={pooled}
                        onChange={(e) => setPooled(e.target.checked)}
                      />
                      Coordinate all powered warehouses
                    </Label>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {totalReady} metal ready across {stocks.length} powered
                    warehouses. Materials are deducted only after confirmation.
                  </p>
                </fieldset>
              )}
              <div className="space-y-6">
                {(Object.keys(PROJECTS) as ProjectId[]).map((id) => {
                  const status = projectStatus(world, id),
                    technology = TECHNOLOGIES[status.definition.unlock];
                  const sources = fundingSources(id),
                    amount = sources.reduce((sum, s) => sum + s.amount, 0);
                  const maximum = Math.min(
                    status.remaining,
                    pooled && canPool ? totalReady : (source?.metal ?? 0),
                  );
                  return (
                    <section
                      key={id}
                      aria-label={status.definition.label}
                      className="border-b border-border pb-5"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="font-medium">
                          {status.definition.label}
                        </h3>
                        {status.complete && (
                          <span className="flex items-center gap-1 text-xs">
                            <Check className="size-4" aria-hidden="true" />
                            Complete
                          </span>
                        )}
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {status.definition.description}
                      </p>
                      <p className="mt-3 font-mono">
                        {status.delivered} / {status.definition.cost} metal
                      </p>
                      <div
                        role="progressbar"
                        aria-label={`${status.definition.label} deliveries`}
                        aria-valuemin={0}
                        aria-valuemax={status.definition.cost}
                        aria-valuenow={status.delivered}
                        className="my-3 h-1 bg-muted"
                      >
                        <div
                          className="h-full bg-materials"
                          style={{
                            width: `${(100 * status.delivered) / status.definition.cost}%`,
                          }}
                        />
                      </div>
                      <p className="text-xs">Unlock: {technology.label}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {technology.description}
                      </p>
                      {!status.available && (
                        <p className="mt-3 text-xs text-power">
                          Requires{' '}
                          {status.definition.prerequisites
                            .map((t) => TECHNOLOGIES[t].label)
                            .join(', ')}
                          .
                        </p>
                      )}
                      {status.contributors.length > 0 && (
                        <p className="mt-3 text-xs text-muted-foreground">
                          Contributions:{' '}
                          {status.contributors
                            .map(
                              (c) =>
                                `${world.citizens.find((v) => v.id === c.citizenId)?.name ?? 'Citizen'} · ${c.amount}`,
                            )
                            .join('; ')}
                        </p>
                      )}
                      {!status.complete && citizenId && (
                        <div className="mt-4 space-y-2">
                          {status.available && maximum > 0 && (
                            <>
                              <Label htmlFor={`fund-${id}`}>
                                Contribution · metal
                              </Label>
                              <Input
                                id={`fund-${id}`}
                                type="number"
                                inputMode="numeric"
                                min={1}
                                max={maximum}
                                step={1}
                                value={amounts[id] ?? maximum}
                                aria-invalid={amount === 0}
                                aria-describedby={`fund-help-${id}`}
                                onChange={(e) =>
                                  setAmounts((current) => ({
                                    ...current,
                                    [id]: e.target.value,
                                  }))
                                }
                              />
                              <p
                                id={`fund-help-${id}`}
                                className={`text-xs ${amount === 0 ? 'text-power' : 'text-muted-foreground'}`}
                              >
                                Choose a whole amount between 1 and {maximum}{' '}
                                metal.
                              </p>
                            </>
                          )}
                          <Button
                            className="w-full"
                            variant="outline"
                            disabled={!status.available || amount === 0}
                            onClick={() =>
                              setPending({
                                type: 'contribute',
                                projectId: id,
                                sources,
                              })
                            }
                          >
                            Preview {amount} metal contribution
                          </Button>
                        </div>
                      )}
                    </section>
                  );
                })}
              </div>
              {!stocks.length && (
                <p className="text-muted-foreground">
                  No metal is ready in powered warehouses. Restore services and
                  let the ironworks produce before contributing.
                </p>
              )}
              <div>
                <h3 className="mb-3 font-medium">City technology</h3>
                <ul className="space-y-3">
                  {(Object.keys(TECHNOLOGIES) as TechnologyId[]).map((id) => (
                    <li key={id}>
                      <span>{TECHNOLOGIES[id].label}</span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        {unlocked.includes(id)
                          ? 'Available to this city'
                          : 'Not yet unlocked'}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              {citizenId && hasCapability(world, 'dispatch-all') && (
                <Button
                  disabled={!totalReady}
                  onClick={() => setPending({ type: 'dispatch-all' })}
                >
                  Preview coordinated dispatch
                </Button>
              )}
            </>
          )}
          {view === 'history' && (
            <>
              <p>
                Buildings, machinery changes and deliveries carry a
                contributor’s name. Your work becomes part of the district’s
                history.
              </p>
              {events.length ? (
                <ol className="divide-y divide-border">
                  {events.map((event) => (
                    <li key={event.id} className="space-y-2 py-4">
                      <p>{event.summary}</p>
                      <p className="text-xs text-muted-foreground">
                        {event.actor}
                        {event.actorId === citizenId ? ' · you' : ''} · cycle{' '}
                        {event.cycle}
                      </p>
                      {event.buildingId !== undefined &&
                        world.buildings.some(
                          (b) => b.id === event.buildingId,
                        ) && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => onInspect(event.buildingId!)}
                          >
                            Find{' '}
                            {
                              BUILDINGS[
                                world.buildings.find(
                                  (b) => b.id === event.buildingId,
                                )!.type
                              ].label
                            }{' '}
                            #{event.buildingId}
                          </Button>
                        )}
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="border-l-2 border-materials pl-3 text-muted-foreground">
                  Your next contribution starts the record. Earlier saved
                  buildings keep their original creator attribution.
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Latest 120 contributions. Earlier buildings keep their creator
                credits.
              </p>
            </>
          )}
        </div>
      </aside>
      {pending && (
        <CommandConfirmation
          store={store}
          command={pending}
          onClose={() => setPending(null)}
        />
      )}
    </>
  );
}
