import type { Citizen } from '../../domain/city/model';
import { walkingRoute } from '../../domain/city/streets';
import type { RenderWorld, Walker } from './view-model';
import { readPalette } from '../palette';
import type { Palette } from '../palette';
import { iso } from './geometry';
import { paintDetailedPedestrian } from '../assets/pedestrians';

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
    if (w.held) continue;
    const temperament = Math.abs(Math.floor(w.phase * 100));
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
    const speed = 0.16 + (temperament % 7) * 0.008;
    const distance = Math.hypot(w.tx - w.x, w.ty - w.y),
      step = Math.min(distance, Math.max(0, dt) * speed);
    if (distance > 0) {
      w.x += ((w.tx - w.x) / distance) * step;
      w.y += ((w.ty - w.y) / distance) * step;
      w.moving = true;
      w.strollTime = (w.strollTime ?? 0) + step / speed;
    }
    if (step === distance) {
      w.x = w.tx;
      w.y = w.ty;
      w.node = w.target;
      w.target = undefined;
      if (layout.nodes.get(w.node!)?.stop) {
        w.wait = 5 + ((temperament + (w.trips ?? 0)) % 7);
        w.strollTime = 0;
        w.moving = false;
      } else if ((w.strollTime ?? 0) >= 12 + (temperament % 11)) {
        // Pause at a path node (on the curb/apron), never mid-crossing.
        // Keep the remaining route so the same journey resumes afterwards.
        w.wait = 2 + ((temperament + (w.trips ?? 0)) % 5);
        w.strollTime = 0;
        w.moving = false;
      }
    }
  }
}

export interface PedestrianAppearance {
  seed: number;
  kind:
    'hardhat' | 'long-coat' | 'hood' | 'backpack' | 'coveralls' | 'toolcase';
  height: number;
  build: number;
  coat: keyof Palette;
  skin: keyof Palette;
  cadence: number;
  stride: number;
}

// Identity defines the person, never their current tile, route or frame.
export function pedestrianAppearance(walker: Walker): PedestrianAppearance {
  const identity = walker.person?.id
    ? `citizen:${walker.person.id}`
    : `ambient:${Number.isFinite(walker.phase) ? walker.phase.toPrecision(12) : '0'}`;
  let seed = 2166136261;
  for (const character of identity)
    seed = Math.imul(seed ^ character.charCodeAt(0), 16777619) >>> 0;
  const kinds: PedestrianAppearance['kind'][] = [
    'hardhat',
    'long-coat',
    'hood',
    'backpack',
    'coveralls',
    'toolcase',
  ];
  const coats: (keyof Palette)[] = [
    'steel',
    'surface',
    'concrete-shadow',
    'soot',
    'ground-alt',
    'edge',
  ];
  const skins: (keyof Palette)[] = [
    'concrete',
    'concrete-light',
    'soot',
    'concrete-shadow',
  ];
  return {
    seed,
    kind: kinds[seed % kinds.length]!,
    height: 6.7 + ((seed >>> 6) % 16) * 0.1,
    build: 0.83 + ((seed >>> 13) % 8) * 0.055,
    coat: coats[(seed >>> 17) % coats.length]!,
    skin: skins[(seed >>> 22) % skins.length]!,
    cadence: 4.4 + ((seed >>> 9) % 10) * 0.15,
    stride: 0.5 + ((seed >>> 25) % 6) * 0.06,
  };
}

export function pedestrianPose(
  walker: Walker,
  time: number,
  appearance = pedestrianAppearance(walker),
) {
  const moving = walker.moving === true && (walker.wait ?? 0) <= 0;
  const step = moving
    ? Math.sin(
        time * appearance.cadence + ((appearance.seed % 1024) * Math.PI) / 512,
      )
    : 0;
  return {
    moving,
    stride: step * appearance.stride,
    bob: moving ? Math.abs(step) * 0.12 : 0,
    leftLift: Math.max(0, step) * 0.22,
    rightLift: Math.max(0, -step) * 0.22,
  };
}

/** Static torsos/accessories are raster-cached; only a few gait strokes are
 * emitted per walker per frame. Named citizens and ambient people stay distinct. */
export function createPedestrianRenderer(
  ctx: CanvasRenderingContext2D,
  p: Palette,
): (walker: Walker, time: number) => void {
  const sprites = new Map<string, HTMLCanvasElement>();
  const identities = new WeakMap<
    Walker,
    { key: string; appearance: PedestrianAppearance; facing: number }
  >();
  const raster = 8,
    size = { w: 14, h: 15, x: 7, y: 12 };
  function body(target: CanvasRenderingContext2D, a: PedestrianAppearance) {
    const height = a.height,
      head = -height + 1,
      shoulder = head + 1.12,
      hip = -2.75;
    const half =
      a.build *
      (a.kind === 'coveralls' ? 1.25 : a.kind === 'long-coat' ? 1.15 : 1);
    const polygon = (points: [number, number][], color: string) => {
      target.beginPath();
      points.forEach(([x, y], i) =>
        i ? target.lineTo(x, y) : target.moveTo(x, y),
      );
      target.closePath();
      target.fillStyle = color;
      target.fill();
    };
    const line = (points: [number, number][], color: string, width = 0.3) => {
      target.beginPath();
      points.forEach(([x, y], i) =>
        i ? target.lineTo(x, y) : target.moveTo(x, y),
      );
      target.strokeStyle = color;
      target.lineWidth = width;
      target.stroke();
    };
    if (a.kind === 'backpack') {
      target.fillStyle = p.soot;
      target.fillRect(-half - 1.1, shoulder + 0.45, 1.25, 2.35);
      target.fillStyle = p.edge;
      target.fillRect(-half - 0.95, shoulder + 0.65, 0.7, 0.5);
    }
    if (a.kind === 'hood') {
      polygon(
        [
          [-0.9, head + 0.5],
          [-0.86, head - 0.55],
          [-0.4, head - 1.02],
          [0.38, head - 0.96],
          [0.91, head - 0.4],
          [0.87, head + 0.8],
          [0.36, shoulder + 0.2],
          [-0.64, shoulder + 0.15],
        ],
        p[a.coat],
      );
      polygon(
        [
          [-0.9, head + 0.5],
          [-0.86, head - 0.55],
          [-0.4, head - 1.02],
          [-0.2, head - 0.7],
          [-0.49, head + 0.7],
        ],
        p.surface,
      );
    }
    const hem = a.kind === 'long-coat' ? hip + 1.1 : hip + 0.12;
    polygon(
      [
        [-half * 0.55, shoulder - 0.18],
        [half * 0.55, shoulder - 0.18],
        [half, shoulder + 0.18],
        [half * 0.81, hip - 0.48],
        [half * 0.88, hem],
        [-half * 0.88, hem],
        [-half * 0.81, hip - 0.48],
        [-half, shoulder + 0.18],
      ],
      p[a.coat],
    );
    // Neck, overlapping collar and cloth construction carry detail without a face.
    target.fillStyle = p[a.skin];
    target.fillRect(-0.27, head + 0.48, 0.57, 0.55);
    polygon(
      [
        [-half * 0.62, shoulder - 0.15],
        [-0.12, shoulder + 0.38],
        [-0.35, shoulder + 0.72],
        [-half * 0.88, shoulder + 0.1],
      ],
      p.edge,
    );
    polygon(
      [
        [half * 0.55, shoulder - 0.15],
        [0, shoulder + 0.38],
        [0.28, shoulder + 0.65],
        [half * 0.85, shoulder + 0.12],
      ],
      p.surface,
    );
    line(
      [
        [0.08, shoulder + 0.6],
        [0.08, hem - 0.12],
      ],
      p.ink,
      0.12,
    );
    target.fillStyle = p.surface;
    target.fillRect(-half * 0.72, shoulder + 0.8, half * 0.58, 0.62);
    line(
      [
        [-half * 0.72, shoulder + 0.83],
        [-half * 0.14, shoulder + 0.83],
      ],
      p.edge,
      0.12,
    );
    for (const side of [-1, 1])
      line(
        [
          [side * half * 0.4, hip - 0.65],
          [side * half * 0.72, hip - 0.38],
        ],
        p.edge,
        0.12,
      );
    polygon(
      [
        [half * 0.45, shoulder + 0.1],
        [half, shoulder + 0.1],
        [half * 0.88, hem],
        [half * 0.35, hem],
      ],
      p.surface,
    );
    if (a.kind === 'long-coat') {
      line(
        [
          [0, shoulder + 0.45],
          [0, hem - 0.1],
        ],
        p.ink,
        0.25,
      );
      line(
        [
          [-half * 0.6, hip + 0.85],
          [half * 0.55, hip + 0.85],
        ],
        p.edge,
        0.2,
      );
    } else if (a.kind === 'coveralls') {
      polygon(
        [
          [-half * 0.48, shoulder + 0.5],
          [half * 0.48, shoulder + 0.5],
          [half * 0.4, hip + 0.1],
          [-half * 0.4, hip + 0.1],
        ],
        p.steel,
      );
      line(
        [
          [-half * 0.58, shoulder + 0.1],
          [-half * 0.3, shoulder + 1.2],
          [half * 0.3, shoulder + 1.2],
          [half * 0.58, shoulder + 0.1],
        ],
        p.concrete,
        0.23,
      );
    } else {
      line(
        [
          [-half * 0.82, hip - 0.15],
          [half * 0.75, hip - 0.15],
        ],
        p.edge,
        0.24,
      );
    }
    if (a.kind === 'backpack')
      line(
        [
          [-half * 0.6, shoulder + 0.1],
          [-half * 0.2, hip - 0.4],
        ],
        p['concrete-shadow'],
        0.3,
      );
    if (a.kind === 'toolcase') {
      target.fillStyle = p.steel;
      target.fillRect(-half - 1.35, hip + 0.1, 1.45, 1.25);
      line(
        [
          [-half - 1.1, hip + 0.1],
          [-half - 1.1, hip - 0.28],
          [-half - 0.4, hip - 0.28],
          [-half - 0.4, hip + 0.1],
        ],
        p['concrete-shadow'],
        0.18,
      );
    }
    // Faceted cranium, temple and jaw: deliberately no eyes, nose or mouth.
    polygon(
      [
        [-0.48, head - 0.58],
        [0.2, head - 0.7],
        [0.64, head - 0.39],
        [0.61, head + 0.34],
        [0.32, head + 0.68],
        [-0.18, head + 0.6],
        [-0.48, head + 0.17],
      ],
      p[a.skin],
    );
    polygon(
      [
        [-0.48, head - 0.58],
        [-0.19, head - 0.5],
        [-0.08, head + 0.28],
        [0.05, head + 0.59],
        [-0.18, head + 0.6],
        [-0.48, head + 0.17],
      ],
      p['concrete-shadow'],
    );
    line(
      [
        [0.08, head + 0.6],
        [0.32, head + 0.68],
        [0.61, head + 0.34],
      ],
      p.surface,
      0.1,
    );
    if (a.kind === 'hardhat' || a.kind === 'coveralls') {
      target.fillStyle = a.kind === 'hardhat' ? p.power : p['concrete-shadow'];
      target.beginPath();
      target.ellipse(0.05, head - 0.57, 0.95, 0.52, 0, Math.PI, Math.PI * 2);
      target.fill();
      target.fillRect(-1.08, head - 0.62, 2.18, 0.22);
      line(
        [
          [-0.45, head - 0.9],
          [0.03, head - 1.04],
          [0.49, head - 0.86],
        ],
        p['concrete-light'],
        0.12,
      );
    } else if (a.kind === 'toolcase') {
      target.fillStyle = p.surface;
      target.fillRect(-0.6, head - 0.88, 1.32, 0.42);
      target.fillRect(0.42, head - 0.54, 0.75, 0.15);
    } else if (a.kind !== 'hood') {
      target.fillStyle = p.soot;
      target.fillRect(-0.54, head - 0.81, 1.25, 0.38);
    }
  }
  function cachedBody(a: PedestrianAppearance, facing: number) {
    if (typeof document === 'undefined') return null;
    const key = `${a.seed}/${facing}`;
    let image = sprites.get(key);
    if (!image) {
      image = document.createElement('canvas');
      image.width = size.w * raster;
      image.height = size.h * raster;
      const target = image.getContext('2d');
      if (!target) return null;
      target.scale(raster, raster);
      target.translate(size.x, size.y);
      target.scale(facing, 1);
      body(target, a);
      // Bound memory even if many named citizens are replaced during a session.
      if (sprites.size >= 128) sprites.delete(sprites.keys().next().value!);
      sprites.set(key, image);
    }
    return image;
  }
  return (walker, time) => {
    const key = walker.person?.id
      ? `citizen:${walker.person.id}`
      : `ambient:${walker.phase}`;
    let identity = identities.get(walker);
    if (!identity || identity.key !== key) {
      const appearance = pedestrianAppearance(walker);
      identity = { key, appearance, facing: appearance.seed % 2 ? 1 : -1 };
      identities.set(walker, identity);
    }
    const a = identity.appearance,
      pose = pedestrianPose(walker, time, a);
    const heading = walker.tx - walker.x - (walker.ty - walker.y);
    if (pose.moving && Math.abs(heading) > 0.0001)
      identity.facing = heading < 0 ? -1 : 1;
    const facing = identity.facing;
    ctx.save();
    ctx.translate(...iso(walker.x, walker.y));
    ctx.save();
    ctx.globalAlpha *= 0.32;
    ctx.fillStyle = p.ink;
    ctx.beginPath();
    ctx.ellipse(0, 0, 2.15 * a.build, 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    if (paintDetailedPedestrian(ctx, walker, a, time, facing)) {
      // The procedural path is only a loading fallback; release its body rasters.
      if (sprites.size) sprites.clear();
      if (walker.person && !walker.ambient) {
        ctx.font = '2.6px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillStyle = p.foreground;
        ctx.fillText(walker.person.name, 0, -a.height - 1.25, 38);
      }
      ctx.restore();
      return;
    }
    // Legs stay attached to stable hip points. Waiting means a truly still pose.
    const step = pose.stride * facing;
    const segment = (
      from: [number, number],
      to: [number, number],
      width: number,
      color: string,
    ) => {
      ctx.beginPath();
      ctx.moveTo(...from);
      ctx.lineTo(...to);
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.lineCap = 'round';
      ctx.stroke();
    };
    for (const side of [-1, 1]) {
      const lift = side < 0 ? pose.leftLift : pose.rightLift;
      const hip: [number, number] = [side * 0.43 * a.build, -2.75 - pose.bob];
      const ankle: [number, number] = [side * 0.43 + side * step, -lift - 0.2];
      const knee: [number, number] = [
        (hip[0] + ankle[0]) * 0.5 + Math.abs(step) * 0.22 * facing,
        -1.36 - lift * 0.35,
      ];
      segment(hip, knee, 0.76 * a.build, side < 0 ? p.surface : p.steel);
      segment(knee, ankle, 0.59 * a.build, side < 0 ? p.surface : p.steel);
      segment(
        [knee[0] - 0.18, knee[1] - 0.14],
        [knee[0] + 0.17, knee[1] - 0.02],
        0.13,
        p.steel,
      );
      segment(
        [ankle[0] - 0.24, ankle[1] - 0.15],
        [ankle[0] + 0.24, ankle[1] - 0.15],
        0.2,
        p['concrete-shadow'],
      );
      // Heel, rounded toe and sole remain attached to the ankle during gait.
      segment(
        [ankle[0] - 0.13 * facing, -lift - 0.13],
        [ankle[0] + 0.48 * facing, -lift - 0.1],
        0.4,
        p.ink,
      );
      segment(
        [ankle[0] - 0.2 * facing, -lift + 0.07],
        [ankle[0] + 0.58 * facing, -lift + 0.07],
        0.12,
        p.surface,
      );
    }
    const image = cachedBody(a, facing);
    if (image)
      ctx.drawImage(image, -size.x, -size.y - pose.bob, size.w, size.h);
    else {
      ctx.save();
      ctx.translate(0, -pose.bob);
      ctx.scale(facing, 1);
      body(ctx, a);
      ctx.restore();
    }
    // Sleeves articulate through elbows; cuffs and mitten hands stay faceless.
    const shoulder = -a.height + 2.12 - pose.bob;
    const caseSide = -facing;
    const leftHand =
      a.kind === 'toolcase' && caseSide < 0
        ? caseSide * (a.build + 0.7)
        : -a.build * 0.96 - step * 0.26;
    const rightHand =
      a.kind === 'toolcase' && caseSide > 0
        ? caseSide * (a.build + 0.7)
        : a.build * 0.96 + step * 0.26;
    for (const side of [-1, 1]) {
      const root: [number, number] = [side * a.build * 0.86, shoulder + 0.2];
      const hand: [number, number] = [
        side < 0 ? leftHand : rightHand,
        (a.kind === 'toolcase' && caseSide === side ? -3.03 : -2.65) - pose.bob,
      ];
      const elbow: [number, number] = [
        root[0] + side * 0.17 + step * side * 0.1,
        (root[1] + hand[1]) * 0.5 - 0.08,
      ];
      segment(root, elbow, 0.65 * a.build, p[a.coat]);
      segment(elbow, hand, 0.48 * a.build, p[a.coat]);
      segment(
        [elbow[0] - 0.1, elbow[1]],
        [hand[0] - 0.08, hand[1] - 0.13],
        0.12,
        p.edge,
      );
      segment(
        [hand[0] - 0.23, hand[1] - 0.14],
        [hand[0] + 0.21, hand[1] - 0.14],
        0.19,
        p['concrete-shadow'],
      );
      segment(hand, [hand[0] + 0.08 * facing, hand[1] + 0.3], 0.33, p[a.skin]);
    }
    if (walker.person && !walker.ambient) {
      ctx.font = '2.6px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillStyle = p.foreground;
      ctx.fillText(walker.person.name, 0, -a.height - 1.25, 38);
    }
    ctx.restore();
  };
}
