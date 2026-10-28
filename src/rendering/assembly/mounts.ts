import { cityMassing, levelHeight } from '../generation/city-massing';
import {
  volume,
  type AssemblyInput,
  type Mount,
  type PartKind,
  type Volume,
} from './model';

export function assemblyDimensions(b: AssemblyInput) {
  const floor = 0.8;
  const hallH = Math.max(3.5, b.h / 8) * (b.type === 'warehouse' ? 0.75 : 1);
  return {
    floor,
    hallH,
    hallW: b.type === 'warehouse' ? 10.4 : b.type === 'factory' ? 6.3 : 6,
    hallD: b.type === 'warehouse' ? 6.7 : 7.2,
    roof: floor + hallH,
    gridX:
      0.9 +
      (b.type === 'warehouse' ? 10.4 : b.type === 'factory' ? 6.3 : 6) * 0.6,
    gridY: 0.9,
  };
}

// The floorplan owns mounting locations before any optional equipment is fitted.
// Empty bays remain reserved. Parts cannot invent sockets or move their supports.
export function buildingMounts(b: AssemblyInput): Mount[] {
  const { floor, hallH, hallW, hallD, roof, gridX, gridY } =
    assemblyDimensions(b);
  const hall = volume(0.8, 0.8, floor, hallW, hallD, hallH);
  const massing = cityMassing(b, hall);
  const terrace = floor + massing.podium;
  const equipmentLevel =
    floor + levelHeight(massing, Math.max(1, massing.levels - 2));
  const mounts: Mount[] = [];
  const bay = (
    id: string,
    accepts: PartKind[],
    v: Volume,
    support = 'base',
    face: Mount['face'] = 'top',
  ) => mounts.push({ id: `${id}-mount`, accepts, volume: v, support, face });
  bay('hall', ['hall'], volume(0.8, 0.8, floor, hallW, hallD, hallH));
  bay('grid', ['grid'], volume(gridX, gridY, roof, 1.7, 1.4, 2.7), 'hall');
  bay('terminal', ['terminal'], volume(10.7, 10.7, floor, 0.6, 0.6, 1.3));
  bay(
    'catwalk',
    ['catwalk'],
    volume(0.8, 0.8 + hallD - 0.3, terrace, hallW, 0.3, 0.75),
    'hall',
  );
  bay(
    'ladder',
    ['ladder'],
    volume(0.85, 0.8 + hallD, floor, 0.55, 0.09, massing.podium),
    'hall',
    'front',
  );
  if (b.type === 'power') {
    bay(
      'cooler',
      ['cooler'],
      volume(7.9, 1.1, floor, 3.1, 3.1, Math.max(5.5, hallH + 0.6)),
    );
    bay('extra-turbine', ['turbine'], volume(7.9, 5.1, floor, 3.1, 2.8, 3.2));
    bay('heat-recovery', ['exchanger'], volume(7.9, 8.9, floor, 2.6, 1.6, 2.4));
  } else if (b.type === 'factory') {
    bay(
      'daylight',
      ['skylights'],
      volume(
        0.9,
        0.9 + hallD * 0.4,
        equipmentLevel,
        hallW * 0.4 - 0.2,
        hallD * 0.2 - 0.2,
        1.2,
      ),
      'hall',
    );
    bay(
      'extraction',
      ['stack', 'scrubber'],
      volume(8.1, 1.1, floor, 2.8, 3, hallH + 3.2),
    );
    bay('second-furnace', ['furnace'], volume(8.1, 5.5, floor, 2.8, 2.5, 3.5));
  } else {
    bay(
      'solar',
      ['solar'],
      volume(
        0.9 + hallW * 0.6,
        0.9 + hallD * 0.4,
        equipmentLevel,
        hallW * 0.4 - 0.2,
        hallD * 0.4 - 0.2,
        1,
      ),
      'hall',
    );
    bay('gantry', ['gantry'], volume(1, 8.8, floor, 9.7, 1.8, hallH + 1));
    for (let i = 0; i < 8; i++)
      bay(
        `cargo-${i}`,
        ['cargo'],
        volume(
          2 + (i % 4) * 1.9,
          9,
          floor + Math.floor(i / 4) * 1.2,
          1.6,
          1.4,
          1.2,
        ),
        i >= 4 ? `cargo-${i - 4}` : 'base',
      );
  }
  return mounts;
}
