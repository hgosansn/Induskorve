import { RULES } from './catalog';
import { tileKey, type Position } from './model';

export function revealedTerrain(
  buildings: readonly Position[],
): Map<string, Position> {
  const terrain = new Map<string, Position>();
  const bound = Math.ceil(RULES.revealRadius);
  for (const b of buildings) {
    for (let dx = -bound; dx <= bound; dx++) {
      for (let dy = -bound; dy <= bound; dy++) {
        if (Math.hypot(dx, dy) <= RULES.revealRadius) {
          const p = { x: b.x + dx, y: b.y + dy };
          terrain.set(tileKey(p.x, p.y), p);
        }
      }
    }
  }
  return terrain;
}
