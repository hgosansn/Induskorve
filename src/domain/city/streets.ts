import { tileKey, type Building, type Position } from './model';

// Clockwise, starting north. Geometry and pedestrian navigation share these arms.
export const STREET_DIRECTIONS = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
] as const;
export interface StreetTile extends Position {
  arms: boolean[];
  crossings: boolean[];
}
export interface WalkNode extends Position {
  id: string;
  plotId?: number;
  owner?: string;
  stop?: boolean;
}
export interface WalkEdge {
  a: string;
  b: string;
  kind: 'sidewalk' | 'crossing' | 'plot';
}
export interface StreetLayout {
  signature: string;
  roads: Map<string, StreetTile>;
  nodes: Map<string, WalkNode>;
  neighbors: Map<string, string[]>;
  edges: WalkEdge[];
  lamps: Position[];
}

export function streetSignature(
  buildings: Iterable<Building>,
  terrain: Map<string, Position>,
) {
  return (
    [...buildings]
      .map((b) => `${b.id}:${b.x},${b.y}:${b.creatorId ?? ''}`)
      .sort()
      .join('|') +
    '/' +
    [...terrain.keys()].sort().join(';')
  );
}

export function buildStreets(
  buildings: Map<string, Building>,
  terrain: Map<string, Position>,
  signature = streetSignature(buildings.values(), terrain),
): StreetLayout {
  const layout: StreetLayout = {
    signature,
    roads: new Map(),
    nodes: new Map(),
    neighbors: new Map(),
    edges: [],
    lamps: [],
  };
  const { roads, nodes, neighbors, edges } = layout;
  for (const [key, p] of terrain)
    if (!buildings.has(key) && (p.x % 4 === 0 || p.y % 4 === 0))
      roads.set(key, { ...p, arms: [], crossings: [] });
  const add = (
    id: string,
    x: number,
    y: number,
    extra: Partial<WalkNode> = {},
  ) => {
    nodes.set(id, { id, x, y, ...extra });
    neighbors.set(id, []);
    return id;
  };
  const connect = (a: string, b: string, kind: WalkEdge['kind']) => {
    if (!nodes.has(a) || !nodes.has(b) || neighbors.get(a)!.includes(b)) return;
    neighbors.get(a)!.push(b);
    neighbors.get(b)!.push(a);
    edges.push({ a, b, kind });
  };
  const corners = [
    [0.12, 0.12],
    [0.88, 0.12],
    [0.88, 0.88],
    [0.12, 0.88],
  ];
  const sides = [
    [0.5, 0.12],
    [0.88, 0.5],
    [0.5, 0.88],
    [0.12, 0.5],
  ];
  for (const [key, road] of roads) {
    road.arms = STREET_DIRECTIONS.map(([dx, dy]) =>
      roads.has(tileKey(road.x + dx, road.y + dy)),
    );
    const straight =
      road.arms.filter(Boolean).length === 2 && road.arms[0] === road.arms[2];
    road.crossings = road.arms.map((arm) => arm && !straight);
    corners.forEach(([dx, dy], i) =>
      add(`${key}:c${i}`, road.x + dx!, road.y + dy!),
    );
    sides.forEach(([dx, dy], i) => {
      const a = `${key}:c${i}`,
        b = `${key}:c${(i + 1) % 4}`;
      if (!road.arms[i]) {
        const mid = add(`${key}:s${i}`, road.x + dx!, road.y + dy!);
        connect(a, mid, 'sidewalk');
        connect(mid, b, 'sidewalk');
      } else if (road.crossings[i]) connect(a, b, 'crossing');
    });
    if (!straight || (road.x + road.y) % 2 === 0)
      layout.lamps.push({ x: road.x + 0.08, y: road.y + 0.08 });
  }
  // Flat access paths stay outside equipment footprints. The front stopping bay
  // lies in the reserved door approach, ahead of loading cranes and cargo.
  const ring = [
    [0.04, 0.04],
    [0.5, 0.04],
    [0.96, 0.04],
    [0.96, 0.5],
    [0.96, 0.96],
    [0.5, 0.96],
    [0.04, 0.96],
    [0.04, 0.7],
    [0.04, 0.5],
  ];
  const plotSides = [1, 3, 5, 8];
  for (const [key, b] of buildings) {
    ring.forEach(([dx, dy], i) =>
      add(`${key}:p${i}`, b.x + dx!, b.y + dy!, { plotId: b.id }),
    );
    ring.forEach((_, i) =>
      connect(`${key}:p${i}`, `${key}:p${(i + 1) % ring.length}`, 'plot'),
    );
    add(`${key}:stop`, b.x + 0.45, b.y + 0.7, {
      plotId: b.id,
      owner: b.creatorId,
      stop: true,
    });
    connect(`${key}:p7`, `${key}:stop`, 'plot');
    STREET_DIRECTIONS.forEach(([dx, dy], i) => {
      const adjacent = tileKey(b.x + dx, b.y + dy),
        opposite = (i + 2) % 4;
      connect(`${key}:p${plotSides[i]}`, `${adjacent}:s${opposite}`, 'plot');
    });
  }
  // All nodes must exist before linking neighboring plots and road tiles.
  for (const [key, b] of buildings)
    STREET_DIRECTIONS.forEach(([dx, dy], i) => {
      connect(
        `${key}:p${plotSides[i]}`,
        `${tileKey(b.x + dx, b.y + dy)}:p${plotSides[(i + 2) % 4]}`,
        'plot',
      );
    });
  for (const [key, road] of roads) {
    const east = tileKey(road.x + 1, road.y),
      south = tileKey(road.x, road.y + 1);
    connect(`${key}:c1`, `${east}:c0`, 'sidewalk');
    connect(`${key}:c2`, `${east}:c3`, 'sidewalk');
    connect(`${key}:c3`, `${south}:c0`, 'sidewalk');
    connect(`${key}:c2`, `${south}:c1`, 'sidewalk');
  }
  return layout;
}

/** One bounded search when choosing a destination, never a search per frame. */
export function walkingRoute(
  layout: StreetLayout,
  start: string,
  destination: string,
): string[] {
  const previous = new Map<string, string | undefined>([[start, undefined]]),
    queue = [start];
  for (let i = 0; i < queue.length && !previous.has(destination); i++)
    for (const next of layout.neighbors.get(queue[i]!) ?? [])
      if (!previous.has(next)) {
        previous.set(next, queue[i]);
        queue.push(next);
      }
  if (!previous.has(destination)) return [];
  const route: string[] = [];
  for (
    let id: string | undefined = destination;
    id && id !== start;
    id = previous.get(id)
  )
    route.unshift(id);
  return route;
}
