import { expect, it } from 'vitest';
import { obscuresFocus } from '../../src/rendering/canvas/focus-visibility';
import type { RenderBuilding } from '../../src/rendering/canvas/view-model';

const b = (id: number, x: number, y: number, h = 40): RenderBuilding => ({
  id,
  x,
  y,
  h,
  type: 'residential',
  on: true,
  variant: 0.5,
});
it('fades only foreground envelopes overlapping the focus, including tall civic forms', () => {
  const focus = b(1, 1, 1);
  expect(obscuresFocus(focus, focus)).toBe(false);
  expect(obscuresFocus(b(2, 2, 2, 85), focus)).toBe(true);
  expect(obscuresFocus(b(3, 0, 0, 85), focus)).toBe(false);
  expect(obscuresFocus(b(4, 6, 1, 85), focus)).toBe(false);
  expect(obscuresFocus(b(5, 9, 9, 8), focus)).toBe(false);
  expect(obscuresFocus(b(6, 2, 2), null)).toBe(false);
});
