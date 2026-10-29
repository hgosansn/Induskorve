import type { AssemblyInput } from './model';

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

// Saved shape values stay compatible. Legacy buildings get all three families.
export function buildingShape(b: AssemblyInput) {
  return (
    b.design?.shape ??
    (b.variant < 0.34 ? 'block' : b.variant < 0.68 ? 'stepped' : 'tower')
  );
}

/** One floorplan contract for hall proportions, equipment bays and pipe lanes. */
export function buildingForm(b: AssemblyInput) {
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
