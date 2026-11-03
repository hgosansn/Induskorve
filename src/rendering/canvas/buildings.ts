import { ductBounds, paintProcessDuct } from './process-ducts';
import { paintFoundryEquipment } from './foundry-equipment';
import { paintFoundryKitPart, paintFoundryKitRoute } from './foundry-kit';
import { reusableSpriteRevision } from '../assets/sprite-runtime';
import { paintServiceEquipment } from './service-equipment';
import { paintFreightEquipment } from './freight-equipment';
import { paintPowerEquipment } from './power-equipment';
import { createModularHallRenderer } from './modular-hall';
import { createCivicHallRenderer } from './civic-buildings';
import { isCivicKind } from '../../domain/city/model';
import type { FacadeSurface } from '../assembly/model';
import type { Palette } from '../palette';
import { createGeometry, iso, type Material } from './geometry';
import {
  assemblyOffset,
  buildingGroundOffset,
  type BuildingStudy,
} from './building-layout';
import type { RenderBuilding } from './view-model';
import { buildingAssembly } from '../assembly/compose';
import { assemblyDrawOrder } from '../assembly/draw-order';
import { gantryHoist } from '../assembly/gantry-hoist';
import {
  KIT_SIZE,
  KIT_Z,
  volume,
  type AssemblyPart,
  type Volume,
} from '../assembly/model';

export type BuildingPartOverrides = ReadonlyMap<
  string,
  (
    ctx: CanvasRenderingContext2D,
    part: AssemblyPart,
    building: RenderBuilding,
    active: boolean,
    zoom: number,
  ) => void
>;

export function createBuildingRenderer(
  ctx: CanvasRenderingContext2D,
  p: Palette,
) {
  const output = ctx;
  const outputGeometry = createGeometry(output, p);
  let g = outputGeometry;
  const sprites = new WeakMap<
    RenderBuilding,
    {
      key: string;
      parts: Map<
        string,
        { image: HTMLCanvasElement; x: number; y: number; w: number; h: number }
      >;
    }
  >();
  const drawHall = createModularHallRenderer(ctx, p);
  const drawCivicHall = createCivicHallRenderer(ctx, p);
  const ordered = new WeakMap<RenderBuilding, AssemblyPart[]>();
  return (
    b: RenderBuilding,
    active: boolean,
    time: number,
    options: {
      zoom: number;
      ghost?: boolean;
      selected?: boolean;
      study?: BuildingStudy;
      partOverrides?: BuildingPartOverrides;
      facade?: (surface: FacadeSurface) => void;
    },
  ) => {
    const a = buildingAssembly(b),
      study = options.study,
      fine = options.zoom > 1.15;
    let parts = ordered.get(b);
    if (!parts) {
      parts = assemblyDrawOrder(a);
      ordered.set(b, parts);
    }
    const accent =
      b.type === 'power'
        ? p.power
        : b.type === 'factory'
          ? p.production
          : p.materials;
    const project = (x: number, y: number, z: number) =>
      iso(b.x + x / KIT_SIZE, b.y + y / KIT_SIZE, z * KIT_Z);
    const box = (v: Volume, m: Material = g.steel) =>
      g.box(
        b.x + v.x / KIT_SIZE,
        b.y + v.y / KIT_SIZE,
        v.w / KIT_SIZE,
        v.d / KIT_SIZE,
        v.z * KIT_Z,
        v.h * KIT_Z,
        m,
      );
    const line = (from: number[], to: number[], color = p.edge, width = 0.5) =>
      g.line(
        project(from[0]!, from[1]!, from[2]!),
        project(to[0]!, to[1]!, to[2]!),
        color,
        width,
      );
    const strip = (
      x: number,
      y: number,
      z: number,
      w: number,
      color = accent,
    ) => line([x, y, z], [x + w, y, z], active ? color : p.edge, 1);
    const slab = (v: Volume, height = 0.2) => box({ ...v, h: height }, g.dark);
    function drawPart(part: AssemblyPart) {
      if (paintFoundryKitPart(ctx, part, b, active)) return;
      if (paintServiceEquipment(g, part, b, active, fine)) return;
      if (paintFreightEquipment(g, part, b, active, fine)) return;
      if (paintPowerEquipment(g, part, b, active, fine)) return;
      const v = part.volume,
        { x, y, z, w, d, h } = v,
        top = z + h;
      switch (part.kind) {
        case 'hall':
          if (isCivicKind(b.type))
            drawCivicHall(b, v, active, options.zoom, options.facade);
          else drawHall(b, v, active, options.zoom, options.facade);
          break;
        case 'furnace':
        case 'stack':
        case 'scrubber':
        case 'plenum':
        case 'duct-support':
        case 'hatch':
          paintFoundryEquipment(g, part, b, active, fine);
          break;
        case 'grid':
          // Readable physical fallback while the shared cabinet sprite decodes.
          slab(v, 0.2);
          box(
            volume(x + 0.15, y + 0.15, z + 0.2, w - 0.3, d - 0.3, h * 0.5),
            g.dark,
          );
          for (const xx of [x + 0.3, x + w / 2, x + w - 0.3]) {
            line(
              [xx, y + d / 2, z + 0.2 + h * 0.5],
              [xx, y + d / 2, top],
              p['concrete-shadow'],
              0.35,
            );
            line(
              [xx, y + d / 2, top - 0.1],
              [xx, y + d / 2, top],
              active ? p.power : p.edge,
              0.45,
            );
          }
          break;
        case 'terminal':
          box(v, g.dark);
          strip(
            x + 0.08,
            y + d,
            top - 0.2,
            w - 0.16,
            active ? p.materials : p.edge,
          );
          break;
      }
    }
    function drawEffects(part: AssemblyPart) {
      const { x, y, z, w, d, h } = part.volume,
        top = z + h;
      if (part.kind === 'stack' || part.kind === 'scrubber') {
        if (active)
          for (let i = 0; i < (part.kind === 'scrubber' ? 1 : 3); i++) {
            const q = (time * 0.14 + i / 3 + b.variant) % 1;
            const pt = project(x + w / 2 + q, y + d / 2, top + 0.4 + q * 4);
            ctx.save();
            ctx.globalAlpha *= (1 - q) * 0.12;
            ctx.fillStyle = p.muted;
            ctx.beginPath();
            ctx.ellipse(...pt, 1 + q * 4, 1 + q * 2, -0.4, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }
      } else if (part.kind === 'gantry') {
        const hoist = gantryHoist(part, active, time, b.variant),
          xx = hoist.x;
        box(volume(xx - 0.4, y + 0.3, top - 0.75, 0.8, 1.2, 0.35), [
          p.steel,
          p.steel,
          p.surface,
        ]);
        strip(
          xx - 0.2,
          y + 1.505,
          top - 0.56,
          0.4,
          active ? p.materials : p.edge,
        );
        line(hoist.ropeTop, hoist.ropeBottom, p.ink, 0.4);
        line(hoist.ropeTop, hoist.ropeBottom, p.concrete, 0.16);
        box(hoist.block, g.steel);
        for (let i = 1; i < hoist.hook.length; i++)
          line(hoist.hook[i - 1]!, hoist.hook[i]!, p.concrete, 0.19);
      }
    }
    const resolution = Math.max(2, Math.min(8, Math.ceil(options.zoom * 1.5)));
    const spriteKey = `${active}/${fine}/${resolution}/${reusableSpriteRevision()}`;
    let cached = sprites.get(b);
    if (!cached || cached.key !== spriteKey) {
      cached = { key: spriteKey, parts: new Map() };
      sprites.set(b, cached);
    }
    function paintCached(id: string, v: Volume, draw: () => void) {
      let sprite = cached!.parts.get(id);
      if (!sprite) {
        const corners = [0, 1].flatMap((x) =>
          [0, 1].flatMap((y) =>
            [0, 1].map((z) =>
              project(v.x + x * v.w, v.y + y * v.d, v.z + z * v.h),
            ),
          ),
        );
        const x = Math.min(...corners.map((p) => p[0])) - 4,
          y = Math.min(...corners.map((p) => p[1])) - 4;
        const w = Math.max(...corners.map((p) => p[0])) - x + 4,
          h = Math.max(...corners.map((p) => p[1])) - y + 4;
        const image = document.createElement('canvas');
        image.width = Math.ceil(w * resolution);
        image.height = Math.ceil(h * resolution);
        const target = image.getContext('2d')!;
        target.scale(resolution, resolution);
        target.translate(-x, -y);
        ctx = target;
        g = createGeometry(target, p);
        try {
          draw();
        } finally {
          ctx = output;
          g = outputGeometry;
        }
        sprite = {
          image,
          x,
          y,
          w: image.width / resolution,
          h: image.height / resolution,
        };
        cached!.parts.set(id, sprite);
      }
      ctx.drawImage(sprite.image, sprite.x, sprite.y, sprite.w, sprite.h);
    }
    function paintPart(part: AssemblyPart) {
      const replacement = options.partOverrides?.get(part.id);
      if (replacement) {
        replacement(ctx, part, b, active, options.zoom);
        return;
      }
      if (part.kind === 'hall') drawPart(part);
      else paintCached(part.id, part.volume, () => drawPart(part));
      drawEffects(part);
    }
    function selectionWall(front: boolean) {
      if (!options.selected) return;
      const ground = buildingGroundOffset(b, study);
      const corners = [
        iso(b.x, b.y, ground),
        iso(b.x + 1, b.y, ground),
        iso(b.x + 1, b.y + 1, ground),
        iso(b.x, b.y + 1, ground),
      ];
      for (const edge of front ? [1, 2] : [0, 3]) {
        const a = corners[edge]!,
          end = corners[(edge + 1) % 4]!;
        ctx.save();
        ctx.transform(end[0] - a[0], end[1] - a[1], 0, -6, a[0], a[1]);
        const gradient = ctx.createLinearGradient(0, 0, 0, 1);
        gradient.addColorStop(0, p.foreground + '60');
        gradient.addColorStop(0.35, p.foreground + '2c');
        gradient.addColorStop(1, p.foreground + '00');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 1, 1);
        ctx.restore();
        g.line(a, end, p.foreground + '80', 0.65);
      }
    }
    selectionWall(false);
    for (const part of parts) {
      if (part.kind === 'foundation' && buildingGroundOffset(b, study) > 0)
        continue;
      if (study?.isolate && study.part !== part.id) continue;
      ctx.save();
      ctx.translate(0, -assemblyOffset(part.layer, study));
      if (options.ghost) ctx.globalAlpha *= 0.6;
      if (
        (study?.part && study.part !== part.id) ||
        (study?.focus && study.focus !== 'all' && study.focus !== part.layer)
      )
        ctx.globalAlpha *= 0.12;
      paintPart(part);
      // Short nozzles reach the bay boundary where pipe ports terminate.
      for (const port of a.ports.filter(
        (port) =>
          port.part === part.id &&
          port.service !== 'exhaust' &&
          !['cooler', 'turbine', 'exchanger'].includes(part.kind),
      )) {
        const v = part.volume,
          [x, y, z] = port.point;
        if (Math.abs(x - v.x) < 0.001)
          box(
            volume(x, y - 0.1, z - 0.1, Math.min(0.8, v.w / 2), 0.2, 0.2),
            g.steel,
          );
        else if (Math.abs(x - v.x - v.w) < 0.001)
          box(volume(x - 0.25, y - 0.1, z - 0.1, 0.25, 0.2, 0.2), g.steel);
      }
      ctx.restore();
      // Draw side ducts after the hall surface, before the equipment bays they serve.
      if (part.kind === 'hall' && !study?.exploded && !study?.isolate) {
        ctx.save();
        if (options.ghost) ctx.globalAlpha *= 0.6;
        if (study?.part || (study?.focus && study.focus !== 'all'))
          ctx.globalAlpha *= 0.2;
        for (const route of a.routes) {
          if (options.partOverrides?.has(`route:${route.id}`)) continue;
          if (route.service === 'exhaust') {
            paintCached(`route:${route.id}`, ductBounds(route), () =>
              b.type === 'factory' && paintFoundryKitRoute(ctx, route, b)
                ? undefined
                : paintProcessDuct(g, route, b),
            );
            continue;
          }
          paintCached(`route:${route.id}`, ductBounds(route), () =>
            paintProcessDuct(g, route, b),
          );
        }
        ctx.restore();
      }
    }
    selectionWall(true);
  };
}
