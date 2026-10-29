import { cityMassing, massingSolids } from '../generation/city-massing';
import { assemblyDimensions, buildingMounts } from './mounts';
import { hasModule } from '../../domain/city/catalog';
import {
  volume,
  type AssemblyInput,
  type AssemblyPart,
  type BuildingAssembly,
  type PartKind,
  type Service,
  type Port,
} from './model';

export function composeBuilding(b: AssemblyInput): BuildingAssembly {
  const a: BuildingAssembly = {
    family: b.type,
    parts: [],
    mounts: buildingMounts(b),
    ports: [],
    routes: [],
    clearances: [],
  };
  const { floor, hallH, hallW, hallRight, equipmentX, pipeX } =
    assemblyDimensions(b);
  const add = (
    id: string,
    kind: PartKind,
    label: string,
    purpose: string,
    layer: AssemblyPart['layer'],
    module?: AssemblyPart['module'],
  ) => {
    const mount = a.mounts.find((m) => m.id === `${id}-mount`);
    if (id !== 'base' && (!mount || !mount.accepts.includes(kind)))
      throw new Error(`Invalid kit mount: ${id}/${kind}`);
    const v = mount
      ? { ...mount.volume }
      : volume(0.3, 0.3, 0, 11.4, 11.4, floor);
    const p: AssemblyPart = {
      id,
      kind,
      label,
      purpose,
      layer,
      volume: v,
      solids: [v],
      mount: mount?.id,
      module,
    };
    a.parts.push(p);
    return p;
  };
  add(
    'base',
    'foundation',
    'Foundation and apron',
    'Individual footings carry the hall and ground-mounted equipment. The surrounding apron stays at street level.',
    'foundation',
  );
  const hall = add(
    'hall',
    'hall',
    b.type === 'power'
      ? 'Generator hall'
      : b.type === 'factory'
        ? 'Melting hall'
        : 'Storage hall',
    b.type === 'power'
      ? 'Encloses the primary turbine and generator. Cooling and electrical equipment connect to its side.'
      : b.type === 'factory'
        ? 'Encloses the primary furnace and casting floor. Extraction leaves through the side duct.'
        : 'Shelters inventory behind three loading doors. The apron gives each door an approach.',
    'shell',
  );
  const massing = cityMassing(b, hall.volume);
  hall.solids = massingSolids(massing, hall.volume);
  const grid = add(
    'grid',
    'grid',
    'Electrical rack',
    'Connects the building to the yellow grid wires through physical insulators.',
    'services',
  );
  const terminal = add(
    'terminal',
    'terminal',
    'Logistics terminal',
    'Marks the logistics link at the apron edge. The blue flow is a network indicator, not a metal conveyor.',
    'services',
  );
  const port = (
    id: string,
    part: AssemblyPart,
    service: Service,
    direction: Port['direction'],
    point: Port['point'],
  ) => {
    a.ports.push({ id, part: part.id, service, direction, point });
    return id;
  };
  port('grid', grid, 'power', b.type === 'power' ? 'out' : 'in', [
    grid.volume.x + grid.volume.w / 2,
    grid.volume.y + grid.volume.d / 2,
    grid.volume.z + grid.volume.h,
  ]);
  port(
    'logistics',
    terminal,
    'logistics',
    b.type === 'warehouse' ? 'out' : 'in',
    [11, 11, floor + 1.3],
  );
  port('heat', hall, 'heat', b.type === 'power' ? 'out' : 'in', [
    hallRight,
    7.4,
    floor + 1.1,
  ]);
  const route = (
    id: string,
    from: string,
    to: string,
    via: Port['point'][] = [],
  ) => {
    const source = a.ports.find((p) => p.id === from)!,
      sink = a.ports.find((p) => p.id === to)!;
    a.routes.push({
      id,
      from,
      to,
      service: source.service,
      points: [source.point, ...via, sink.point],
    });
  };
  if (b.type === 'power') {
    const cooler = add(
      'cooler',
      'cooler',
      'Cooling cell',
      'Rejects heat from the generator cooling loop. Mounted on the foundation, with an unobstructed upward outlet.',
      'machinery',
    );
    port('coolant-out', hall, 'coolant', 'out', [hallRight, 2.6, floor + 1.2]);
    port('coolant-in', cooler, 'coolant', 'in', [equipmentX, 2.6, floor + 1.2]);
    route('cooling-feed', 'coolant-out', 'coolant-in');
    port('coolant-return', cooler, 'coolant', 'out', [
      equipmentX,
      3.3,
      floor + 0.6,
    ]);
    port('coolant-return-in', hall, 'coolant', 'in', [
      hallRight,
      3.3,
      floor + 0.6,
    ]);
    route('cooling-return', 'coolant-return', 'coolant-return-in');
    if (hasModule(b, 'turbine')) {
      const turbine = add(
        'extra-turbine',
        'turbine',
        'Extra turbine enclosure',
        'Adds a second generating unit in a dedicated ground bay, connected back to the electrical bus.',
        'modules',
        'turbine',
      );
      port('turbine-out', turbine, 'power', 'out', [
        equipmentX,
        6.5,
        floor + 1,
      ]);
      port('bus-in', hall, 'power', 'in', [hallRight, 6.5, floor + 1]);
      route('turbine-bus', 'turbine-out', 'bus-in');
    }
    if (hasModule(b, 'heat-exchanger')) {
      const exchanger = add(
        'heat-recovery',
        'exchanger',
        'Heat exchanger',
        'Transfers recoverable heat into the copper service loop; it occupies its own ground skid.',
        'modules',
        'heat-exchanger',
      );
      port('heat-recovery-in', exchanger, 'heat', 'in', [
        equipmentX,
        9.7,
        floor + 1.1,
      ]);
      route('heat-recovery-feed', 'heat', 'heat-recovery-in', [
        [pipeX, 7.4, floor + 1.1],
        [pipeX, 9.7, floor + 1.1],
      ]);
      port('heat-export', exchanger, 'heat', 'out', [
        exchanger.volume.x + exchanger.volume.w,
        9.7,
        floor + 1.1,
      ]);
    }
  } else if (b.type === 'factory') {
    add(
      'daylight',
      'skylights',
      'Sawtooth rooflights',
      'Brings daylight into the melting hall. Its roof strip is reserved; no machinery can be mounted through the glazing.',
      'shell',
    );
    const scrubbed = hasModule(b, 'scrubber');
    const exhaust = add(
      'extraction',
      scrubbed ? 'scrubber' : 'stack',
      scrubbed ? 'Exhaust treatment' : 'Extraction stack',
      scrubbed
        ? 'Receives furnace fumes through the side duct and reduces the local emissions footprint.'
        : 'Routes captured furnace fumes to an elevated outlet. The scrubber replaces this unit in the same bay.',
      scrubbed ? 'modules' : 'machinery',
      scrubbed ? 'scrubber' : undefined,
    );
    port('fumes-out', hall, 'exhaust', 'out', [hallRight, 2.6, floor + 2]);
    port('fumes-in', exhaust, 'exhaust', 'in', [equipmentX, 2.6, floor + 2]);
    route('extraction-duct', 'fumes-out', 'fumes-in');
    if (hasModule(b, 'furnace')) {
      const furnace = add(
        'second-furnace',
        'furnace',
        'Second furnace bay',
        'Adds a separate melting chamber on the foundation. Its exhaust joins the same extraction unit.',
        'modules',
        'furnace',
      );
      port('second-fumes-out', furnace, 'exhaust', 'out', [
        equipmentX,
        6.4,
        floor + 2,
      ]);
      port('second-fumes-in', exhaust, 'exhaust', 'in', [
        equipmentX,
        3.3,
        floor + 2,
      ]);
      route('second-extraction', 'second-fumes-out', 'second-fumes-in', [
        [pipeX, 6.4, floor + 2],
        [pipeX, 3.3, floor + 2],
      ]);
    }
  } else {
    if (hasModule(b, 'solar-roof'))
      add(
        'solar',
        'solar',
        'Solar rack',
        'Generates supplemental electricity. Low rails support the panels above the roof without occupying the access lane.',
        'modules',
        'solar-roof',
      );
    const count = Math.min(8, Math.ceil((b.stock ?? 0) / 50));
    for (let i = 0; i < count; i++) {
      add(
        `cargo-${i}`,
        'cargo',
        'Stored metal',
        `Inventory stack ${i + 1}. Appears only when the warehouse contains metal.`,
        'machinery',
      );
    }
    if (hasModule(b, 'loading-bay')) {
      const gantry = add(
        'gantry',
        'gantry',
        'Loading gantry',
        'Two legs support an overhead beam. The open span keeps the stock and loading approach accessible.',
        'modules',
        'loading-bay',
      );
      const v = gantry.volume;
      gantry.solids = [
        volume(v.x, v.y + 0.2, v.z, 0.3, 1.4, v.h),
        volume(v.x + v.w - 0.3, v.y + 0.2, v.z, 0.3, 1.4, v.h),
        volume(v.x + 0.3, v.y + 0.2, v.z + v.h - 0.4, v.w - 0.6, 1.4, 0.4),
      ];
      a.clearances.push({
        id: 'hoist-travel',
        purpose: 'Clear travel above stored metal',
        volume: volume(
          1.4,
          8.9,
          floor + 2.5,
          8.9,
          1.6,
          Math.max(0.1, hallH - 2),
        ),
      });
    }
  }
  const accessY = hall.volume.y + hall.volume.d * 0.8 + 0.05;
  a.clearances.push({
    id: 'roof-access',
    purpose: 'Front terrace approach from ladder to internal stair core',
    volume: volume(1, accessY, floor + massing.podium, hallW - 0.4, 0.55, 2),
  });
  a.clearances.push({
    id: 'door-approach',
    purpose: 'Keep the loading doors and personnel entrance accessible',
    volume: volume(0.8, 8.1, floor, hallW, 0.6, 2.5),
  });
  if (b.design?.balcony) {
    add(
      'catwalk',
      'catwalk',
      'Roof service platform',
      'A supported deck and guardrail beside the roof edge. Access comes from the facade ladder.',
      'services',
    );
  }
  add(
    'ladder',
    'ladder',
    'Roof access ladder',
    'Connects the apron to the front terrace. The internal stair core connects the upper floors.',
    'services',
  );
  // Footings follow actual ground contact, including crane legs rather than its
  // overhead beam. Empty portions of a plot are flat ground, not a raised tile.
  a.parts[0]!.solids = a.parts
    .filter((p) => a.mounts.find((m) => m.id === p.mount)?.support === 'base')
    .flatMap((p) =>
      p.solids
        .filter((s) => Math.abs(s.z - floor) < 0.001)
        .map((s) => volume(s.x, s.y, 0, s.w, s.d, floor)),
    );
  return a;
}
const cache = new WeakMap<AssemblyInput, BuildingAssembly>();
export function buildingAssembly(b: AssemblyInput) {
  let a = cache.get(b);
  if (!a) {
    a = composeBuilding(b);
    cache.set(b, a);
  }
  return a;
}
