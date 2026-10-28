import { createModularHallRenderer } from './modular-hall';
import type { FacadeSurface } from '../assembly/model';
import type { Palette } from '../palette';
import { createGeometry, iso, type Material } from './geometry';
import { assemblyOffset, type BuildingStudy } from './building-layout';
import type { RenderBuilding } from './view-model';
import { buildingAssembly } from '../assembly/compose';
import { assemblyDrawOrder } from '../assembly/draw-order';
import {
  KIT_SIZE,
  KIT_Z,
  volume,
  type AssemblyPart,
  type Volume,
} from '../assembly/model';

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
    const taper = (
      v: Volume,
      bottom: number,
      top: number,
      m: Material = g.concrete,
    ) =>
      g.taper(
        b.x + (v.x + v.w / 2) / KIT_SIZE,
        b.y + (v.y + v.d / 2) / KIT_SIZE,
        bottom / KIT_SIZE,
        top / KIT_SIZE,
        v.z * KIT_Z,
        v.h * KIT_Z,
        m,
      );
    const face = (pts: number[][], color: string) =>
      g.polygon(
        pts.map((q) => project(q[0]!, q[1]!, q[2]!)),
        color,
        p.edge,
      );
    const strip = (
      x: number,
      y: number,
      z: number,
      w: number,
      color = accent,
    ) => line([x, y, z], [x + w, y, z], active ? color : p.edge, 1);
    const slab = (v: Volume, height = 0.2) => box({ ...v, h: height }, g.dark);
    const onFace = (v: Volume, text: string) => {
      if (!fine) return;
      ctx.save();
      ctx.translate(...project(v.x + 0.5, v.y + v.d + 0.005, v.z + v.h - 0.7));
      ctx.transform(1, 0.5, 0, 1, 0, 0);
      ctx.font = 'bold 2.5px monospace';
      ctx.fillStyle = p.concrete;
      ctx.fillText(text, 0, 0);
      ctx.restore();
    };
    function drawPart(part: AssemblyPart) {
      const v = part.volume,
        { x, y, z, w, d, h } = v,
        top = z + h;
      switch (part.kind) {
        case 'foundation':
          for (const footing of part.solids) box(footing, g.dark);
          break;
        case 'hall':
          drawHall(b, v, active, options.zoom, options.facade);
          break;
        case 'cooler': {
          slab(v, 0.35);
          const core = volume(
            x + 0.15,
            y + 0.15,
            z + 0.35,
            w - 0.3,
            d - 0.3,
            h - 0.65,
          );
          taper({ ...core, h: core.h * 0.6 }, w * 0.44, w * 0.27);
          taper(
            { ...core, z: core.z + core.h * 0.6, h: core.h * 0.4 },
            w * 0.27,
            w * 0.4,
          );
          taper(
            volume(x, y, top - 0.3, w, d, 0.3),
            w * 0.44,
            w * 0.44,
            g.steel,
          );
          taper(volume(x, y, top - 0.02, w, d, 0.02), w * 0.31, w * 0.31, [
            p.ink,
            p.ink,
            p.ink,
          ]);
          break;
        }
        case 'turbine':
          slab(v, 0.3);
          box(
            volume(x + 0.15, y + 0.15, z + 0.3, w - 0.3, d - 0.3, h - 0.3),
            g.concrete,
          );
          for (let yy = y + 0.4; yy < y + d - 0.3; yy += 0.35)
            line(
              [x + w - 0.14, yy, z + 0.7],
              [x + w - 0.14, yy, top - 0.4],
              p.ink,
              0.7,
            );
          strip(x + 0.4, y + d - 0.145, top - 0.6, w - 0.8);
          onFace(v, 'GEN 02');
          break;
        case 'exchanger':
          slab(v, 0.25);
          box(
            volume(x + 0.15, y + 0.15, z + 0.25, w - 0.3, d - 0.3, h - 0.25),
            g.dark,
          );
          for (let xx = x + 0.3; xx < x + w - 0.2; xx += 0.3)
            line(
              [xx, y + d - 0.14, z + 0.45],
              [xx, y + d - 0.14, top - 0.15],
              p.production,
              0.7,
            );
          break;
        case 'furnace':
          slab(v, 0.3);
          box(
            volume(x + 0.15, y + 0.15, z + 0.3, w - 0.3, d - 0.3, h - 0.3),
            g.dark,
          );
          strip(x + 0.5, y + d - 0.145, z + 1, w - 1, p.production);
          strip(x + 0.5, y + d - 0.145, z + 1.6, w - 1, p.production);
          onFace(v, 'MELT 02');
          break;
        case 'stack':
        case 'scrubber': {
          slab(v, 0.3);
          if (part.kind === 'scrubber') {
            taper(
              volume(x, y, z + 0.3, w, d, h * 0.45),
              w * 0.43,
              w * 0.43,
              g.steel,
            );
            for (const zz of [z + 0.5, z + h * 0.4])
              taper(
                volume(x, y, zz, w, d, 0.15),
                w * 0.46,
                w * 0.46,
                g.concrete,
              );
          } else
            box(
              volume(x + 0.2, y + 0.2, z + 0.3, w - 0.4, d - 0.4, 1.5),
              g.steel,
            );
          const start = part.kind === 'scrubber' ? z + 0.3 + h * 0.45 : z + 1.8;
          taper(
            volume(x, y, start, w, d, top - 0.25 - start),
            w * 0.2,
            w * 0.18,
            g.concrete,
          );
          taper(
            volume(x, y, top - 0.25, w, d, 0.25),
            w * 0.23,
            w * 0.23,
            g.steel,
          );
          taper(volume(x, y, top - 0.01, w, d, 0.01), w * 0.14, w * 0.14, [
            p.ink,
            p.ink,
            p.ink,
          ]);
          break;
        }
        case 'skylights':
          for (let i = 0; i < 3; i++) {
            const yy = y + (i * d) / 3;
            face(
              [
                [x, yy, z],
                [x + w, yy, z],
                [x + w, yy + d / 3 - 0.08, top],
                [x, yy + d / 3 - 0.08, top],
              ],
              p['concrete-shadow'],
            );
            face(
              [
                [x, yy + d / 3 - 0.08, z],
                [x + w, yy + d / 3 - 0.08, z],
                [x + w, yy + d / 3 - 0.08, top],
                [x, yy + d / 3 - 0.08, top],
              ],
              p.ink,
            );
            line(
              [x + 0.2, yy + d / 3 - 0.075, z + 0.6],
              [x + w - 0.2, yy + d / 3 - 0.075, z + 0.6],
              p.concrete,
              0.6,
            );
          }
          break;
        case 'solar':
          for (const yy of [y + 0.15, y + d - 0.3])
            box(volume(x, yy, z, w, 0.15, 0.6), g.steel);
          for (let i = 0; i < 3; i++) {
            const xx = x + (i * w) / 3;
            box(volume(xx + 0.05, y, z + 0.6, w / 3 - 0.1, d, 0.4), [
              p.materials,
              p.steel,
              p.surface,
            ]);
            for (let j = 1; j < 4; j++)
              line(
                [xx + 0.05, y + (j * d) / 4, top + 0.001],
                [xx + w / 3 - 0.05, y + (j * d) / 4, top + 0.001],
                p.surface,
                0.4,
              );
          }
          break;
        case 'cargo':
          box(v, [p['concrete-shadow'], p.steel, p.surface]);
          for (let i = 1; i < 4; i++)
            line(
              [x + (i * w) / 4, y + d + 0.001, z + 0.1],
              [x + (i * w) / 4, y + d + 0.001, top - 0.1],
              p.materials,
              0.35,
            );
          break;
        case 'gantry': {
          for (const solid of part.solids) box(solid, g.steel);
          break;
        }
        case 'catwalk':
          box({ ...v, h: 0.12 }, g.steel);
          line([x, y + d, top], [x + w, y + d, top], p.concrete, 0.55);
          for (let xx = x; xx <= x + w; xx += 1)
            line(
              [xx, y + d, z + 0.12],
              [xx, y + d, top],
              p['concrete-shadow'],
              0.45,
            );
          break;
        case 'ladder':
          for (const xx of [x, x + w])
            line([xx, y + d, z], [xx, y + d, top], p.concrete, 0.5);
          for (let zz = z + 0.2; zz < top; zz += 0.4)
            line([x, y + d, zz], [x + w, y + d, zz], p['concrete-shadow'], 0.4);
          break;
        case 'grid': {
          slab(v, 0.2);
          for (const xx of [x + 0.2, x + w - 0.2])
            line(
              [xx, y + d / 2, z + 0.2],
              [xx, y + d / 2, top - 0.3],
              p.concrete,
              0.65,
            );
          line(
            [x + 0.1, y + d / 2, top - 0.3],
            [x + w - 0.1, y + d / 2, top - 0.3],
            p.steel,
            0.7,
          );
          for (let i = 0; i < 3; i++)
            line(
              [x + 0.3 + (i * (w - 0.6)) / 2, y + d / 2, top - 0.55],
              [x + 0.3 + (i * (w - 0.6)) / 2, y + d / 2, top],
              p.power,
              0.9,
            );
          break;
        }
        case 'terminal':
          box(v, g.dark);
          strip(x + 0.08, y + d + 0.001, top - 0.2, w - 0.16, p.materials);
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
        const xx =
          x + w / 2 + (active ? Math.sin(time * 0.45) * (w / 2 - 1) : 0);
        box(volume(xx - 0.4, y + 0.3, top - 0.75, 0.8, 1.2, 0.35), [
          p.materials,
          p.steel,
          p.surface,
        ]);
        line(
          [xx, y + d / 2, top - 0.75],
          [xx, y + d / 2, z + 2.6],
          p.materials,
          0.5,
        );
      }
    }
    const resolution = Math.max(2, Math.min(8, Math.ceil(options.zoom * 1.5)));
    const spriteKey = `${active}/${fine}/${resolution}`;
    let cached = sprites.get(b);
    if (!cached || cached.key !== spriteKey) {
      cached = { key: spriteKey, parts: new Map() };
      sprites.set(b, cached);
    }
    function paintPart(part: AssemblyPart) {
      if (part.kind === 'hall') {
        drawPart(part);
        return;
      }
      let sprite = cached!.parts.get(part.id);
      if (!sprite) {
        const v = part.volume;
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
          drawPart(part);
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
        cached!.parts.set(part.id, sprite);
      }
      ctx.drawImage(sprite.image, sprite.x, sprite.y, sprite.w, sprite.h);
      drawEffects(part);
    }
    for (const part of parts) {
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
      for (const port of a.ports.filter((port) => port.part === part.id)) {
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
      if (part.kind === 'hall' && !study?.exploded) {
        ctx.save();
        if (options.ghost) ctx.globalAlpha *= 0.6;
        if (study?.part || (study?.focus && study.focus !== 'all'))
          ctx.globalAlpha *= 0.2;
        for (const route of a.routes)
          for (let i = 1; i < route.points.length; i++)
            line(
              route.points[i - 1]!,
              route.points[i]!,
              route.service === 'heat'
                ? p.production
                : route.service === 'power'
                  ? p.power
                  : route.service === 'coolant'
                    ? p['concrete-shadow']
                    : p.steel,
              route.service === 'exhaust' ? 1.1 : 0.7,
            );
        ctx.restore();
      }
    }
    if (options.selected)
      g.polygon(
        [
          iso(b.x, b.y, 1),
          iso(b.x + 1, b.y, 1),
          iso(b.x + 1, b.y + 1, 1),
          iso(b.x, b.y + 1, 1),
        ],
        p.foreground + '05',
        p.foreground,
      );
  };
}
