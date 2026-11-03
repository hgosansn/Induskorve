import { roofHeight } from './building-layout';
import type { RenderBuilding } from './view-model';

/** Conservative projected envelopes, matching city painter depth order. */
export function obscuresFocus(b: RenderBuilding, focus: RenderBuilding | null) {
  if (!focus || b.id === focus.id || b.x + b.y <= focus.x + focus.y)
    return false;
  const bounds = (building: RenderBuilding) => {
    const x = (building.x - building.y) * 27;
    const y = (building.x + building.y + 1) * 13.5;
    return {
      left: x - 27,
      right: x + 27,
      bottom: y + 13.5,
      top: y - 13.5 - Math.max(building.h, roofHeight(building)),
    };
  };
  const a = bounds(b),
    c = bounds(focus);
  return (
    a.left < c.right && a.right > c.left && a.top < c.bottom && a.bottom > c.top
  );
}
