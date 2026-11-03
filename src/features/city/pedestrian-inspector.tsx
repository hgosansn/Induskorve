import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { CityStore } from '../../application/city-store';
import { BUILDINGS } from '../../domain/city/catalog';

export function PedestrianInspector({ store }: { store: CityStore }) {
  const key = store((s) => s.selectedPedestrian),
    world = store((s) => s.world),
    own = store((s) => s.citizenId);
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  if (!key) return null;
  const citizen = key.startsWith('citizen:')
    ? world.citizens.find((c) => c.id === key.slice(8))
    : undefined;
  const buildings = citizen
    ? world.buildings.filter((b) => b.creatorId === citizen.id)
    : [];
  const elapsed =
    citizen?.joinedAt !== undefined
      ? Math.max(0, Math.floor((now - citizen.joinedAt) / 60000))
      : undefined;
  const age =
    elapsed === undefined
      ? 'Not recorded'
      : elapsed < 1
        ? 'Just joined'
        : elapsed < 60
          ? `${elapsed} min`
          : elapsed < 1440
            ? `${Math.floor(elapsed / 60)} h ${elapsed % 60} min`
            : `${Math.floor(elapsed / 1440)} days`;
  const stats = citizen
    ? [
        ['Time since joined', age],
        ['Building contributions', String(buildings.length)],
        ['Building types', String(new Set(buildings.map((b) => b.type)).size)],
        ['Switched on', String(buildings.filter((b) => b.on).length)],
      ]
    : [
        ['Type', 'Ambient pedestrian'],
        ['Contributions', 'Not applicable'],
        ['Joined', 'Not applicable'],
      ];
  return (
    <aside
      aria-label="Pedestrian inspector"
      className="surface city-context-panel absolute right-4 z-10 w-[calc(100%-2rem)] max-w-80 overflow-y-auto p-5 sm:right-8"
    >
      <div className="flex items-center justify-between">
        <span className="eyebrow">
          Character /{' '}
          {citizen?.id === own ? 'You' : citizen ? 'Citizen' : 'Ambient'}
        </span>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Close pedestrian inspector"
          onClick={() => store.getState().selectPedestrian(null)}
        >
          <X />
        </Button>
      </div>
      <h2 className="mb-4 text-xl font-semibold">
        {citizen?.name ?? 'City pedestrian'}
      </h2>
      <dl className="space-y-3">
        {stats.map(([label, value]) => (
          <div
            key={label}
            className="flex items-baseline justify-between gap-3 border-b border-border pb-2 text-sm"
          >
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="font-mono">{value}</dd>
          </div>
        ))}
      </dl>
      {citizen && buildings.length > 0 && (
        <div className="mt-4 space-y-1 text-xs">
          {Object.entries(BUILDINGS).map(([type, info]) => {
            const count = buildings.filter((b) => b.type === type).length;
            return count > 0 ? (
              <p key={type}>
                {info.label} · {count}
              </p>
            ) : null;
          })}
        </div>
      )}
      <p className="mt-4 text-xs text-muted-foreground">
        {citizen
          ? 'Contributions count existing buildings attributed to this citizen. Older join dates were not recorded. Stats belong to this browser-local city.'
          : 'An ambient walker brings life to the streets. It represents no registered player and has no join history.'}
      </p>
    </aside>
  );
}
