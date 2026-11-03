import { expect, it, vi } from 'vitest';
import { paintDetailedPedestrian } from '../../src/rendering/assets/pedestrians';
import type { Walker } from '../../src/rendering/canvas/view-model';
import type { PedestrianAppearance } from '../../src/rendering/canvas/pedestrians';

it('shares a decoded atlas and keeps held/idle feet and frame stable', async () => {
  let loads = 0;
  vi.stubGlobal(
    'Image',
    class {
      src = '';
      decode() {
        loads++;
        return Promise.resolve();
      }
    },
  );
  vi.stubGlobal('window', { dispatchEvent: vi.fn() });
  try {
    const draws: unknown[][] = [];
    const ctx = {
      save() {},
      restore() {},
      scale() {},
      drawImage(...args: unknown[]) {
        draws.push(args);
      },
    } as unknown as CanvasRenderingContext2D;
    const w = {
      x: 0,
      y: 0,
      tx: 1,
      ty: 0,
      phase: 0,
      moving: true,
      color: '',
      wait: 0,
    } as Walker;
    const a = {
      kind: 'backpack',
      height: 8,
      cadence: 5,
      seed: 1,
    } as PedestrianAppearance;
    expect(paintDetailedPedestrian(ctx, w, a, 1, 1)).toBe(false);
    await Promise.resolve();
    await Promise.resolve();
    w.held = true;
    expect(paintDetailedPedestrian(ctx, w, a, 1, 1)).toBe(true);
    paintDetailedPedestrian(ctx, w, a, 100, 1);
    expect(draws[0]).toEqual(draws[1]);
    expect(draws[0]![2]).toBe(0);
    w.held = false;
    paintDetailedPedestrian(ctx, w, a, 0.55, -1);
    expect(draws[2]![2]).toBeGreaterThan(0);
    expect(draws[2]!.slice(5)).toEqual(draws[0]!.slice(5));
    const frames = new Set<string>();
    for (let i = 0; i < 6; i++) {
      paintDetailedPedestrian(ctx, w, a, i / 6, 1);
      const frame = draws.at(-1)!;
      frames.add(
        `${frame[0] === draws[0]![0] ? 'stride' : 'passing'}:${frame[2]}`,
      );
    }
    expect(frames.size).toBe(5);
    expect(loads).toBe(2);
  } finally {
    vi.unstubAllGlobals();
  }
});
