import { volume, type AssemblyPart } from './model';
type Point3 = [number, number, number];

/** Moving contact geometry shares the freight travel datum above two stock tiers. */
export function gantryHoist(
  part: AssemblyPart,
  active: boolean,
  time: number,
  variant: number,
) {
  const { x, y, z, w, d, h } = part.volume;
  const xx =
    x + w / 2 + (active ? Math.sin(time * 0.45 + variant) * (w / 2 - 1) : 0);
  return {
    x: xx,
    ropeTop: [xx, y + d / 2, z + h - 0.75] as Point3,
    ropeBottom: [xx, y + d / 2, z + 2.81] as Point3,
    block: volume(xx - 0.16, y + d / 2 - 0.1, z + 2.65, 0.32, 0.2, 0.16),
    hook: [
      [xx - 0.1, y + d / 2, z + 2.65],
      [xx - 0.1, y + d / 2, z + 2.52],
      [xx + 0.1, y + d / 2, z + 2.52],
    ] as Point3[],
  };
}
