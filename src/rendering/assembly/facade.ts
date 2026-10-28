import { volume, type AssemblyInput, type Volume } from './model';

export interface FacadeSurface {
  x: number;
  y: number;
  z: number;
  width: number;
  height: number;
}
export interface FacadeBay {
  face: 'front' | 'right';
  start: number;
  width: number;
  z: number;
  height: number;
  glazing: boolean;
  lit: boolean;
  panel: number;
}
export interface FacadeFloor {
  index: number;
  body: Volume;
  slab: Volume;
  bays: FacadeBay[];
}
export interface HallFacade {
  profile: 'block' | 'stepped' | 'tower';
  floors: FacadeFloor[];
  columns: Volume[];
  roof: Volume;
  spine: Volume;
  display: FacadeSurface;
}

// Stable facade variation follows architectural bays; never sample frame time or world position.
function sample(seed: number, floor: number, bay: number, face: number) {
  const n =
    Math.sin(seed * 971 + floor * 127 + bay * 43 + face * 337) * 43758.5453;
  return n - Math.floor(n);
}
export function composeFacade(b: AssemblyInput, v: Volume): HallFacade {
  const profile = b.design?.shape ?? (b.variant > 0.67 ? 'tower' : 'stepped');
  const roof = volume(v.x, v.y, v.z + v.h - 0.2, v.w, v.d, 0.2);
  const usable = v.h - 0.2,
    ground = Math.min(3.1, usable);
  const upperCount =
    usable - ground > 0.8
      ? Math.max(1, Math.floor((usable - ground) / 1.7))
      : 0;
  const count = upperCount + 1,
    groundH = upperCount ? ground : usable;
  const heights = [
    groundH,
    ...Array.from({ length: upperCount }, () => (usable - ground) / upperCount),
  ];
  let z = v.z;
  const floors: FacadeFloor[] = heights.map((h, index) => {
    const inset =
      index === 0
        ? 0.12
        : profile === 'block'
          ? 0.18
          : profile === 'stepped'
            ? Math.min(1.05, index * 0.36)
            : 0.85 + (index === count - 1 ? 0.2 : 0);
    const body = volume(v.x, v.y, z, v.w - inset, v.d - inset, h - 0.16);
    const slab = volume(
      v.x,
      v.y,
      z + h - 0.16,
      Math.min(v.w, body.w + 0.12),
      Math.min(v.d, body.d + 0.12),
      0.16,
    );
    const bays: FacadeBay[] = [];
    // The ground floor keeps full-height process/loading doors. Upper floors carry occupied galleries.
    for (const face of ['front', 'right'] as const) {
      const length = face === 'front' ? body.w : body.d;
      const first = face === 'front' ? 0.8 : length * 0.67;
      const available = length - first - 0.35;
      const bayCount = Math.max(1, Math.floor(available / 1.1));
      const pitch = available / bayCount;
      for (let i = 0; i < bayCount; i++) {
        const glazing = index > 0 || h > 2.6;
        const windowH = index === 0 ? 0.22 : Math.min(0.68, h * 0.38);
        bays.push({
          face,
          start: first + i * pitch + 0.08,
          width: Math.max(0.2, pitch - 0.16),
          z: z + (index === 0 ? h - 0.48 : h * 0.42),
          height: windowH,
          glazing:
            glazing &&
            (index === 0 ||
              sample(b.variant, index, i, face === 'front' ? 0 : 1) > 0.2),
          lit: sample(b.variant, index, i, face === 'front' ? 2 : 3) > 0.37,
          panel: Math.floor(
            sample(b.variant, index, i, face === 'front' ? 4 : 5) * 3,
          ),
        });
      }
    }
    z += h;
    return { index, body, slab, bays };
  });
  // Exposed corner columns carry floor outriggers and the full roof above recessed infill.
  const columns = [
    volume(v.x + 0.1, v.y + v.d - 0.22, v.z, 0.2, 0.2, v.h - 0.2),
    volume(v.x + v.w - 0.22, v.y + v.d - 0.22, v.z, 0.2, 0.2, v.h - 0.2),
    volume(v.x + v.w - 0.22, v.y + 0.1, v.z, 0.2, 0.2, v.h - 0.2),
  ];
  const spine = volume(
    v.x + v.w - 0.24,
    v.y + 0.3,
    v.z + 0.2,
    0.24,
    v.d * 0.6,
    v.h - 0.6,
  );
  return {
    profile,
    floors,
    columns,
    roof,
    spine,
    display: {
      x: v.x + v.w,
      y: spine.y + 0.12,
      z: spine.z + 0.15,
      width: spine.d - 0.24,
      height: spine.h - 0.3,
    },
  };
}
