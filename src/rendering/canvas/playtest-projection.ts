import {
  defaultDraft,
  type BuildingDraft,
  type WorldSnapshot,
} from '../../domain/city/model';
import {
  PLAYTEST_PLOTS,
  playtestMetrics,
  type PlaytestState,
} from '../../domain/city/playtest';
import { projectWorld, type RenderWorld } from './view-model';

export function projectPlaytest(
  s: PlaytestState,
  previous?: RenderWorld,
): RenderWorld {
  const m = playtestMetrics(s);
  const world: WorldSnapshot = {
    version: 3,
    citizens: [],
    buildings: [
      {
        id: 0,
        x: 1,
        y: 1,
        type: 'power',
        on: true,
        modules: [
          ...(s.generator ? ['turbine' as const] : []),
          ...(s.foundries.some((f) => f.heat)
            ? ['heat-exchanger' as const]
            : []),
        ],
      },
      {
        id: 1,
        x: 3,
        y: 1,
        type: 'warehouse',
        on: true,
        modules: s.handling ? ['loading-bay'] : [],
      },
      {
        id: 2,
        x: 5,
        y: 1,
        type: 'warehouse',
        on: s.completedAt !== null,
        modules: s.completedAt !== null ? ['loading-bay'] : [],
      },
      ...s.foundries.map((f) => ({
        id: f.plot + 3,
        ...PLAYTEST_PLOTS[f.plot]!,
        type: 'factory' as const,
        on: true,
        modules: f.furnace ? ['furnace' as const] : [],
      })),
    ],
    appearances: [
      {
        buildingId: 0,
        height: 42 + s.generator * 6,
        seed: 0.21,
        design: { ...defaultDraft.design, shape: 'stepped', display: 'none' },
      },
      {
        buildingId: 1,
        height: 32 + s.handling * 6,
        seed: 0.65,
        design: {
          ...defaultDraft.design,
          shape: s.handling ? 'block' : 'stepped',
          display: 'none',
        },
      },
      {
        buildingId: 2,
        height: s.completedAt === null ? 18 : 64,
        seed: 0.83,
        design: { ...defaultDraft.design, shape: 'block', display: 'none' },
      },
      ...s.foundries.map((f) => ({
        buildingId: f.plot + 3,
        height: 42 + (f.furnace ? 12 : 0),
        seed: (f.plot + 1) / 7,
        design: {
          ...defaultDraft.design,
          shape: f.shape,
          display: 'none' as const,
        },
      })),
    ],
    economy: {
      cycle: s.hour,
      stockpiles: [{ buildingId: 1, metal: s.stock }],
      shippedMetal: s.delivered,
    },
  };
  // Hourly stock/energy ticks must not invalidate every static building raster.
  for (const building of world.buildings) {
    const old = previous?.buildings.get(`${building.x},${building.y}`);
    if (!old) continue;
    if (JSON.stringify(old.modules) === JSON.stringify(building.modules))
      building.modules = old.modules;
    const appearance = world.appearances.find(
      (a) => a.buildingId === building.id,
    )!;
    if (JSON.stringify(old.design) === JSON.stringify(appearance.design))
      appearance.design = old.design;
  }
  const render = projectWorld(world, previous);
  const byId = new Map([...render.buildings.values()].map((b) => [b.id, b]));
  const generator = byId.get(0)!,
    depot = byId.get(1)!,
    terminal = byId.get(2)!;
  render.net = new Map(
    [...byId.values()].map((b) => {
      const f = s.foundries.find((f) => f.plot + 3 === b.id);
      const active =
        b.id < 2 ||
        (b.id === 2 ? s.completedAt !== null : m.powered.has(b.id - 3));
      return [
        b,
        {
          active,
          powered: active,
          load: b.id === 0 ? m.load : 0,
          stockLoad: 0,
          demand: f ? 12 + (f.furnace ? 6 : 0) : b.id === 1 ? 6 : 0,
          output: f && active ? 12 + (f.furnace ? 6 : 0) + (f.heat ? 4 : 0) : 0,
          power: b.id === 1 || f ? generator : undefined,
          storage: f ? depot : undefined,
        },
      ];
    }),
  );
  render.links = [
    { kind: 'power', from: generator, to: depot, active: true, weight: 0.5 },
  ];
  for (const f of s.foundries) {
    const building = byId.get(f.plot + 3)!,
      active = m.powered.has(f.plot);
    render.links.push(
      { kind: 'power', from: generator, to: building, active, weight: 0.5 },
      { kind: 'materials', from: building, to: depot, active, weight: 0.7 },
    );
    if (f.heat)
      render.links.push({
        kind: 'heat',
        from: generator,
        to: building,
        active,
        weight: 1,
      });
  }
  if (s.freightConnected)
    render.links.push({
      kind: 'materials',
      from: depot,
      to: terminal,
      active: true,
      weight: 1,
    });
  return render;
}
export function playtestDraft(
  shape: BuildingDraft['design']['shape'],
  plot: number,
): BuildingDraft {
  return {
    ...defaultDraft,
    height: 42,
    seed: (plot + 1) / 7,
    design: { ...defaultDraft.design, shape, display: 'none' },
  };
}
