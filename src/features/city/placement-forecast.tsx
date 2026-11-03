import { useMemo } from 'react';
import type { CityStore } from '../../application/city-store';
import { applyCityCommand } from '../../domain/city/commands';
import { describeImpact } from '../../domain/city/guidance';
import { BUILDINGS } from '../../domain/city/catalog';
import { Button } from '@/components/ui/button';

export function PlacementForecast({ store }: { store: CityStore }) {
  const world = store((s) => s.world),
    draft = store((s) => s.draft),
    position = store((s) => s.previewPosition),
    actor = store((s) => s.citizenId),
    tool = store((s) => s.tool);
  const result = useMemo(() => {
    if (!position || tool === 'inspect') return null;
    try {
      return {
        impact: describeImpact(
          world,
          applyCityCommand(world, actor, {
            type: 'place',
            draft: { ...draft, kind: tool },
            position,
          }),
        ),
        error: null,
      };
    } catch (e) {
      return {
        impact: null,
        error: e instanceof Error ? e.message : 'Choose an available plot.',
      };
    }
  }, [world, draft, position, actor, tool]);
  if (tool === 'inspect') return null;
  return (
    <aside
      aria-label="Placement forecast"
      className="surface city-context-panel absolute right-4 z-10 w-[calc(100%-2rem)] max-w-sm space-y-3 overflow-y-auto p-5 sm:right-8"
    >
      <p className="text-xs uppercase tracking-widest text-muted-foreground">
        Placement forecast
      </p>
      <h2 className="text-lg font-semibold">{BUILDINGS[tool].label}</h2>
      {!result ? (
        <p className="text-sm text-muted-foreground">
          Move over a revealed plot to check services and the effect on nearby
          buildings.
        </p>
      ) : result.error ? (
        <p className="text-sm text-power" role="status">
          {result.error}
        </p>
      ) : (
        <>
          <p className="text-sm">
            Metal added next cycle:{' '}
            <span className="font-mono">
              {result.impact!.outputBefore} → {result.impact!.outputAfter}
            </span>
          </p>
          <p className="text-sm text-muted-foreground">
            {result.impact!.lostService.length
              ? `Loses service: ${result.impact!.lostService.map((id) => `#${id}`).join(', ')}`
              : 'No existing structures lose service.'}
          </p>
        </>
      )}
      <p className="text-xs text-muted-foreground">
        Construction is free in this pilot. Click revealed ground to place.
        Escape or right-click cancels.
      </p>
      <Button
        size="sm"
        variant="outline"
        onClick={() => store.getState().cancel()}
      >
        Cancel placement
      </Button>
    </aside>
  );
}
