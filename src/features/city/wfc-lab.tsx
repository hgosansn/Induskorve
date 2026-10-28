import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  generateWfc,
  WFC_STYLES,
  type WfcStyle,
} from '@/rendering/generation/wfc';
import { WFC_KIT } from '@/rendering/generation/wfc-kit';
import { drawWfc } from '@/rendering/generation/draw-wfc';
import { readPalette } from '@/rendering/palette';

export function WfcLab() {
  const [style, setStyle] = useState<WfcStyle>('terraces');
  const [seed, setSeed] = useState(42);
  const [floor, setFloor] = useState(6);
  const [structure, setStructure] = useState(false);
  const [lights, setLights] = useState(true);
  const canvas = useRef<HTMLCanvasElement>(null);
  const result = useMemo(() => generateWfc(seed, style), [seed, style]);
  const maximum = WFC_STYLES[style].height;
  const shown = Math.min(floor, maximum);
  useEffect(() => {
    const element = canvas.current;
    if (!element || result.status !== 'solved') return;
    const ctx = element.getContext('2d');
    if (!ctx) return;
    const palette = readPalette();
    const draw = () => {
      const { width, height } = element.getBoundingClientRect(),
        dpr = Math.min(devicePixelRatio, 2);
      element.width = Math.round(width * dpr);
      element.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawWfc(ctx, result.building, palette, width, height, {
        floors: shown,
        structure,
        lights,
      });
    };
    const observer = new ResizeObserver(draw);
    observer.observe(element);
    draw();
    return () => observer.disconnect();
  }, [result, shown, structure, lights]);
  return (
    <div className="grid min-h-0 gap-6 overflow-y-auto lg:grid-cols-[1.5fr_1fr]">
      <div className="min-w-0 space-y-3">
        <div className="border border-border">
          <div className="flex justify-between border-b border-border px-3 py-2 text-xs text-muted-foreground">
            <span>EXPERIMENT 01 / WFC</span>
            <span>
              {style.toUpperCase()} · {seed}
            </span>
          </div>
          {result.status === 'solved' ? (
            <canvas
              ref={canvas}
              aria-label="WFC building preview"
              className="block h-[38dvh] min-h-64 w-full lg:h-[50dvh]"
            />
          ) : (
            <p role="alert" className="p-8">
              {result.status === 'exhausted'
                ? 'Search budget reached. Try another seed.'
                : 'These constraints cannot be satisfied.'}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant={structure ? 'default' : 'outline'}
            aria-pressed={structure}
            onClick={() => setStructure(!structure)}
          >
            Show structure
          </Button>
          <Button
            variant="outline"
            aria-pressed={lights}
            onClick={() => setLights(!lights)}
          >
            Interior lights
          </Button>
        </div>
        <div className="space-y-2">
          <Label htmlFor="wfc-floor">
            Section through floor {shown} / {maximum}
          </Label>
          <input
            id="wfc-floor"
            type="range"
            min={1}
            max={maximum}
            value={shown}
            onChange={(e) => setFloor(Number(e.target.value))}
            className="w-full accent-primary"
          />
          <p className="text-xs text-muted-foreground">
            Lower the section to inspect the connected floors. Lighting is a
            visual study.
          </p>
        </div>
      </div>
      <div className="min-w-0 space-y-5">
        <div>
          <h3 className="text-xl font-semibold">Grow a building</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Compatible stacks form terraces around a stair core. The seed
            changes the massing; exposed edges receive the same small kit of
            parts.
          </p>
        </div>
        <ToggleGroup
          type="single"
          value={style}
          aria-label="Generation grammar"
          onValueChange={(v) => {
            if (v) {
              setStyle(v as WfcStyle);
              setFloor(6);
            }
          }}
          className="flex-wrap"
        >
          {Object.entries(WFC_STYLES).map(([key, value]) => (
            <ToggleGroupItem key={key} value={key}>
              {value.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <div className="space-y-2">
          <Label htmlFor="wfc-seed">Generation seed</Label>
          <div className="flex gap-2">
            <Input
              id="wfc-seed"
              type="number"
              min={0}
              max={4294967295}
              value={seed}
              onChange={(e) =>
                setSeed(
                  Math.max(
                    0,
                    Math.min(
                      4294967295,
                      Math.trunc(Number(e.target.value) || 0),
                    ),
                  ),
                )
              }
            />
            <Button onClick={() => setSeed((seed + 1) >>> 0)}>Next seed</Button>
          </div>
        </div>
        {result.status === 'solved' && (
          <>
            <p role="status" className="text-xs text-muted-foreground">
              Solved · {result.building.observations} collapses ·{' '}
              {result.building.backtracks} backtracks · all floors connected
            </p>
            <div className="flex items-start gap-4 border-y border-border py-4">
              <table
                aria-label={`Floor ${shown} plan`}
                className="shrink-0 border-collapse text-center text-xs"
              >
                <tbody>
                  {Array.from({ length: 5 }, (_, y) => (
                    <tr key={y}>
                      {Array.from({ length: 5 }, (_, x) => {
                        const i = x + y * 5,
                          h = result.building.heights[i]!,
                          occupied = h >= shown;
                        return (
                          <td
                            key={x}
                            title={`Bay ${x + 1}, ${y + 1}: ${h} storeys`}
                            className={`h-7 w-7 border border-background ${occupied ? (i === result.building.core ? 'bg-power text-background' : 'bg-materials/30 text-foreground') : 'bg-muted/10 text-muted-foreground'}`}
                          >
                            {occupied
                              ? i === result.building.core
                                ? 'C'
                                : h
                              : '·'}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Floor {shown} plan
                <br />
                <span className="text-power">C — stair core</span>
                <br />
                Numbers: stack height.
                <br />
                Every occupied bay connects to the core at this level. Ground
                entrance is front centre.
              </p>
            </div>
          </>
        )}
        <details className="border-b border-border pb-4">
          <summary className="cursor-pointer text-sm">
            The six-piece kit
          </summary>
          <dl className="mt-3 space-y-3">
            {WFC_KIT.map(([name, purpose]) => (
              <div key={name}>
                <dt className="text-sm">{name}</dt>
                <dd className="text-xs text-muted-foreground">{purpose}</dd>
              </div>
            ))}
          </dl>
        </details>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Preview only. WFC selects stack heights; a separate pass makes slabs,
          glazing and frames. Ground support and floor connectivity are checked,
          but this is not structural engineering or a playable building yet.
        </p>
      </div>
    </div>
  );
}
