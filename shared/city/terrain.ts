import { RULES } from './catalog';
import { cellKey } from './keys';
export const isRoad = (p: { x: number; y: number }) =>
  p.x % 4 === 0 || p.y % 4 === 0;
export function revealedCells(position: { x: number; y: number }) {
  const cells: { x: number; y: number; cellKey: string }[] = [];
  const bound = Math.ceil(RULES.revealRadius);
  for (let x = -bound; x <= bound; x++)
    for (let y = -bound; y <= bound; y++)
      if (Math.hypot(x, y) <= RULES.revealRadius) {
        const p = { x: position.x + x, y: position.y + y };
        cells.push({ ...p, cellKey: cellKey(p.x, p.y) });
      }
  return cells;
}
