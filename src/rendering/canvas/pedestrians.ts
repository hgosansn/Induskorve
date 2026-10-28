import type { Citizen } from '../../domain/city/model';
import { walkingRoute } from '../../domain/city/streets';
import type { RenderWorld, Walker } from './view-model';
import { readPalette } from '../palette';

export function syncWalkers(
  walkers: Walker[],
  citizens: readonly Citizen[],
  world: RenderWorld,
): Walker[] {
  const palette = readPalette();
  const coats = [
    palette.concrete,
    palette.power,
    palette.materials,
    palette.production,
  ];
  const ids = new Set(citizens.map((c) => c.id));
  const nodes = [...world.streets.nodes.values()];
  if (!nodes.length) return [];
  const next = walkers.filter(
    (w) => w.ambient || (w.person && ids.has(w.person.id)),
  );
  const create = (i: number, person?: Citizen): Walker => {
    const value = person
      ? [...person.id].reduce((sum, c) => sum + c.charCodeAt(0), 0)
      : i;
    const owned = person && nodes.find((n) => n.stop && n.owner === person.id);
    const sidewalk = nodes.filter((n) => n.plotId === undefined);
    const spawn = sidewalk.length ? sidewalk : nodes;
    const p = owned || spawn[(i * 7) % spawn.length]!;
    return {
      x: p.x,
      y: p.y,
      tx: p.x,
      ty: p.y,
      node: p.id,
      phase: value * 0.31,
      color: coats[value % coats.length]!,
      person,
      ambient: !person,
      wait: i * 0.12,
    };
  };
  if (!next.some((w) => w.ambient))
    for (let i = 0; i < 24; i++) next.push(create(i));
  for (const citizen of citizens)
    if (!next.some((w) => w.person?.id === citizen.id))
      next.push(create(next.length, citizen));
  for (const w of next) {
    // Rehome only when construction invalidates the occupied path, not on ticks.
    if (
      !w.node ||
      !world.streets.nodes.has(w.node) ||
      (w.target && !world.streets.neighbors.get(w.node)?.includes(w.target))
    ) {
      const p = nodes.reduce((best, n) =>
        Math.hypot(n.x - w.x, n.y - w.y) <
        Math.hypot(best.x - w.x, best.y - w.y)
          ? n
          : best,
      );
      Object.assign(w, {
        x: p.x,
        y: p.y,
        tx: p.x,
        ty: p.y,
        node: p.id,
        target: undefined,
        route: [],
        moving: false,
      });
    }
    if (w.route?.some((id) => !world.streets.nodes.has(id))) w.route = [];
  }
  return next;
}

// Movement follows the same graph used to paint sidewalks and crossings.
export function advanceWalkers(
  walkers: Walker[],
  world: RenderWorld,
  dt: number,
) {
  const layout = world.streets;
  for (const w of walkers) {
    w.moving = false;
    if ((w.wait ?? 0) > 0) {
      w.wait = Math.max(0, w.wait! - dt);
      continue;
    }
    if (!w.node) continue;
    if (!w.target) {
      if (!w.route?.length) {
        w.trips = (w.trips ?? 0) + 1;
        const stops = [...layout.nodes.values()].filter(
          (n) => n.stop && n.id !== w.node,
        );
        const owned =
          w.person &&
          w.trips % 3 === 1 &&
          stops.find((n) => n.owner === w.person!.id);
        const destination =
          owned ||
          stops[
            Math.abs(Math.floor(w.phase * 100 + w.trips * 7)) % stops.length
          ];
        w.route = destination
          ? walkingRoute(layout, w.node, destination.id)
          : [];
        if (!w.route.length) {
          const options = layout.neighbors.get(w.node) ?? [];
          const next =
            options[
              Math.abs(Math.floor(w.phase * 100 + w.trips)) % options.length
            ];
          if (next) w.route = [next];
        }
      }
      const next = w.route.shift();
      if (!next || !layout.neighbors.get(w.node)?.includes(next)) {
        w.route = [];
        continue;
      }
      w.target = next;
      const p = layout.nodes.get(next)!;
      w.tx = p.x;
      w.ty = p.y;
    }
    const distance = Math.hypot(w.tx - w.x, w.ty - w.y),
      step = Math.min(distance, Math.max(0, dt) * 0.4);
    if (distance > 0) {
      w.x += ((w.tx - w.x) / distance) * step;
      w.y += ((w.ty - w.y) / distance) * step;
      w.moving = true;
    }
    if (step === distance) {
      w.x = w.tx;
      w.y = w.ty;
      w.node = w.target;
      w.target = undefined;
      if (layout.nodes.get(w.node!)?.stop) {
        w.wait = 2 + ((w.trips ?? 0) % 5);
        w.moving = false;
      }
    }
  }
}
