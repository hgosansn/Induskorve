import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createPedestrianRenderer,
  pedestrianAppearance,
  pedestrianPose,
} from '../../src/rendering/canvas/pedestrians';
import type { Walker } from '../../src/rendering/canvas/view-model';
import type { Palette } from '../../src/rendering/palette';

const palette = Object.fromEntries(
  [
    ...readFileSync('src/app/palette.css', 'utf8').matchAll(
      /--([\w-]+):\s*([^;]+);/g,
    ),
  ].map((m) => [m[1], m[2]!.trim()]),
) as Palette;
const walker = (phase = 0): Walker => ({
  x: 0,
  y: 0,
  tx: 1,
  ty: 0,
  phase,
  color: palette.materials,
  ambient: true,
  moving: false,
});
afterEach(() => vi.unstubAllGlobals());
function recording() {
  const calls: unknown[][] = [];
  const ctx = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    globalAlpha: 1,
    font: '',
    textAlign: '',
    textBaseline: '',
    save() {
      calls.push(['save']);
    },
    restore() {
      calls.push(['restore']);
    },
    translate(...args: number[]) {
      calls.push(['translate', ...args]);
    },
    scale(...args: number[]) {
      calls.push(['scale', ...args]);
    },
    beginPath() {
      calls.push(['begin']);
    },
    closePath() {
      calls.push(['close']);
    },
    moveTo(...args: number[]) {
      calls.push(['move', ...args]);
    },
    lineTo(...args: number[]) {
      calls.push(['line', ...args]);
    },
    fill() {
      calls.push(['fill', this.fillStyle]);
    },
    stroke() {
      calls.push(['stroke', this.strokeStyle, this.lineWidth]);
    },
    fillRect(...args: number[]) {
      calls.push(['rect', this.fillStyle, ...args]);
    },
    ellipse(...args: number[]) {
      calls.push(['ellipse', ...args]);
    },
    fillText(text: string, ...args: number[]) {
      calls.push(['label', text, ...args]);
    },
    drawImage(image: object, ...args: number[]) {
      calls.push(['image', image, ...args]);
    },
  };
  return {
    calls,
    ctx,
    draw: createPedestrianRenderer(
      ctx as unknown as CanvasRenderingContext2D,
      palette,
    ),
  };
}
describe('pedestrian identity and gait artwork', () => {
  it('reuses cached torso sprites while moving legs and arms continue to animate', () => {
    const staticBody = recording();
    const createElement = vi.fn(() => ({
      width: 0,
      height: 0,
      getContext: () => staticBody.ctx,
    }));
    vi.stubGlobal('document', { createElement });
    const output = recording(),
      w = { ...walker(0.62), moving: true };
    output.draw(w, 0);
    const staticCommands = staticBody.calls.length;
    output.draw(w, 0.3);
    expect(createElement).toHaveBeenCalledTimes(1);
    expect(staticBody.calls).toHaveLength(staticCommands);
    const images = output.calls.filter((c) => c[0] === 'image');
    expect(images).toHaveLength(2);
    expect(images[0]![1]).toBe(images[1]![1]);
  });
  it('keeps named and ambient appearances stable across routes, positions, names and frames', () => {
    const ambient = walker(0.31);
    expect(
      pedestrianAppearance({ ...ambient, x: 100, y: -50, tx: 101 }),
    ).toEqual(pedestrianAppearance(ambient));
    const citizen = {
      ...ambient,
      ambient: false,
      person: { id: 'stable-id', name: 'First name' },
    };
    expect(
      pedestrianAppearance({
        ...citizen,
        phase: 900,
        person: { id: 'stable-id', name: 'Renamed' },
      }),
    ).toEqual(pedestrianAppearance(citizen));
    const appearance = pedestrianAppearance(citizen);
    expect(Object.keys(palette)).toContain(appearance.coat);
    expect(Object.keys(palette)).toContain(appearance.skin);
  });
  it('distributes six silhouette families, dimensions and cadences through stable identities', () => {
    const appearances = Array.from({ length: 48 }, (_, i) =>
      pedestrianAppearance(walker(i * 0.31)),
    );
    expect(new Set(appearances.map((a) => a.kind)).size).toBe(6);
    expect(new Set(appearances.map((a) => a.height)).size).toBeGreaterThan(6);
    expect(new Set(appearances.map((a) => a.build)).size).toBeGreaterThan(4);
    expect(new Set(appearances.map((a) => a.cadence)).size).toBeGreaterThan(5);
  });
  it('freezes idle and waiting poses but varies moving gait without altering identity', () => {
    const w = walker(2.17),
      appearance = pedestrianAppearance(w);
    expect(pedestrianPose(w, 0)).toEqual(pedestrianPose(w, 100));
    w.moving = true;
    w.wait = 2;
    expect(pedestrianPose(w, 0)).toEqual(pedestrianPose(w, 100));
    w.wait = 0;
    expect(pedestrianPose(w, 0)).not.toEqual(pedestrianPose(w, 0.19));
    expect(pedestrianAppearance(w)).toEqual(appearance);
    expect(pedestrianPose(w, 5)).toEqual(pedestrianPose(w, 5));
  });
  it('renders a still idle body and labels only named citizens without mutating walkers', () => {
    const w = walker(0.93),
      before = structuredClone(w),
      idle = recording();
    idle.draw(w, 0);
    const initial = structuredClone(idle.calls);
    idle.calls.length = 0;
    idle.draw(w, 50);
    expect(idle.calls).toEqual(initial);
    expect(w).toEqual(before);
    expect(idle.calls.some((c) => c[0] === 'label')).toBe(false);
    const named = recording();
    named.draw(
      { ...w, ambient: false, person: { id: 'citizen-1', name: 'Ada' } },
      0,
    );
    expect(named.calls.filter((c) => c[0] === 'label')).toEqual([
      ['label', 'Ada', 0, expect.any(Number), 38],
    ]);
  });
});
