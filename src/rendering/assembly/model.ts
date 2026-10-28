import type {
  BuildingDesign,
  BuildingKind,
  BuildingModule,
} from '../../domain/city/model';

// One logical tile contains a 12-unit kit. These are art units, not certified metres.
export const KIT_SIZE = 12;
export const KIT_Z = 3;
export const ASSEMBLY_LAYERS = [
  'all',
  'foundation',
  'shell',
  'machinery',
  'modules',
  'services',
] as const;
export type AssemblyLayer = (typeof ASSEMBLY_LAYERS)[number];
export interface BuildingStudy {
  exploded: boolean;
  focus: AssemblyLayer;
  part?: string;
}
export interface AssemblyInput {
  type: BuildingKind;
  h: number;
  variant: number;
  modules?: BuildingModule[];
  design?: BuildingDesign;
  stock?: number;
}
export interface FacadeSurface {
  x: number;
  y: number;
  z: number;
  width: number;
  height: number;
}
export interface Volume {
  x: number;
  y: number;
  z: number;
  w: number;
  d: number;
  h: number;
}
export type PartKind =
  | 'foundation'
  | 'hall'
  | 'control'
  | 'cooler'
  | 'turbine'
  | 'exchanger'
  | 'furnace'
  | 'stack'
  | 'scrubber'
  | 'skylights'
  | 'solar'
  | 'gantry'
  | 'cargo'
  | 'catwalk'
  | 'ladder'
  | 'grid'
  | 'terminal';
export interface Mount {
  id: string;
  support: string;
  face: 'top' | 'front';
  volume: Volume;
  accepts: PartKind[];
}
export interface AssemblyPart {
  id: string;
  kind: PartKind;
  label: string;
  purpose: string;
  layer: Exclude<AssemblyLayer, 'all'>;
  mount?: string;
  module?: BuildingModule;
  volume: Volume;
  // Empty spaces in a frame are real voids, not a collision exemption.
  solids: Volume[];
}
export type Service = 'coolant' | 'power' | 'heat' | 'exhaust' | 'logistics';
export interface Port {
  id: string;
  part: string;
  service: Service;
  direction: 'in' | 'out';
  point: [number, number, number];
}
export interface Route {
  id: string;
  from: string;
  to: string;
  service: Service;
  points: [number, number, number][];
}
export interface BuildingAssembly {
  family: BuildingKind;
  parts: AssemblyPart[];
  mounts: Mount[];
  ports: Port[];
  routes: Route[];
  clearances: { id: string; purpose: string; volume: Volume }[];
}
export const volume = (
  x: number,
  y: number,
  z: number,
  w: number,
  d: number,
  h: number,
): Volume => ({ x, y, z, w, d, h });
const EPS = 1e-6;
export const intersects = (a: Volume, b: Volume) =>
  a.x < b.x + b.w - EPS &&
  a.x + a.w > b.x + EPS &&
  a.y < b.y + b.d - EPS &&
  a.y + a.d > b.y + EPS &&
  a.z < b.z + b.h - EPS &&
  a.z + a.h > b.z + EPS;
export const contains = (outer: Volume, inner: Volume) =>
  inner.x >= outer.x - EPS &&
  inner.y >= outer.y - EPS &&
  inner.z >= outer.z - EPS &&
  inner.x + inner.w <= outer.x + outer.w + EPS &&
  inner.y + inner.d <= outer.y + outer.d + EPS &&
  inner.z + inner.h <= outer.z + outer.h + EPS;

// Geometry checks are independent of Canvas, React and the palette.
export function validateAssembly(a: BuildingAssembly): string[] {
  const errors: string[] = [];
  const parts = new Map(a.parts.map((p) => [p.id, p]));
  if (parts.size !== a.parts.length) errors.push('Duplicate part id');
  const occupied = new Set<string>();
  for (const p of a.parts) {
    if (!p.purpose.trim()) errors.push(`${p.id}: missing purpose`);
    if (!contains(volume(0, 0, 0, KIT_SIZE, KIT_SIZE, 100), p.volume))
      errors.push(`${p.id}: outside plot`);
    for (const solid of p.solids)
      if (!contains(p.volume, solid))
        errors.push(`${p.id}: solid outside envelope`);
    if (p.kind === 'foundation') continue;
    const m = a.mounts.find((m) => m.id === p.mount);
    if (!m) {
      errors.push(`${p.id}: missing mount`);
      continue;
    }
    if (occupied.has(m.id)) errors.push(`${p.id}: occupied mount`);
    occupied.add(m.id);
    if (!m.accepts.includes(p.kind)) errors.push(`${p.id}: incompatible mount`);
    if (!contains(m.volume, p.volume)) errors.push(`${p.id}: exceeds mount`);
    const supportingPart = parts.get(m.support);
    const support = supportingPart?.volume;
    if (!support || !supportingPart) {
      errors.push(`${p.id}: missing support`);
      continue;
    }
    if (m.face === 'top') {
      // A mounted pad may span multiple adjoining WFC stacks. Sum the contact
      // area of their non-overlapping top faces instead of trusting the envelope.
      const contact = supportingPart.solids.reduce((area, s) => {
        if (Math.abs(p.volume.z - s.z - s.h) > EPS) return area;
        return (
          area +
          Math.max(
            0,
            Math.min(p.volume.x + p.volume.w, s.x + s.w) -
              Math.max(p.volume.x, s.x),
          ) *
            Math.max(
              0,
              Math.min(p.volume.y + p.volume.d, s.y + s.d) -
                Math.max(p.volume.y, s.y),
            )
        );
      }, 0);
      if (
        Math.abs(contact - p.volume.w * p.volume.d) > EPS ||
        p.volume.x < support.x - EPS ||
        p.volume.x + p.volume.w > support.x + support.w + EPS ||
        p.volume.y < support.y - EPS ||
        p.volume.y + p.volume.d > support.y + support.d + EPS
      )
        errors.push(`${p.id}: unsupported top mount`);
    } else if (
      Math.abs(p.volume.y - (support.y + support.d)) > EPS ||
      p.volume.x < support.x - EPS ||
      p.volume.x + p.volume.w > support.x + support.w + EPS ||
      p.volume.z < support.z - EPS ||
      p.volume.z + p.volume.h > support.z + support.h + EPS
    )
      errors.push(`${p.id}: unsupported facade mount`);
  }
  for (let i = 0; i < a.parts.length; i++) {
    const p = a.parts[i]!;
    for (const q of a.parts.slice(i + 1))
      if (p.solids.some((s) => q.solids.some((t) => intersects(s, t))))
        errors.push(`${p.id} intersects ${q.id}`);
    for (const c of a.clearances)
      if (p.solids.some((s) => intersects(s, c.volume)))
        errors.push(`${p.id} blocks ${c.id}`);
  }
  for (const port of a.ports) {
    const owner = parts.get(port.part);
    const [x, y, z] = port.point;
    if (!owner || !contains(owner.volume, volume(x, y, z, 0, 0, 0)))
      errors.push(`${port.id}: port outside owner`);
    else {
      const v = owner.volume;
      if (
        ![
          x - v.x,
          x - v.x - v.w,
          y - v.y,
          y - v.y - v.d,
          z - v.z,
          z - v.z - v.h,
        ].some((n) => Math.abs(n) < EPS)
      )
        errors.push(`${port.id}: port not on surface`);
    }
  }
  for (const r of a.routes) {
    const from = a.ports.find((p) => p.id === r.from),
      to = a.ports.find((p) => p.id === r.to);
    if (
      !from ||
      !to ||
      from.service !== r.service ||
      to.service !== r.service ||
      from.direction !== 'out' ||
      to.direction !== 'in'
    )
      errors.push(`${r.id}: incompatible ports`);
    if (
      JSON.stringify(r.points[0]) !== JSON.stringify(from?.point) ||
      JSON.stringify(r.points.at(-1)) !== JSON.stringify(to?.point)
    )
      errors.push(`${r.id}: disconnected route`);
    for (let i = 1; i < r.points.length; i++) {
      const start = r.points[i - 1]!,
        end = r.points[i]!;
      if (start.filter((v, j) => Math.abs(v - end[j]!) > EPS).length !== 1)
        errors.push(`${r.id}: non-axial route`);
      const segment = volume(
        Math.min(start[0], end[0]),
        Math.min(start[1], end[1]),
        Math.min(start[2], end[2]),
        Math.abs(end[0] - start[0]),
        Math.abs(end[1] - start[1]),
        Math.abs(end[2] - start[2]),
      );
      // Thin centreline test, expanded on its two cross axes to cover the pipe.
      const pipe = { ...segment };
      for (const [axis, size] of [
        ['x', 'w'],
        ['y', 'd'],
        ['z', 'h'],
      ] as const)
        if (pipe[size] === 0) {
          pipe[axis] -= 0.06;
          pipe[size] = 0.12;
        }
      for (const p of a.parts)
        if (p.solids.some((s) => intersects(s, pipe)))
          errors.push(`${r.id}: pipe enters ${p.id}`);
      for (const c of a.clearances)
        if (intersects(c.volume, pipe))
          errors.push(`${r.id}: pipe blocks ${c.id}`);
    }
  }
  return [...new Set(errors)];
}
