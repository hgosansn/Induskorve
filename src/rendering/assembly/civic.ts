import {
  volume,
  type AssemblyInput,
  type AssemblyPart,
  type BuildingAssembly,
} from './model';

/** Civic architecture shares the plot and service contract, not the factory kit. */
export function civicBuildingForm(b: AssemblyInput) {
  const shape =
    b.design?.shape ??
    (b.variant < 0.34 ? 'block' : b.variant < 0.68 ? 'stepped' : 'tower');
  const shop = b.type === 'shop';
  const skyscraper = b.type === 'skyscraper';
  const height = Number.isFinite(b.h) ? Math.max(0, b.h) : 40;
  const factor = shape === 'block' ? 0.85 : shape === 'tower' ? 1.2 : 1;
  const hallW = shop ? 8.8 : skyscraper ? 7.2 : 8.4;
  const hallH = shop
    ? Math.min(5.5, Math.max(4.2, 2.5 + height / 24))
    : skyscraper
      ? Math.min(48, Math.max(20, height * 0.3 * factor))
      : Math.min(20, Math.max(5.4, height * 0.14 * factor));
  return {
    shape,
    hallW,
    hallH,
    hallD: shop ? 6.7 : 7.2,
    hallRight: 0.8 + hallW,
    equipmentX: 9.7,
    equipmentW: 0,
    pipeX: 9.5,
  };
}

/** No manufacturing, freight or heat endpoints are invented for civic uses. */
export function composeCivicBuilding(b: AssemblyInput): BuildingAssembly {
  if (!['residential', 'skyscraper', 'shop'].includes(b.type))
    throw new Error(`Not a civic building: ${b.type}`);
  const form = civicBuildingForm(b);
  const floor = 0.8;
  const hallVolume = volume(
    0.8,
    0.8,
    floor,
    form.hallW,
    form.hallD,
    form.hallH,
  );
  // The small service cabinet has its own ground bearing, independent of every
  // upper-floor setback. It never relies on an imaginary filled-in roof pad.
  const gridVolume = volume(9.7, 1, floor, 1.7, 1.4, 1.55);
  const title =
    b.type === 'shop'
      ? 'Street shop'
      : b.type === 'skyscraper'
        ? 'High-rise building'
        : 'Residential building';
  const hall: AssemblyPart = {
    id: 'hall',
    kind: 'hall',
    label: title,
    purpose:
      b.type === 'shop'
        ? 'Encloses the public shop floor, with a pedestrian entrance from the front apron.'
        : 'Encloses occupied floors and an internal circulation core, reached from the front apron.',
    layer: 'shell',
    mount: 'hall-mount',
    volume: hallVolume,
    // Conservative occupied envelope: facade recesses and upper setbacks do
    // not create validated sockets or permission to insert other equipment.
    solids: [{ ...hallVolume }],
  };
  const grid: AssemblyPart = {
    id: 'grid',
    kind: 'grid',
    label: 'Ground electrical service',
    purpose:
      'A low electrical termination on its own side footing receives the local yellow grid connection. It is an illustrative service cabinet, not a factory process.',
    layer: 'services',
    mount: 'grid-mount',
    volume: gridVolume,
    solids: [{ ...gridVolume }],
  };
  const footings = [hallVolume, gridVolume].map((v) =>
    volume(v.x, v.y, 0, v.w, v.d, floor),
  );
  return {
    family: b.type,
    parts: [
      {
        id: 'base',
        kind: 'foundation',
        label: 'Building and service footings',
        purpose:
          'Separate contact foundations carry the occupied building and electrical service. The rest of the plot stays at pedestrian ground level.',
        layer: 'foundation',
        volume: volume(0.8, 0.8, 0, 10.6, form.hallD, floor),
        solids: footings,
      },
      hall,
      grid,
    ],
    mounts: [hall, grid].map((p) => ({
      id: p.mount!,
      support: 'base',
      face: 'top',
      accepts: [p.kind],
      volume: { ...p.volume },
    })),
    ports: [
      {
        id: 'grid',
        part: 'grid',
        service: 'power',
        direction: 'in',
        point: [
          gridVolume.x + gridVolume.w / 2,
          gridVolume.y + gridVolume.d / 2,
          gridVolume.z + gridVolume.h,
        ],
      },
    ],
    routes: [],
    clearances: [
      {
        id: 'door-approach',
        purpose:
          'Keep the front pedestrian entrance and stopping bay accessible.',
        volume: volume(0.6, 8.1, 0, 9, 0.6, 2.5),
      },
      ...[
        volume(0, 0, 0, 0.6, 12, 2.5),
        volume(11.45, 0, 0, 0.55, 12, 2.5),
        volume(0, 0, 0, 12, 0.6, 2.5),
        volume(0, 11.45, 0, 12, 0.55, 2.5),
      ].map((v, i) => ({
        id: `pedestrian-margin-${i}`,
        purpose: 'Reserve the existing plot perimeter pedestrian route.',
        volume: v,
      })),
    ],
  };
}
