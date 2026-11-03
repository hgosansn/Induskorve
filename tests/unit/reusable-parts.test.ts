import { describe, expect, it } from 'vitest';
import {
  extractionCell,
  reusableParts,
} from '../../src/rendering/assets/reusable-parts';

describe('first reusable service kit', () => {
  it('keeps the city texture set within 80 KB and the exact kit projection', () => {
    expect(reusableParts).toHaveLength(8);
    expect(
      reusableParts.reduce((n, p) => n + p.variants[256].bytes, 0),
    ).toBeLessThan(80_000);
    for (const part of reusableParts) {
      const expected = [
        [-2.25, 1.125],
        [2.25, 1.125],
        [0, -3],
      ];
      for (let axis = 0; axis < 3; axis++)
        for (let channel = 0; channel < 2; channel++)
          expect(part.projection[axis]![channel]! * part.cityScale).toBeCloseTo(
            expected[axis]![channel]!,
            4,
          );
    }
  });

  it('joins actual mating-face ports with matching diameters and opposed normals', () => {
    for (const [a, b] of [
      ['duct-long', 'duct-short'],
      ['duct-short', 'duct-elbow'],
      ['duct-elbow', 'duct-reducer'],
    ]) {
      const first = reusableParts.find((p) => p.id === a)!;
      const second = reusableParts.find((p) => p.id === b)!;
      const out = first.ports.find((p) => p.id === 'out')!;
      const input = second.ports.find((p) => p.id === 'in')!;
      const at = extractionCell.find((p) => p.id === a)!.position;
      const bt = extractionCell.find((p) => p.id === b)!.position;
      for (let axis = 0; axis < 3; axis++) {
        expect(at[axis]! + out.point[axis]!).toBeCloseTo(
          bt[axis]! + input.point[axis]!,
          6,
        );
        expect(out.normal[axis]! + input.normal[axis]!).toBe(0);
      }
      expect(out.radius).toBe(input.radius);
    }
  });

  it('puts stands under straight skins clear of flange and stiffening bands', () => {
    const stands = extractionCell.filter((p) => p.id === 'saddle-stand');
    expect(stands).toHaveLength(2);
    for (const {
      position: [x, , z],
    } of stands) {
      expect(z).toBe(0);
      expect(z + 0.6).toBeCloseTo(0.9 - 0.3);
      for (const band of [0, 1, 2, 3])
        expect(Math.abs(x - band)).toBeGreaterThan(0.28 + 0.06);
    }
    const cabinet = extractionCell.find((p) => p.id === 'service-cabinet')!;
    expect(cabinet.position[2]).toBe(1.5);
    for (const railY of [2.05, 2.55]) {
      expect(railY).toBeGreaterThan(cabinet.position[1]);
      expect(railY).toBeLessThan(cabinet.position[1] + 0.7);
    }
  });
});
