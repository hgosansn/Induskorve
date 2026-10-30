import { describe, expect, it } from 'vitest';
import {
  actInPlaytest,
  advancePlaytest,
  newPlaytest,
  playtestMetrics,
  playtestSchema,
  type PlaytestState,
} from '../../src/domain/city/playtest';
import {
  createPlaytestStore,
  PLAYTEST_SAVE_KEY,
} from '../../src/application/playtest-store';
import { projectPlaytest } from '../../src/rendering/canvas/playtest-projection';

function foundry(s: PlaytestState, actor: number, plot: number) {
  return actInPlaytest(s, actor, { type: 'place', plot, shape: 'block' });
}
describe('daily contribution experiment', () => {
  it('spends only the acting participant energy, rejects occupied plots atomically and banks up to three actions', () => {
    const initial = newPlaytest(),
      first = foundry(initial, 0, 0);
    expect(first.energy).toEqual([0, 1, 1]);
    expect(initial.foundries).toHaveLength(0);
    expect(() => foundry(first, 0, 1)).toThrow('energy');
    expect(() => foundry(first, 1, 0)).toThrow('occupied');
    expect(first.energy[1]).toBe(1);
    expect(advancePlaytest(first, 12).energy[0]).toBeCloseTo(0.5);
    const day = advancePlaytest(first, 24);
    expect(foundry(day, 0, 1).energy[0]).toBeCloseTo(0);
    expect(advancePlaytest(day, 168).energy).toEqual([3, 3, 3]);
    expect(() => advancePlaytest(first, -1)).toThrow();
  });
  it('exposes full buffers and power shortages, then recovers through connect and expand', () => {
    let s = foundry(foundry(newPlaytest(), 0, 0), 1, 1);
    s = actInPlaytest(s, 2, { type: 'expand', target: 'generator' });
    s = advancePlaytest(s, 24);
    expect(s.delivered).toBeCloseTo(24);
    s = actInPlaytest(s, 0, { type: 'expand', target: 0 });
    s = actInPlaytest(s, 1, { type: 'expand', target: 1 });
    s = actInPlaytest(s, 2, { type: 'connect', target: 0 });
    expect(playtestMetrics(s).output).toBe(40);
    s = advancePlaytest(s, 48);
    expect(s.stock).toBeCloseTo(20);
    expect(s.freightLost).toBeCloseTo(12);
    s = actInPlaytest(s, 0, { type: 'connect', target: 'freight' });
    const before = s.freightLost;
    s = advancePlaytest(s, 24);
    expect(s.stock).toBeCloseTo(12);
    expect(s.freightLost).toBeCloseTo(before);
    s = foundry(s, 1, 2);
    expect(playtestMetrics(s).bottleneck).toBe('Power shortage');
    s = advancePlaytest(s, 24);
    expect(s.powerLost).toBeCloseTo(12);
    s = actInPlaytest(s, 2, { type: 'expand', target: 'generator' });
    expect(playtestMetrics(s).powered.size).toBe(3);
    s = advancePlaytest(s, 24);
    expect(s.completedAt).not.toBeNull();
    expect(playtestMetrics(s).freight).toBe(72);
    expect(s.produced).toBeCloseTo(s.delivered + s.stock);
    expect(playtestSchema.safeParse(s).success).toBe(true);
  });
  it('rejects repeated modules and invalid connections without consuming an action', () => {
    let s = foundry(newPlaytest(), 0, 0);
    s = actInPlaytest(s, 1, { type: 'connect', target: 0 });
    expect(() => actInPlaytest(s, 2, { type: 'connect', target: 0 })).toThrow(
      'already',
    );
    expect(() => actInPlaytest(s, 2, { type: 'expand', target: 5 })).toThrow(
      'existing',
    );
    s = actInPlaytest(s, 2, { type: 'expand', target: 0 });
    s = advancePlaytest(s, 24);
    expect(() => actInPlaytest(s, 0, { type: 'expand', target: 0 })).toThrow(
      'already',
    );
  });
  it('is invariant to clock batching, conserves materials and unlocks the terminal once', () => {
    let initial = foundry(newPlaytest(), 0, 0);
    initial = foundry(initial, 1, 1);
    const daily = advancePlaytest(initial, 168);
    let hourly = initial;
    for (let i = 0; i < 168; i++) hourly = advancePlaytest(hourly, 1);
    expect(hourly).toEqual(daily);
    expect(
      hourly.log.filter((l) => l.text.startsWith('Freight terminal completed')),
    ).toHaveLength(1);
    for (let i = 0; i < 20; i++) hourly = advancePlaytest(hourly, 168);
    expect(hourly.produced).toBeCloseTo(hourly.delivered + hourly.stock);
    expect(playtestSchema.safeParse(hourly).success).toBe(true);
  });
  it('preserves incompatible saves until explicit reset and never touches the city key', () => {
    const data = new Map([
      [PLAYTEST_SAVE_KEY, '{broken'],
      ['induskorve:city:v3', 'original city'],
    ]);
    const storage = {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => {
        data.set(key, value);
      },
    };
    const store = createPlaytestStore(storage);
    expect(store.getState().readOnly).toBe(true);
    store.getState().advance(24);
    store.getState().act(0, { type: 'place', plot: 0, shape: 'tower' });
    expect(data.get(PLAYTEST_SAVE_KEY)).toBe('{broken');
    store.getState().reset();
    store.getState().act(0, { type: 'place', plot: 0, shape: 'tower' });
    expect(
      createPlaytestStore(storage).getState().world.foundries,
    ).toHaveLength(1);
    expect(data.get('induskorve:city:v3')).toBe('original city');
  });
  it('keeps the session usable when storage fails and reuses unchanged building artwork', () => {
    const store = createPlaytestStore({
      getItem: () => null,
      setItem: () => {
        throw Error('quota');
      },
    });
    expect(
      store.getState().act(0, { type: 'place', plot: 0, shape: 'tower' }),
    ).toBe(true);
    expect(store.getState().warning).toContain('Unable to save');
    const s = store.getState().world,
      rendered = projectPlaytest(s);
    const later = projectPlaytest(advancePlaytest(s, 1), rendered);
    expect(later.buildings.get('1,2')).toBe(rendered.buildings.get('1,2'));
    expect(later.buildings.get('1,1')).toBe(rendered.buildings.get('1,1'));
    expect(rendered.links.filter((l) => l.kind === 'heat')).toHaveLength(0);
    expect(
      projectPlaytest(
        actInPlaytest(s, 1, { type: 'connect', target: 0 }),
      ).links.filter((l) => l.kind === 'heat'),
    ).toHaveLength(1);
  });
});
