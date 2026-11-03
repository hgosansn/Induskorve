import { useMemo } from 'react';
import { defaultDraft } from '../../domain/city/model';
import { BuildingPreview } from '../city/building-preview';
import { createGeometry, iso } from '../../rendering/canvas/geometry';
import type { BuildingPartOverrides } from '../../rendering/canvas/buildings';
import { readPalette } from '../../rendering/palette';
import { paintRetainedMesh, type MeshScene } from './mesh-view';
const study = { focus: 'all' as const, exploded: false };

function meshPainter(
  scene: MeshScene,
  assembly: boolean,
): BuildingPartOverrides extends ReadonlyMap<string, infer P> ? P : never {
  const sprites = new Map<
    boolean,
    { canvas: HTMLCanvasElement; frame: ReturnType<typeof paintRetainedMesh> }
  >();
  return (ctx, part, building, active) => {
    let sprite = sprites.get(active);
    if (!sprite) {
      const canvas = document.createElement('canvas');
      canvas.width = 768;
      canvas.height = 768;
      sprite = { canvas, frame: paintRetainedMesh(canvas, scene, 0, active) };
      sprites.set(active, sprite);
    }
    const hallRight =
      0.8 +
      (building.design?.shape === 'tower' ? 4.8 : 5.8) +
      ((Math.round(building.variant * 10000) % 101) / 100) * 0.4;
    const scale = assembly
      ? Math.min(
          2.8 / (scene.bounds.max[0]! - scene.bounds.min[0]!),
          6.9 / (scene.bounds.max[1]! - scene.bounds.min[1]!),
        )
      : 1;
    const anchor = assembly
      ? [hallRight + 0.8, 1.1, 0]
      : [part.volume.x, part.volume.y, part.volume.z];
    const origin = iso(
      building.x + anchor[0]! / 12,
      building.y + anchor[1]! / 12,
      anchor[2]! * 3,
    );
    const { frame, canvas } = sprite;
    const width = canvas.width / frame.scale,
      height = canvas.height / frame.scale;
    ctx.drawImage(
      canvas,
      origin[0] + ((frame.minH + frame.maxH) / 2 - width / 2) * scale,
      origin[1] + ((frame.minV + frame.maxV) / 2 - height / 2) * scale,
      width * scale,
      height * scale,
    );
    if (!assembly) {
      const socket = scene.sockets.find((s) => s.service === 'power');
      if (socket) {
        const end = iso(
          building.x + (anchor[0]! + socket.point[0]!) / 12,
          building.y + (anchor[1]! + socket.point[1]!) / 12,
          (anchor[2]! + socket.point[2]!) * 3,
        );
        // The supply continues beyond the inspection frame. A short floating
        // sample looked like another antenna and obscured the real termination.
        const start = [end[0] - 100, end[1] - 6];
        ctx.beginPath();
        ctx.moveTo(start[0]!, start[1]!);
        ctx.bezierCurveTo(
          start[0]! + 30,
          start[1]! + 2,
          end[0] - 12,
          end[1] + 4,
          ...end,
        );
        const p = readPalette();
        ctx.strokeStyle = active ? p.power : p.edge;
        ctx.lineWidth = 0.24;
        ctx.stroke();
      }
    }
  };
}
export function ContextView({
  scene,
  active = true,
  modulesOff = false,
}: {
  scene: MeshScene;
  active?: boolean;
  modulesOff?: boolean;
}) {
  const overrides = useMemo(() => {
    const map = new Map<
      string,
      BuildingPartOverrides extends ReadonlyMap<string, infer P> ? P : never
    >();
    if (scene.assetId === 'electrical-termination')
      map.set('grid', meshPainter(scene, false));
    else {
      map.set('extraction', meshPainter(scene, true));
      for (const id of [
        'second-furnace',
        'exhaust-plenum',
        'exhaust-stand',
        'route:hall-collection',
        'route:extraction-duct',
        'route:second-extraction',
      ])
        map.set(id, () => {});
      // The pilot assembly owns its own ground-contact feet. Preserve hall
      // foundations, and omit the legacy machinery pads from this fit study.
      map.set('base', (ctx, part) => {
        const g = createGeometry(ctx, readPalette());
        for (const v of part.solids.filter((s) => s.x < 7))
          g.box(
            v.x / 12,
            v.y / 12,
            v.w / 12,
            v.d / 12,
            v.z * 3,
            v.h * 3,
            g.dark,
          );
      });
    }
    return map;
  }, [scene]);
  return (
    <BuildingPreview
      draft={{
        ...defaultDraft,
        height: 78,
        modules: modulesOff ? [] : ['furnace', 'scrubber'],
      }}
      active={active}
      partOverrides={overrides}
      study={study}
      className="h-[520px]"
      maxZoom={8}
    />
  );
}
