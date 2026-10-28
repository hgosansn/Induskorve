import { describe, expect, it } from 'vitest';
import {
  generateWfc,
  validateWfc,
  WFC_STYLES,
  type WfcStyle,
} from '../../src/rendering/generation/wfc';
import { compileWfcKit } from '../../src/rendering/generation/wfc-kit';

describe('experimental WFC stack grammar', () => {
  it('reproduces a seed and explores genuinely different massing', () => {
    for (const style of Object.keys(WFC_STYLES) as WfcStyle[]) {
      expect(generateWfc(42, style)).toEqual(generateWfc(42, style));
      const silhouettes = new Set<string>();
      for (let seed = 0; seed < 100; seed++) {
        const result = generateWfc(seed, style);
        expect(result.status, `${style}/${seed}`).toBe('solved');
        if (result.status !== 'solved') continue;
        expect(validateWfc(result.building), `${style}/${seed}`).toEqual([]);
        expect(result.building.heights[20]).toBe(0);
        expect(result.building.heights[24]).toBe(0);
        silhouettes.add(result.building.heights.join(','));
      }
      expect(silhouettes.size).toBeGreaterThan(80);
    }
  });
  it('reports an exhausted search instead of returning a fake building', () => {
    expect(generateWfc(42, 'spire', 0)).toMatchObject({
      status: 'exhausted',
      observations: 0,
    });
  });
  it('rejects a locally compatible but disconnected upper floor', () => {
    const result = generateWfc(42, 'courtyard');
    if (result.status !== 'solved') throw Error('Expected solution');
    const heights = Array<number>(25).fill(1);
    heights[2] = 4;
    heights[1] = 2;
    heights[3] = 2;
    heights[7] = 2;
    heights[12] = 0;
    heights[22] = 1;
    heights[24] = 2;
    expect(validateWfc({ ...result.building, heights })).toContain(
      'Disconnected floor 2',
    );
  });
  it('assigns repeatable role-specific facade pieces without changing supporting floor geometry', () => {
    const result = generateWfc(43, 'spire');
    if (result.status !== 'solved') throw Error('Expected solution');
    const power = compileWfcKit(result.building, 'power'),
      factory = compileWfcKit(result.building, 'factory'),
      freight = compileWfcKit(result.building, 'warehouse');
    expect(power).toEqual(compileWfcKit(result.building, 'power'));
    expect(factory.map((b) => b.facade)).not.toEqual(
      power.map((b) => b.facade),
    );
    expect(freight.map((b) => b.facade)).not.toEqual(
      power.map((b) => b.facade),
    );
    expect(
      new Set([...power, ...factory, ...freight].map((b) => b.facade)).size,
    ).toBe(5);
    expect(factory.some((b) => b.roofFinish === 'daylight')).toBe(true);
    expect(
      factory.map(({ x, y, floor, front, right, roof }) => ({
        x,
        y,
        floor,
        front,
        right,
        roof,
      })),
    ).toEqual(
      power.map(({ x, y, floor, front, right, roof }) => ({
        x,
        y,
        floor,
        front,
        right,
        roof,
      })),
    );
  });
  it('compiles shared walls away and exactly one supported bay per occupied storey', () => {
    const result = generateWfc(43, 'spire');
    if (result.status !== 'solved') throw Error('Expected solution');
    const b = result.building,
      kit = compileWfcKit(b);
    expect(kit.length).toBe(b.heights.reduce((a, h) => a + h, 0));
    expect(kit.filter((p) => p.entrance)).toHaveLength(1);
    for (const part of kit) {
      const i = part.x + part.y * b.size;
      if (part.floor > 0)
        expect(
          kit.some(
            (p) =>
              p.x === part.x && p.y === part.y && p.floor === part.floor - 1,
          ),
        ).toBe(true);
      expect(part.front).toBe(
        part.y === b.size - 1 || b.heights[i + b.size]! <= part.floor,
      );
      expect(part.right).toBe(
        part.x === b.size - 1 || b.heights[i + 1]! <= part.floor,
      );
      expect(part.roof).toBe(part.floor === b.heights[i]! - 1);
    }
  });
});
