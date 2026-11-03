import type { BuildingAssembly, Volume } from '../../rendering/assembly/model';
import type { Palette } from '../../rendering/palette';

type Point3 = [number, number, number];
export const STUDY_VIEWS = [
  'front',
  'right',
  'back',
  'left',
  'top',
  'isometric',
] as const;
export type StudyView = (typeof STUDY_VIEWS)[number];
const directions: Record<StudyView, Point3> = {
  front: [0, 1, 0],
  right: [1, 0, 0],
  back: [0, -1, 0],
  left: [-1, 0, 0],
  top: [0, 0, 1],
  isometric: [1, 1, 1],
};

// These projections inspect the actual assembly solids, not invented rear artwork.
export function projectStudy(
  [x, y, z]: Point3,
  view: StudyView,
): [number, number] {
  switch (view) {
    case 'front':
      return [x, -z];
    case 'back':
      return [-x, -z];
    case 'right':
      return [-y, -z];
    case 'left':
      return [y, -z];
    case 'top':
      return [x, -y];
    case 'isometric':
      return [x - y, (x + y) * 0.5 - (z * 4) / 3];
  }
}
function faces(v: Volume) {
  const { x, y, z } = v,
    X = x + v.w,
    Y = y + v.d,
    Z = z + v.h;
  return [
    {
      normal: [0, 0, 1],
      points: [
        [x, y, Z],
        [X, y, Z],
        [X, Y, Z],
        [x, Y, Z],
      ],
    },
    {
      normal: [1, 0, 0],
      points: [
        [X, y, z],
        [X, Y, z],
        [X, Y, Z],
        [X, y, Z],
      ],
    },
    {
      normal: [0, 1, 0],
      points: [
        [x, Y, z],
        [X, Y, z],
        [X, Y, Z],
        [x, Y, Z],
      ],
    },
    {
      normal: [-1, 0, 0],
      points: [
        [x, y, z],
        [x, Y, z],
        [x, Y, Z],
        [x, y, Z],
      ],
    },
    {
      normal: [0, -1, 0],
      points: [
        [x, y, z],
        [X, y, z],
        [X, y, Z],
        [x, y, Z],
      ],
    },
  ] as { normal: Point3; points: Point3[] }[];
}
const dot = (a: Point3, b: Point3) =>
  a.reduce((sum, n, i) => sum + n * b[i]!, 0);
export function SolidView({
  assembly,
  view,
  palette: p,
}: {
  assembly: BuildingAssembly;
  view: StudyView;
  palette: Palette;
}) {
  const direction = directions[view];
  const polygons = assembly.parts
    .flatMap((part) =>
      part.solids.flatMap((solid) =>
        faces(solid)
          .filter((face) => dot(face.normal, direction) > 0)
          .map((face) => ({
            ...face,
            part,
            depth:
              face.points.reduce(
                (sum, point) => sum + dot(point, direction),
                0,
              ) / 4,
            projected: face.points.map((point) => projectStudy(point, view)),
          })),
      ),
    )
    .sort((a, b) => a.depth - b.depth);
  const points = polygons.flatMap((face) => face.projected);
  const minX = Math.min(...points.map((p) => p[0])),
    maxX = Math.max(...points.map((p) => p[0]));
  const minY = Math.min(...points.map((p) => p[1])),
    maxY = Math.max(...points.map((p) => p[1]));
  const pad = 1.5;
  return (
    <svg
      data-view={view}
      role="img"
      aria-label={`${view} assembly solids`}
      viewBox={`${minX - pad} ${minY - pad} ${maxX - minX + 2 * pad} ${maxY - minY + 2 * pad}`}
      className="h-96 w-full bg-background"
    >
      {polygons.map((face, i) => (
        <polygon
          key={i}
          points={face.projected.map((p) => p.join(',')).join(' ')}
          fill={
            face.part.layer === 'shell'
              ? face.normal[2]
                ? p['concrete-shadow']
                : p.steel
              : face.part.layer === 'foundation'
                ? p.surface
                : face.part.layer === 'services'
                  ? p.power
                  : assembly.family === 'factory'
                    ? p.production
                    : p.materials
          }
          stroke={p.ink}
          strokeWidth={0.035}
        >
          <title>
            {face.part.label} — {face.part.purpose}
          </title>
        </polygon>
      ))}
    </svg>
  );
}
