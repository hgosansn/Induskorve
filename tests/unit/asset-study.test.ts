import { describe, expect, it } from 'vitest';
import { projectStudy } from '../../src/features/asset-study/solid-views';

describe('asset inspection orientation', () => {
  it('opposite elevations mirror horizontal orientation without changing height', () => {
    for (const point of [
      [1, 4, 3],
      [8, 2, 12],
      [0, 0, 0],
    ] as [number, number, number][]) {
      const front = projectStudy(point, 'front');
      const back = projectStudy(point, 'back');
      const right = projectStudy(point, 'right');
      const left = projectStudy(point, 'left');
      expect(back).toEqual([-front[0], front[1]]);
      expect(left).toEqual([-right[0], right[1]]);
    }
  });
  it('top-down ignores height; elevation ignores distance along its viewing axis', () => {
    expect(projectStudy([3, 5, 1], 'top')).toEqual(
      projectStudy([3, 5, 20], 'top'),
    );
    expect(projectStudy([3, 5, 1], 'front')).toEqual(
      projectStudy([3, 9, 1], 'front'),
    );
    expect(projectStudy([3, 5, 1], 'right')).toEqual(
      projectStudy([9, 5, 1], 'right'),
    );
  });
});
