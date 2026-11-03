import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { CityStore } from '../../application/city-store';
import { applyCityCommand, type CityCommand } from '../../domain/city/commands';
import { describeImpact } from '../../domain/city/guidance';
import { PROJECTS } from '../../domain/city/technology';
import { BUILDINGS, MODULES, buildingStats } from '../../domain/city/catalog';

export function CommandConfirmation({
  store,
  command,
  onClose,
}: {
  store: CityStore;
  command: CityCommand;
  onClose(): void;
}) {
  const world = store((s) => s.world),
    citizenId = store((s) => s.citizenId),
    pending = store((s) => s.pending),
    mode = store((s) => s.mode),
    liveRevision = store((s) => s.liveRevision);
  const [capture] = useState(() => {
    try {
      return {
        action: store.getState().captureCommand?.(command),
        error: null,
      };
    } catch (error) {
      return {
        action: undefined,
        error:
          error instanceof Error
            ? error.message
            : 'The live city is unavailable.',
      };
    }
  });
  const [error, setError] = useState<string | null>(null);
  let preview: ReturnType<typeof describeImpact> | null = null,
    blocked: string | null = null;
  let next: typeof world | null = null;
  try {
    next = applyCityCommand(world, citizenId, command);
    preview = describeImpact(world, next);
  } catch (e) {
    blocked = e instanceof Error ? e.message : 'This action is unavailable.';
  }
  if (capture.error) blocked = capture.error;
  if (capture.action && capture.action.revision !== liveRevision)
    blocked =
      'The city changed while this forecast was open. Close it and preview again.';
  const metal =
    command.type === 'contribute'
      ? command.sources.reduce((sum, s) => sum + s.amount, 0)
      : 0;
  const title =
    command.type === 'contribute'
      ? `Contribute to ${PROJECTS[command.projectId].label}`
      : command.type === 'configure'
        ? 'Review machinery change'
        : command.type === 'toggle'
          ? 'Review operating change'
          : 'Review dispatch';
  const building =
    'buildingId' in command
      ? world.buildings.find((b) => b.id === command.buildingId)
      : undefined;
  const updated = building
    ? next?.buildings.find((b) => b.id === building.id)
    : undefined;
  const stored = (value: typeof world) =>
    value.economy?.stockpiles.reduce((sum, s) => sum + s.metal, 0) ?? 0;
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Forecast from the current city. Confirmation checks availability
            again.
          </DialogDescription>
        </DialogHeader>
        {building && (
          <p className="text-sm">
            {BUILDINGS[building.type].label} #{building.id}
          </p>
        )}
        {command.type === 'configure' && building && updated && (
          <div className="space-y-2 border-y border-border py-4 text-sm">
            <p>
              Machinery after confirmation:{' '}
              {command.modules.length
                ? command.modules.map((id) => MODULES[id].label).join(', ')
                : 'Base machinery only'}
              .
            </p>
            <p>
              Configured power demand: {buildingStats(building).demand} →{' '}
              {buildingStats(updated).demand} units.
            </p>
          </div>
        )}
        {command.type === 'toggle' && building && (
          <p className="text-sm">
            {building.on
              ? 'Pause this structure and check its dependent services below.'
              : 'Restart this structure using the services currently available.'}
          </p>
        )}
        {next &&
          (command.type === 'dispatch' || command.type === 'dispatch-all') && (
            <dl className="space-y-2 border-y border-border py-4 text-sm">
              <div className="flex justify-between gap-3">
                <dt>Metal in storage</dt>
                <dd>
                  {stored(world)} → {stored(next)}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>Total metal dispatched</dt>
                <dd>
                  {world.economy?.shippedMetal ?? 0} →{' '}
                  {next.economy?.shippedMetal ?? 0}
                </dd>
              </div>
            </dl>
          )}
        {command.type === 'contribute' && (
          <div className="space-y-2 border-y border-border py-4 text-sm">
            <p>{metal} metal moves from storage into this project.</p>
            <ul className="space-y-1 text-muted-foreground">
              {command.sources.map((s) => (
                <li key={s.warehouseId}>
                  Warehouse #{s.warehouseId}: {s.amount} metal
                </li>
              ))}
            </ul>
            <p>Your contribution is recorded under your citizen name.</p>
          </div>
        )}
        {preview && (
          <dl className="space-y-3 text-sm">
            <div className="flex flex-wrap justify-between gap-2">
              <dt>Metal added next cycle</dt>
              <dd className="font-mono">
                {preview.outputBefore} → {preview.outputAfter}
              </dd>
            </div>
            <div>
              <dt>Structures losing service</dt>
              <dd
                className={
                  preview.lostService.length
                    ? 'text-power'
                    : 'text-muted-foreground'
                }
              >
                {preview.lostService.length
                  ? preview.lostService.map((id) => `#${id}`).join(', ')
                  : 'None'}
              </dd>
            </div>
            <div>
              <dt>Structures restored</dt>
              <dd className="text-muted-foreground">
                {preview.restoredService.length
                  ? preview.restoredService.map((id) => `#${id}`).join(', ')
                  : 'None'}
              </dd>
            </div>
          </dl>
        )}
        <p className="text-xs leading-relaxed text-muted-foreground">
          {mode === 'live'
            ? 'The shared city advances every 10 seconds, including while you are away. This forecast is checked again by the server.'
            : 'A cycle lasts 10 seconds while joined and visible. This is a local forecast, not a delivery guarantee.'}{' '}
          Construction and machinery changes are free in this pilot.
        </p>
        {(blocked || error) && (
          <p
            role="alert"
            className="border-l-2 border-power pl-3 text-sm text-power"
          >
            {blocked ?? error}
          </p>
        )}
        <DialogFooter>
          <Button variant="ghost" disabled={pending} onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!!blocked || pending}
            onClick={async () => {
              try {
                if (capture.action) await capture.action.perform();
                else await store.getState().perform(command);
                toast.success(
                  mode === 'live'
                    ? 'Contribution confirmed by the city.'
                    : (store.getState().world.progression?.events.at(-1)
                        ?.summary ?? 'Contribution saved.'),
                );
                onClose();
              } catch (e) {
                setError(
                  e instanceof Error
                    ? e.message
                    : 'The city changed. Review your contribution.',
                );
              }
            }}
          >
            {pending
              ? 'Waiting for confirmation…'
              : command.type === 'contribute'
                ? `Confirm ${metal} metal`
                : 'Confirm change'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
