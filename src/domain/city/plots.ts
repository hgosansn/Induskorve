import { tileKey, type Position, type WorldSnapshot } from './model';
import { revealedTerrain } from './terrain';

export const isRoadCorridor = ({ x, y }: Position) =>
  x % 4 === 0 || y % 4 === 0;

// A narrowly identified founding seed was placed on the origin intersection.
// Repair its position without deleting a structure or changing its identity.
export function relocateFoundingStation(world: WorldSnapshot): WorldSnapshot {
  const station = world.buildings.find(
    (b) =>
      b.id === 0 &&
      b.type === 'power' &&
      b.x === 0 &&
      b.y === 0 &&
      !b.creatorId &&
      !b.creator,
  );
  const appearance = world.appearances.find((a) => a.buildingId === 0);
  if (!station || appearance?.height !== 85 || appearance.seed !== 0.6)
    return world;
  const occupied = new Set(world.buildings.map((b) => tileKey(b.x, b.y)));
  const candidates = [...revealedTerrain(world.buildings).values()]
    .filter((p) => !isRoadCorridor(p) && !occupied.has(tileKey(p.x, p.y)))
    .sort(
      (a, b) =>
        Math.hypot(a.x, a.y) - Math.hypot(b.x, b.y) || b.y - a.y || b.x - a.x,
    );
  const plot = candidates[0];
  if (!plot) return world;
  return {
    ...world,
    buildings: world.buildings.map((b) =>
      b === station ? { ...b, x: plot.x, y: plot.y } : b,
    ),
  };
}
