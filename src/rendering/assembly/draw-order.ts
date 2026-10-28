import type { AssemblyPart, BuildingAssembly } from './model';

// Support parents are painted first. Independent kit bays are painted back to
// front within the fixed isometric camera; layer names never determine occlusion.
export function assemblyDrawOrder(a: BuildingAssembly): AssemblyPart[] {
  const pending = [...a.parts],
    result: AssemblyPart[] = [],
    done = new Set<string>();
  while (pending.length) {
    const eligible = pending.filter(
      (p) =>
        !p.mount || done.has(a.mounts.find((m) => m.id === p.mount)!.support),
    );
    if (!eligible.length) throw new Error('Cyclic assembly supports');
    eligible.sort((p, q) => {
      const depth = (p: AssemblyPart) =>
        p.volume.x +
        p.volume.w / 2 +
        p.volume.y +
        p.volume.d / 2 +
        p.volume.z * 0.35;
      return depth(p) - depth(q) || p.id.localeCompare(q.id);
    });
    const next = eligible[0]!;
    pending.splice(pending.indexOf(next), 1);
    result.push(next);
    done.add(next.id);
  }
  return result;
}
