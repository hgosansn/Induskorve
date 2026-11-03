import type { AssemblyInput } from './model';
import { isCivicKind, type BuildingKind } from '../../domain/city/model';
import { civicBuildingForm } from './civic';

export const BUILDING_FORMS = {
  block: {
    label: 'Wide hall',
    description:
      'A broad, low process hall with a continuous roof and clear equipment aisle.',
  },
  stepped: {
    label: 'Terraces',
    description:
      'Connected setbacks provide daylight and accessible service terraces above the process floor.',
  },
  tower: {
    label: 'Slender tower',
    description:
      'A narrow occupied core rises above a low process podium and electrical service deck.',
  },
} as const;

export function architectureForms(kind: BuildingKind) {
  if (!isCivicKind(kind)) return BUILDING_FORMS;
  const names =
    kind === 'shop'
      ? ['Single shop', 'Shop row', 'Corner shop']
      : kind === 'skyscraper'
        ? ['Wide podium', 'Stepped crown', 'Slender shaft']
        : ['Apartment block', 'Terraced homes', 'Apartment tower'];
  return Object.fromEntries(
    (['block', 'stepped', 'tower'] as const).map((shape, i) => [
      shape,
      {
        label: names[i]!,
        description:
          kind === 'shop'
            ? 'A low shopfront with a sheltered entrance and a clear pedestrian apron.'
            : 'Occupied floors sit above a continuous grounded podium; windows and terraces follow the building structure.',
      },
    ]),
  ) as Record<
    keyof typeof BUILDING_FORMS,
    { label: string; description: string }
  >;
}

// Saved shape values stay compatible. Legacy buildings get all three families.
export function buildingShape(b: AssemblyInput) {
  return (
    b.design?.shape ??
    (b.variant < 0.34 ? 'block' : b.variant < 0.68 ? 'stepped' : 'tower')
  );
}

/** One floorplan contract for hall proportions, equipment bays and pipe lanes. */
export function buildingForm(b: AssemblyInput) {
  if (isCivicKind(b.type)) return civicBuildingForm(b);
  const shape = buildingShape(b);
  const variation = (Math.round(b.variant * 10000) % 101) / 100;
  const freight = b.type === 'warehouse';
  const width =
    shape === 'block'
      ? freight
        ? 10
        : 6.7
      : shape === 'tower'
        ? freight
          ? 6
          : 4.8
        : freight
          ? 8
          : 5.8;
  const hallW = width + variation * 0.4;
  const heightFactor = shape === 'block' ? 0.65 : shape === 'tower' ? 1.65 : 1;
  const hallH = Math.max(3.5, (b.h / 8) * heightFactor) * (freight ? 0.75 : 1);
  const hallRight = 0.8 + hallW;
  const equipmentX = hallRight + 0.8;
  return {
    shape,
    hallW,
    hallH,
    hallD: freight ? 6.7 : 7.2,
    hallRight,
    equipmentX,
    equipmentW: freight ? 0 : Math.min(3.1, 11.1 - equipmentX),
    pipeX: hallRight + 0.4,
  };
}
