import atlasUrl from './pedestrians/faceless-atlas.webp';
import passingUrl from './pedestrians/passing-atlas.webp';
import type { PedestrianAppearance } from '../canvas/pedestrians';
import type { Walker } from '../canvas/view-model';

let atlas: HTMLImageElement | undefined;
let passingAtlas: HTMLImageElement | undefined;
let loading = false;
const columns: PedestrianAppearance['kind'][] = [
  'backpack',
  'toolcase',
  'coveralls',
  'long-coat',
  'hood',
  'hardhat',
];

/** One shared decoded atlas, not a separate image/cache for every citizen. */
export function paintDetailedPedestrian(
  ctx: CanvasRenderingContext2D,
  walker: Walker,
  appearance: PedestrianAppearance,
  time: number,
  facing: number,
) {
  if (!atlas && !loading && typeof Image !== 'undefined') {
    loading = true;
    const image = new Image();
    image.src = atlasUrl;
    const passing = new Image();
    passing.src = passingUrl;
    void Promise.all([image.decode(), passing.decode()])
      .then(() => {
        atlas = image;
        passingAtlas = passing;
        window.dispatchEvent(new Event('induskorve:asset-ready'));
      })
      .catch(() => {
        loading = false;
      });
  }
  if (!atlas || !passingAtlas) return false;
  const moving =
    walker.moving === true && !walker.held && (walker.wait ?? 0) <= 0;
  // Two additional passing poses bridge each stride through a neutral stance.
  // Six changes per second: a one-second cycle, independent of ground speed.
  const cycle = [1, 3, 0, 2, 4, 0];
  const row = moving
    ? cycle[Math.floor(time * 6 + (appearance.seed % 6)) % cycle.length]!
    : 0;
  const scale = appearance.height / 176;
  ctx.save();
  ctx.scale(facing, 1);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(
    row >= 3 ? passingAtlas : atlas,
    columns.indexOf(appearance.kind) * 128,
    (row >= 3 ? row - 3 : row) * 192,
    128,
    192,
    -64 * scale,
    -184 * scale,
    128 * scale,
    192 * scale,
  );
  ctx.restore();
  return true;
}
