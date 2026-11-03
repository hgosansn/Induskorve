import { useMemo, useState } from 'react';
import { X, Pause, Play, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  BUILDINGS,
  RULES,
  MODULES,
  buildingStats,
} from '../../domain/city/catalog';
import { calculateNetworks, serviceStatus } from '../../domain/city/networks';
import type { CityStore } from '../../application/city-store';
import {
  moduleKinds,
  isCivicKind,
  type BuildingModule,
} from '../../domain/city/model';
import type { CityCommand } from '../../domain/city/commands';
import { CommandConfirmation } from './command-confirmation';

export function StructureInspector({
  store,
  onInspect,
}: {
  store: CityStore;
  onInspect?(id: number): void;
}) {
  const [pending, setPending] = useState<CityCommand | null>(null);
  const world = store((s) => s.world),
    id = store((s) => s.selectedId),
    citizenId = store((s) => s.citizenId),
    mode = store((s) => s.mode),
    assets = store((s) => s.approvedBillboards),
    pendingAction = store((s) => s.pending);
  const networks = useMemo(
    () => calculateNetworks(world.buildings, world.economy?.stockpiles),
    [world.buildings, world.economy],
  );
  const b = world.buildings.find((b) => b.id === id);
  if (!b) return null;
  const n = networks.services.get(b.id)!;
  const stats = buildingStats(b);
  const stock =
    world.economy?.stockpiles.find((s) => s.buildingId === b.id)?.metal ?? 0;
  const creator = mode === 'local' || b.creatorId === citizenId;
  const attempt = async (action: () => void | Promise<void>) => {
    try {
      await action();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Action failed.');
    }
  };
  return (
    <aside
      aria-label="Structure inspector"
      className="surface city-context-panel absolute right-4 z-10 w-[calc(100%-2rem)] max-w-80 overflow-y-auto p-5 sm:right-8"
    >
      <div className="flex items-center justify-between">
        <span className="eyebrow">
          Structure / {String(b.id).padStart(4, '0')}
        </span>
        <Button
          size="icon"
          variant="ghost"
          aria-label="Close inspector"
          onClick={() => store.getState().select(null)}
        >
          <X />
        </Button>
      </div>
      <h2 className="mb-2 text-xl font-semibold tracking-tight">
        {BUILDINGS[b.type].label}
      </h2>
      <p className="mb-3 text-sm leading-relaxed text-muted-foreground">
        {BUILDINGS[b.type].description}
      </p>
      <p className="mb-3 text-xs text-muted-foreground">
        Sector {b.x}, {b.y} ·{' '}
        {b.creator ? `Built by ${b.creator}` : 'Founding district'}
      </p>
      <p className="mb-5 text-sm text-primary" role="status">
        {serviceStatus(b, n)}
      </p>
      <dl className="space-y-3 text-xs leading-relaxed">
        <div className="border-t border-border pt-3 text-power">
          <dt>POWER {b.type === 'power' ? 'SOURCE' : 'INPUT'}</dt>
          <dd>
            {b.type === 'power'
              ? `${n.load} / ${stats.powerCapacity} units`
              : n.powerId !== undefined
                ? `Station #${n.powerId} · ${n.demand} units`
                : `Needs a station within ${RULES.powerRange} tiles`}
          </dd>
          {n.powerId !== undefined && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                store.getState().select(n.powerId!);
                onInspect?.(n.powerId!);
              }}
            >
              Inspect station #{n.powerId}
            </Button>
          )}
        </div>
        {b.type === 'warehouse' && (
          <div className="text-materials">
            <dt>MATERIALS HUB</dt>
            <dd>
              {n.stockLoad} / {stats.storageCapacity} foundries served
            </dd>
          </div>
        )}
        {b.type === 'factory' && (
          <>
            <div className="text-materials">
              <dt>MATERIALS LINK</dt>
              <dd>
                {n.storageId !== undefined
                  ? `Warehouse #${n.storageId}`
                  : `Needs powered storage within ${RULES.storageRange} tiles`}
              </dd>
              {n.storageId !== undefined && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    store.getState().select(n.storageId!);
                    onInspect?.(n.storageId!);
                  }}
                >
                  Inspect warehouse #{n.storageId}
                </Button>
              )}
            </div>
            <div className="text-production">
              <dt>METAL OUTPUT</dt>
              <dd>
                {n.output} metal / 10 s
                {n.heatId !== undefined &&
                  ` · +4 recovered heat from #${n.heatId}`}
              </dd>
            </div>
          </>
        )}
      </dl>
      {b.modules?.length ? (
        <ul className="mt-4 space-y-2 border-t border-border pt-3 text-xs">
          {b.modules.map((m) => (
            <li key={m}>
              <strong>{MODULES[m].label}</strong>
              <br />
              <span className="text-muted-foreground">
                {MODULES[m].description}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {b.type === 'warehouse' && (
        <p className="mt-4 font-mono text-sm text-materials">
          {stock} / {stats.metalCapacity} metal stored
        </p>
      )}
      {stats.emissions > 0 && (
        <p className="mt-3 text-xs text-muted-foreground">
          Ground pollution: {n.active ? stats.emissions : 0} · current operating
          footprint
        </p>
      )}
      <p className="my-5 text-[11px] leading-relaxed text-muted-foreground">
        Local services · sagging wires carry power.
        <br />
        Blue dots indicate logistics; copper pipes recover heat.
      </p>
      {citizenId ? (
        <div className="space-y-4 border-t border-border pt-4">
          {!isCivicKind(b.type) && (
            <fieldset className="space-y-3">
              <legend className="eyebrow mb-3">Configure machinery</legend>
              {(Object.keys(MODULES) as BuildingModule[])
                .filter((m) => moduleKinds[m] === b.type)
                .map((m) => (
                  <Label key={m} className="items-start">
                    <input
                      type="checkbox"
                      checked={b.modules?.includes(m) ?? false}
                      disabled={
                        pendingAction ||
                        (!creator && (b.modules?.includes(m) ?? false))
                      }
                      onChange={(e) =>
                        setPending({
                          type: 'configure',
                          buildingId: b.id,
                          modules: e.target.checked
                            ? [...(b.modules ?? []), m]
                            : (b.modules ?? []).filter((v) => v !== m),
                        })
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
          )}
          {isCivicKind(b.type) && (
            <p className="text-xs text-muted-foreground">
              Powered windows and facade displays. Residents, rent and shop
              trade are not simulated yet.
            </p>
          )}
          {b.type === 'warehouse' && (
            <Button
              variant="outline"
              className="w-full"
              disabled={stock === 0 || !n.active}
              onClick={() => setPending({ type: 'dispatch', buildingId: b.id })}
            >
              Dispatch {stock} metal
            </Button>
          )}
          <Button
            variant="outline"
            className="w-full"
            onClick={() => setPending({ type: 'toggle', buildingId: b.id })}
            disabled={pendingAction || (!creator && b.on)}
          >
            {b.on ? <Pause /> : <Play />}
            {isCivicKind(b.type)
              ? b.on
                ? 'Switch off lights'
                : 'Switch on lights'
              : b.on
                ? 'Pause machinery'
                : 'Start machinery'}
          </Button>
          {mode === 'local' ? (
            <div className="space-y-2">
              <Label htmlFor="billboard">Billboard image / GIF</Label>
              <Input
                id="billboard"
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (!file) return;
                  if (
                    file.size > 1_500_000 ||
                    ![
                      'image/png',
                      'image/jpeg',
                      'image/gif',
                      'image/webp',
                    ].includes(file.type)
                  ) {
                    toast.error(
                      'Choose a PNG, JPEG, WebP or GIF under 1.5 MB.',
                    );
                    return;
                  }
                  const targetId = b.id;
                  try {
                    const source = await new Promise<string>(
                      (resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = () => resolve(String(reader.result));
                        reader.onerror = () =>
                          reject(new Error('Image could not be read.'));
                        reader.readAsDataURL(file);
                      },
                    );
                    await store.getState().billboard(targetId, source);
                    toast.success('Billboard updated in this browser.');
                  } catch (error) {
                    toast.error(
                      error instanceof Error
                        ? error.message
                        : 'Billboard upload failed.',
                    );
                  }
                }}
              />
            </div>
          ) : creator ? (
            <div className="space-y-2">
              <Label htmlFor="approved-billboard">Approved city artwork</Label>
              <select
                id="approved-billboard"
                className="min-h-11 w-full border border-input bg-background px-3 text-sm"
                disabled={pendingAction || !assets.length}
                defaultValue=""
                onChange={(event) => {
                  const id = event.target.value;
                  if (id)
                    void attempt(() => store.getState().billboard(b.id, id));
                }}
              >
                <option value="">
                  {assets.length
                    ? 'Choose artwork'
                    : 'No approved artwork available'}
                </option>
                {assets.map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    Artwork #{asset.id}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              You can add compatible machinery and restart this structure. Its
              creator controls removals, shutdowns and facade artwork.
            </p>
          )}
          <Button
            variant="ghost"
            className="w-full"
            onClick={() => attempt(() => store.getState().billboard(b.id))}
            disabled={!creator || pendingAction}
          >
            <RotateCcw />
            Use animated city advert
          </Button>
        </div>
      ) : (
        <p className="eyebrow">Join city to interact</p>
      )}
      {pending && (
        <CommandConfirmation
          store={store}
          command={pending}
          onClose={() => setPending(null)}
        />
      )}
    </aside>
  );
}
