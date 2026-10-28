import { useMemo } from 'react';
import { X, Pause, Play, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BUILDINGS, RULES } from '../../domain/city/catalog';
import { calculateNetworks, serviceStatus } from '../../domain/city/networks';
import type { CityStore } from '../../application/city-store';

export function StructureInspector({ store }: { store: CityStore }) {
  const world = store((s) => s.world),
    id = store((s) => s.selectedId),
    citizenId = store((s) => s.citizenId);
  const networks = useMemo(
    () => calculateNetworks(world.buildings),
    [world.buildings],
  );
  const b = world.buildings.find((b) => b.id === id);
  if (!b) return null;
  const n = networks.services.get(b.id)!;
  const attempt = (action: () => void) => {
    try {
      action();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Action failed.');
    }
  };
  return (
    <aside
      aria-label="Structure inspector"
      className="surface absolute right-4 top-24 z-10 max-h-[calc(100dvh-15rem)] w-72 overflow-y-auto p-5 sm:right-8 sm:w-80"
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
      <p className="mb-3 text-xs text-muted-foreground">
        Sector {b.x}, {b.y} ·{' '}
        {b.creator ? `Built by ${b.creator}` : 'Founding district'}
      </p>
      <p className="mb-5 text-sm text-primary" role="status">
        {serviceStatus(b, n)}
      </p>
      <dl className="space-y-3 text-xs leading-relaxed">
        <div className="border-t border-border pt-3 text-[#ebca5e]">
          <dt>POWER {b.type === 'power' ? 'SOURCE' : 'INPUT'}</dt>
          <dd>
            {b.type === 'power'
              ? `${n.load} / ${RULES.powerCapacity} units`
              : n.powerId !== undefined
                ? `Station #${n.powerId} · ${n.demand} units`
                : `Needs a station within ${RULES.powerRange} tiles`}
          </dd>
        </div>
        {b.type === 'warehouse' && (
          <div className="text-[#70b7e3]">
            <dt>MATERIALS HUB</dt>
            <dd>
              {n.stockLoad} / {RULES.storageCapacity} foundries served
            </dd>
          </div>
        )}
        {b.type === 'factory' && (
          <>
            <div className="text-[#70b7e3]">
              <dt>MATERIALS LINK</dt>
              <dd>
                {n.storageId !== undefined
                  ? `Warehouse #${n.storageId}`
                  : `Needs powered storage within ${RULES.storageRange} tiles`}
              </dd>
            </div>
            <div className="text-[#d59065]">
              <dt>METAL OUTPUT</dt>
              <dd>{n.active ? 12 : 0} / cycle · illustrative</dd>
            </div>
          </>
        )}
      </dl>
      <p className="my-5 text-[11px] leading-relaxed text-muted-foreground">
        Local services · sagging wires carry power.
        <br />
        Airborne dots indicate a material link.
      </p>
      {citizenId ? (
        <div className="space-y-4 border-t border-border pt-4">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => attempt(() => store.getState().toggle(b.id))}
          >
            {b.on ? <Pause /> : <Play />}
            {b.on ? 'Pause machinery' : 'Start machinery'}
          </Button>
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
                  toast.error('Choose a PNG, JPEG, WebP or GIF under 1.5 MB.');
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
                  store.getState().billboard(targetId, source);
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
          <Button
            variant="ghost"
            className="w-full"
            onClick={() => attempt(() => store.getState().billboard(b.id))}
          >
            <RotateCcw />
            Use animated city advert
          </Button>
        </div>
      ) : (
        <p className="eyebrow">Join city to interact</p>
      )}
    </aside>
  );
}
