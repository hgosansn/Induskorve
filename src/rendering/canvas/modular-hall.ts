import { cityMassing, levelHeight } from '../generation/city-massing';
import { compileWfcKit } from '../generation/wfc-kit';
import { paintWfcKit } from '../generation/draw-wfc';
import { buildingAssembly } from '../assembly/compose';
import type { FacadeSurface } from '../assembly/model';
import { KIT_SIZE, KIT_Z, type Volume } from '../assembly/model';
import type { RenderBuilding } from './view-model';
import type { Palette } from '../palette';
import { iso } from './geometry';

export function createModularHallRenderer(
  ctx: CanvasRenderingContext2D,
  p: Palette,
) {
  type Tile = {
    back: OffscreenCanvas;
    front: OffscreenCanvas;
    top: number;
    resolution: number;
    active: boolean;
  };
  const cache = new WeakMap<RenderBuilding, Tile>();
  return (
    b: RenderBuilding,
    v: Volume,
    active: boolean,
    zoom: number,
    display?: (surface: FacadeSurface) => void,
  ) => {
    const m = cityMassing(b, v);
    const resolution = Math.max(2, Math.min(8, Math.ceil(zoom * 1.5)));
    let tile = cache.get(b);
    if (!tile || tile.active !== active || tile.resolution !== resolution) {
      const bays = compileWfcKit(m.recipe, b.type),
        occupied = new Set<number>();
      for (const mount of buildingAssembly(b).mounts.filter(
        (m) => m.support === 'hall' && m.face === 'top',
      ))
        for (let y = 0; y < 5; y++)
          for (let x = 0; x < 5; x++) {
            const px = v.x + (x * v.w) / 5,
              py = v.y + (y * v.d) / 5,
              q = mount.volume;
            if (
              px < q.x + q.w &&
              px + v.w / 5 > q.x &&
              py < q.y + q.d &&
              py + v.d / 5 > q.y
            )
              occupied.add(x + y * 5);
          }
      const top = -(v.z + v.h) * KIT_Z - 5;
      const split =
        bays.findIndex((bay) => bay.x === 4 && bay.y === 1 && bay.roof) + 1;
      const render = (parts: typeof bays) => {
        const image = new OffscreenCanvas(
          60 * resolution,
          Math.ceil((34 - top) * resolution),
        );
        const target = image.getContext('2d')!;
        target.scale(resolution, resolution);
        target.translate(30, -top);
        paintWfcKit(
          target,
          m.recipe,
          p,
          ([x, y, z]) =>
            iso(
              (v.x + (x * v.w) / 5) / KIT_SIZE,
              (v.y + (y * v.d) / 5) / KIT_SIZE,
              (v.z + levelHeight(m, z)) * KIT_Z,
            ),
          {
            floors: m.levels,
            structure: false,
            lights: active,
            accent:
              b.type === 'power'
                ? p.power
                : b.type === 'factory'
                  ? p.production
                  : p.materials,
            lineScale: 0.2,
            fine: resolution > 2,
            bays: parts,
            roofOccupied: occupied,
            loading: b.type === 'warehouse',
          },
        );
        return image;
      };
      tile = {
        back: render(bays.slice(0, split)),
        front: render(bays.slice(split)),
        top,
        resolution,
        active,
      };
      cache.set(b, tile);
    }
    const origin = iso(b.x, b.y);
    const paint = (image: OffscreenCanvas) =>
      ctx.drawImage(
        image,
        origin[0] - 30,
        origin[1] + tile.top,
        image.width / tile.resolution,
        image.height / tile.resolution,
      );
    paint(tile.back);
    display?.({
      x: v.x + v.w,
      y: v.y + 0.12,
      z: v.z + 0.18,
      width: v.d * 0.4 - 0.24,
      height: levelHeight(m, m.gridLevel) - 0.36,
    });
    paint(tile.front);
    const point = (x: number, y: number, z: number) =>
      iso(b.x + x / KIT_SIZE, b.y + y / KIT_SIZE, z * KIT_Z);
    // Names sit directly on the ground-floor wall, below the modular terraces.
    if (zoom > 1.15) {
      ctx.save();
      ctx.translate(
        ...point(v.x + v.w * 0.16, v.y + v.d + 0.005, v.z + m.podium * 0.84),
      );
      ctx.transform(1, 0.5, 0, 1, 0, 0);
      ctx.fillStyle = p.concrete;
      ctx.font = 'bold 1.7px monospace';
      ctx.fillText(
        b.type === 'power'
          ? 'GRID / GENERATION'
          : b.type === 'factory'
            ? 'CAST / METAL'
            : 'HUB / FREIGHT',
        0,
        0,
      );
      ctx.restore();
    }
  };
}
