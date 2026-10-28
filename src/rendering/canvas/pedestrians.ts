import type { Citizen } from '../../domain/city/model';
import { tileKey } from '../../domain/city/model';
import type { RenderWorld, Walker } from './view-model';

const coats = ['#a4b297', '#b69869', '#7eaaa2', '#be8075'];
export function syncWalkers(
  walkers: Walker[],
  citizens: readonly Citizen[],
  world: RenderWorld,
): Walker[] {
  const ids = new Set(citizens.map((c) => c.id));
  const next = walkers.filter(
    (w) => w.ambient || (w.person && ids.has(w.person.id)),
  );
  const spawn = [...world.terrain.values()].filter(
    (p) => !world.buildings.has(tileKey(p.x, p.y)),
  );
  const create = (i: number, person?: Citizen): Walker => {
    const value = person
      ? [...person.id].reduce((sum, c) => sum + c.charCodeAt(0), 0)
      : i;
    const p = spawn[(i * 7) % spawn.length] ?? { x: 0, y: 0 };
    return {
      x: p.x + 0.5,
      y: p.y + 0.5,
      tx: p.x + 0.5,
      ty: p.y + 0.5,
      phase: value * 0.31,
      color: coats[value % coats.length]!,
      person,
      ambient: !person,
    };
  };
  if (!next.some((w) => w.ambient))
    for (let i = 0; i < 24; i++) next.push(create(i));
  for (const citizen of citizens)
    if (!next.some((w) => w.person?.id === citizen.id))
      next.push(create(next.length, citizen));
  return next;
}
export function advanceWalkers(
  walkers: Walker[],
  world: RenderWorld,
  dt: number,
) {
  for (const w of walkers) {
    const distance = Math.hypot(w.tx - w.x, w.ty - w.y);
    if (distance < 0.03) {
      const options = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]
        .map(([dx, dy]) => ({
          x: Math.floor(w.x) + dx! + 0.5,
          y: Math.floor(w.y) + dy! + 0.5,
        }))
        .filter(
          (p) =>
            world.terrain.has(tileKey(Math.floor(p.x), Math.floor(p.y))) &&
            !world.buildings.has(tileKey(Math.floor(p.x), Math.floor(p.y))),
        );
      const p = options[Math.floor(Math.random() * options.length)];
      if (p) {
        w.tx = p.x;
        w.ty = p.y;
      }
    } else {
      const step = Math.min(distance, dt * 0.4);
      w.x += ((w.tx - w.x) / distance) * step;
      w.y += ((w.ty - w.y) / distance) * step;
    }
  }
}
