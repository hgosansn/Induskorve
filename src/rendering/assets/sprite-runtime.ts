import { iso } from '../canvas/geometry';
import type catalog from './parts-batch-01/catalog.json';
export type ReusablePart = Omit<(typeof catalog.parts)[number], 'ports'> & {
  ports: {
    id: string;
    point: number[];
    normal: number[];
    service: string;
    radius?: number;
  }[];
};
const urls = import.meta.glob<string>(
  ['./parts-batch-01/*.webp', './foundry-kit-01/*.webp'],
  {
    eager: true,
    query: '?url',
    import: 'default',
  },
);
const images = new Map<string, Promise<HTMLImageElement>>();
const decoded = new Map<string, HTMLImageElement>();
const failed = new Set<string>();
let revision = 0;
export const reusableSpriteRevision = () => revision;

/** Load each unique resolution once; authoring sources never enter this module. */
export function loadReusablePart(part: ReusablePart, edge: 256 | 512 = 256) {
  const file = part.variants[edge].file;
  let loaded = images.get(file);
  if (!loaded) {
    const image = new Image();
    image.src = Object.entries(urls).find(([path]) =>
      path.endsWith(`/${file}`),
    )![1];
    loaded = image.decode().then(() => {
      decoded.set(file, image);
      revision++;
      window.dispatchEvent(new Event('induskorve:asset-ready'));
      return image;
    });
    images.set(file, loaded);
    void loaded.catch(() => images.delete(file));
  }
  return loaded;
}

/** Nonblocking renderer path: retain procedural artwork until a shared sprite loads. */
export function readyReusablePart(part: ReusablePart, edge: 256 | 512 = 256) {
  const file = part.variants[edge].file;
  if (!decoded.has(file) && !failed.has(file))
    void loadReusablePart(part, edge).catch(() => failed.add(file));
  return decoded.get(file);
}

/** Native kit scale, anchored at authored XYZ origin. Caller owns depth/culling. */
export function paintReusablePart(
  ctx: CanvasRenderingContext2D,
  part: ReusablePart,
  image: HTMLImageElement,
  position: readonly [number, number, number],
  edge: 256 | 512 = 256,
) {
  const sprite = part.variants[edge];
  const [x, y] = iso(position[0] / 12, position[1] / 12, position[2] * 3);
  ctx.drawImage(
    image,
    x - sprite.origin[0]! * sprite.cityScale[0]!,
    y - sprite.origin[1]! * sprite.cityScale[1]!,
    sprite.width * sprite.cityScale[0]!,
    sprite.height * sprite.cityScale[1]!,
  );
}
