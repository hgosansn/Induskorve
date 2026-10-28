import { hasModule } from '../../domain/city/catalog';
import type { Palette } from '../palette';
import { createGeometry, iso, type Material } from './geometry';
import {
  attachment,
  assemblyOffset,
  roofHeight,
  type AssemblyLayer,
  type BuildingStudy,
} from './building-layout';
import type { RenderBuilding } from './view-model';

export function createBuildingRenderer(
  ctx: CanvasRenderingContext2D,
  p: Palette,
) {
  const g = createGeometry(ctx, p);
  const {
    box,
    taper,
    polygon,
    line,
    lamp,
    glow,
    railing,
    concrete,
    steel,
    dark,
  } = g;
  return (
    b: RenderBuilding,
    active: boolean,
    time: number,
    options: {
      zoom: number;
      ghost?: boolean;
      selected?: boolean;
      study?: BuildingStudy;
    },
  ) => {
    const { x, y } = b,
      h = roofHeight(b),
      fine = options.zoom > 1.15;
    const accent =
      b.type === 'power'
        ? p.power
        : b.type === 'warehouse'
          ? p.materials
          : p.production;
    const trim: Material = [accent, p['concrete-shadow'], p.surface];
    const shape = b.design?.shape ?? (b.variant > 0.67 ? 'tower' : 'stepped');
    function layer(name: AssemblyLayer, draw: () => void) {
      ctx.save();
      ctx.translate(0, -assemblyOffset(name, options.study));
      if (options.ghost) ctx.globalAlpha *= 0.6;
      if (
        options.study?.focus !== undefined &&
        options.study.focus !== 'all' &&
        options.study.focus !== name
      )
        ctx.globalAlpha *= 0.12;
      draw();
      ctx.restore();
    }
    if (options.study?.exploded) {
      ctx.save();
      ctx.globalAlpha = 0.3;
      ctx.setLineDash([1, 3]);
      for (const [xx, yy] of [
        [0.06, 0.06],
        [0.94, 0.94],
      ])
        line(
          iso(x + xx!, y + yy!, 0),
          iso(x + xx!, y + yy!, h + 96),
          p.edge,
          0.5,
        );
      ctx.restore();
    }
    layer('foundation', () => {
      box(x + 0.03, y + 0.03, 0.94, 0.94, 0, 4, dark);
      box(x + 0.09, y + 0.09, 0.82, 0.82, 4, 2, steel);
      for (const xx of [0.14, 0.83]) {
        box(x + xx, y + 0.88, 0.05, 0.08, 6, 1, trim);
        if (active) lamp(iso(x + xx, y + 0.93, 7), accent, true, 1);
      }
      if (active && b.type === 'factory')
        glow(iso(x + 0.5, y + 0.8, 3), p.production, 19, 0.24);
    });
    layer('shell', () => {
      if (b.type === 'power') {
        // Long turbine gallery: opaque wall panels below a glazed clerestory.
        box(x + 0.14, y + 0.22, 0.72, 0.59, 6, h - 5, steel);
        box(x + 0.1, y + 0.18, 0.8, 0.66, h, 3, concrete);
        for (let i = 0; i < 5; i++) {
          const xx = x + 0.17 + i * 0.135;
          box(xx, y + 0.79, 0.035, 0.09, 6, h - 6, concrete);
          line(
            iso(xx + 0.05, y + 0.815, h - 4),
            iso(xx + 0.1, y + 0.815, h - 4),
            active ? p.power : p.ink,
            2,
          );
        }
        if (fine)
          for (let z = 11; z < h - 6; z += 4)
            line(
              iso(x + 0.2, y + 0.825, z),
              iso(x + 0.8, y + 0.825, z),
              p.edge,
              0.4,
            );
      } else if (b.type === 'factory') {
        // Recessed furnace mouth and ribbed shell; sawtooth glazing is structural.
        box(x + 0.13, y + 0.15, 0.74, 0.67, 6, h - 5, dark);
        for (let i = 0; i < 3; i++) {
          const yy = y + 0.16 + i * 0.21;
          polygon(
            [
              iso(x + 0.12, yy, h + 1),
              iso(x + 0.87, yy, h + 1),
              iso(x + 0.87, yy + 0.17, h + 8),
              iso(x + 0.12, yy + 0.17, h + 8),
            ],
            p.concrete,
            p.edge,
          );
          polygon(
            [
              iso(x + 0.12, yy + 0.17, h + 1),
              iso(x + 0.87, yy + 0.17, h + 1),
              iso(x + 0.87, yy + 0.17, h + 7),
              iso(x + 0.12, yy + 0.17, h + 7),
            ],
            p.ink,
            p.edge,
          );
          line(
            iso(x + 0.18, yy + 0.172, h + 4),
            iso(x + 0.79, yy + 0.172, h + 4),
            active ? p.production : p.steel,
            1,
          );
        }
        for (const xx of [0.13, 0.48, 0.83])
          box(x + xx, y + 0.8, 0.06, 0.12, 6, h - 9, steel);
        polygon(
          [
            iso(x + 0.24, y + 0.83, 7),
            iso(x + 0.72, y + 0.83, 7),
            iso(x + 0.66, y + 0.83, h - 4),
            iso(x + 0.3, y + 0.83, h - 4),
          ],
          p.ink,
          p.edge,
        );
        for (let i = 0; i < 4; i++)
          line(
            iso(x + 0.31 + i * 0.09, y + 0.835, 10),
            iso(x + 0.31 + i * 0.09, y + 0.835, h - 8),
            active ? p.production : p.surface,
            2.2,
          );
        if (active) glow(iso(x + 0.5, y + 0.84, 13), p.production, 12, 0.32);
      } else {
        // Stepped freight terraces, strong overhang and recessed shutter wall.
        box(x + 0.13, y + 0.13, 0.72, 0.62, 6, h - 2, steel);
        box(x + 0.1, y + 0.1, 0.8, 0.69, h + 4, 3, concrete);
        box(x + 0.19, y + 0.16, 0.58, 0.35, h + 7, 7, steel);
        box(x + 0.15, y + 0.13, 0.66, 0.42, h + 14, 2, concrete);
        for (let i = 0; i < 3; i++) {
          const xx = x + 0.19 + i * 0.22;
          polygon(
            [
              iso(xx, y + 0.76, 7),
              iso(xx + 0.16, y + 0.76, 7),
              iso(xx + 0.16, y + 0.76, h + 1),
              iso(xx, y + 0.76, h + 1),
            ],
            p.ink,
            p.edge,
          );
          line(
            iso(xx, y + 0.765, h + 1),
            iso(xx + 0.16, y + 0.765, h + 1),
            active ? p.materials : p.steel,
            1.3,
          );
          if (fine)
            for (let z = 10; z < h; z += 3)
              line(
                iso(xx + 0.02, y + 0.765, z),
                iso(xx + 0.14, y + 0.765, z),
                p.steel,
                0.5,
              );
        }
        railing(x + 0.14, y + 0.81, 0.71, h + 7);
      }
      if (fine) {
        // Panel joints are disciplined repeats, not random facade greebles.
        for (let i = 0; i < 4; i++)
          line(
            iso(x + 0.875, y + 0.19 + i * 0.13, 9),
            iso(x + 0.875, y + 0.19 + i * 0.13, h - 2),
            p.edge,
            0.4,
          );
        ctx.save();
        ctx.translate(...iso(x + 0.25, y + 0.837, 8));
        ctx.transform(1, 0.5, 0, 1, 0, 0);
        ctx.font = 'bold 3.6px monospace';
        ctx.fillStyle = p.concrete;
        ctx.fillText(
          b.type === 'power' ? 'VOLT' : b.type === 'factory' ? 'IRON' : 'CARGO',
          0,
          0,
        );
        ctx.restore();
      }
    });
    function furnace(xx: number) {
      taper(xx, y + 0.28, 0.15, 0.12, h + 4, b.h * 0.34, steel);
      taper(xx, y + 0.28, 0.16, 0.16, h + b.h * 0.34 + 4, 3, concrete);
      taper(xx, y + 0.28, 0.1, 0.1, h + b.h * 0.34 + 7, 0.5, [
        p.ink,
        p.ink,
        p.ink,
      ]);
      if (active) {
        const exhaust = hasModule(b, 'scrubber') ? 1 : 4;
        for (let i = 0; i < exhaust; i++) {
          const q = (time * 0.13 + i / exhaust + b.variant) % 1;
          const point = iso(
            xx + q * 0.16,
            y + 0.28,
            h + b.h * 0.34 + 9 + q * 22,
          );
          ctx.save();
          ctx.globalAlpha *= (1 - q) * 0.12;
          ctx.fillStyle = p.muted;
          ctx.beginPath();
          ctx.ellipse(...point, 2 + q * 5, 1.5 + q * 3, -0.4, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }
    }
    function turbine(xx: number, yy: number, zz: number) {
      taper(xx, yy, 0.13, 0.13, zz, 6, dark);
      taper(xx, yy, 0.115, 0.115, zz + 6, 1, concrete);
      const angle = active ? time * 1.4 : 0.4;
      for (let i = 0; i < 4; i++) {
        const a = angle + (i * Math.PI) / 2;
        line(
          iso(xx, yy, zz + 7.1),
          iso(xx + Math.cos(a) * 0.09, yy + Math.sin(a) * 0.09, zz + 7.1),
          p.power,
          1,
        );
      }
    }
    layer('machinery', () => {
      if (b.type === 'power') {
        // Faceted cooling stacks with a waist and open throat are the landmark.
        for (const xx of [0.36, 0.7]) {
          taper(x + xx, y + 0.38, 0.18, 0.105, h + 3, b.h * 0.27, concrete);
          taper(
            x + xx,
            y + 0.38,
            0.105,
            0.16,
            h + 3 + b.h * 0.27,
            b.h * 0.18,
            concrete,
          );
          taper(x + xx, y + 0.38, 0.18, 0.18, h + 3 + b.h * 0.45, 2, steel);
          taper(x + xx, y + 0.38, 0.125, 0.125, h + 5 + b.h * 0.45, 0.1, [
            p.ink,
            p.ink,
            p.ink,
          ]);
          lamp(
            iso(x + xx + 0.1, y + 0.48, h + b.h * 0.45),
            p.power,
            active,
            1.2,
          );
        }
        turbine(x + 0.41, y + 0.69, h + 3);
      } else if (b.type === 'factory') {
        furnace(x + 0.3);
        box(x + 0.66, y + 0.6, 0.12, 0.16, h + 4, 5, concrete);
        for (let i = 0; i < 3; i++)
          line(
            iso(x + 0.68, y + 0.62 + i * 0.045, h + 9.5),
            iso(x + 0.76, y + 0.62 + i * 0.045, h + 9.5),
            p.ink,
            0.8,
          );
      } else {
        // Inventory is the only source of stacked freight on the apron.
        const count = Math.min(8, Math.ceil((b.stock ?? 0) / 50));
        for (let i = 0; i < count; i++) {
          const xx = x + 0.13 + (i % 4) * 0.18,
            z = 6 + Math.floor(i / 4) * 5;
          box(xx, y + 0.81, 0.16, 0.14, z, 4, [
            p.materials,
            p.steel,
            p.surface,
          ]);
          if (fine)
            line(
              iso(xx + 0.04, y + 0.955, z + 1),
              iso(xx + 0.04, y + 0.955, z + 4),
              p['concrete-shadow'],
              0.5,
            );
        }
      }
    });
    layer('modules', () => {
      if (hasModule(b, 'turbine')) turbine(x + 0.72, y + 0.69, h + 3);
      if (hasModule(b, 'heat-exchanger')) {
        box(x + 0.69, y + 0.51, 0.22, 0.33, h + 3, 6, dark);
        for (let i = 0; i < 5; i++)
          box(x + 0.7, y + 0.52 + i * 0.06, 0.2, 0.025, h + 4, 7, [
            p.production,
            p.soot,
            p.surface,
          ]);
      }
      if (hasModule(b, 'furnace')) furnace(x + 0.65);
      if (hasModule(b, 'scrubber')) {
        taper(x + 0.76, y + 0.65, 0.12, 0.12, h + 4, 13, concrete);
        taper(x + 0.76, y + 0.65, 0.14, 0.14, h + 9, 2, steel);
        line(
          iso(x + 0.76, y + 0.65, h + 17),
          iso(x + 0.76, y + 0.65, h + 21),
          p.materials,
          1.5,
        );
      }
      if (hasModule(b, 'loading-bay')) {
        // A loading gantry is supported by actual uprights on the apron.
        for (const xx of [0.12, 0.86])
          box(x + xx, y + 0.83, 0.035, 0.05, 6, h + 6, steel);
        box(x + 0.1, y + 0.81, 0.82, 0.11, h + 12, 3, concrete);
        const shuttle = active ? 0.42 + Math.sin(time * 0.45) * 0.16 : 0.42;
        box(x + shuttle, y + 0.81, 0.13, 0.11, h + 8, 4, trim);
        line(
          iso(x + shuttle + 0.06, y + 0.86, h + 8),
          iso(x + shuttle + 0.06, y + 0.86, 12),
          p.materials,
          0.7,
        );
      }
      if (hasModule(b, 'solar-roof')) {
        for (let i = 0; i < 3; i++) {
          box(x + 0.2 + i * 0.18, y + 0.17, 0.16, 0.3, h + 17, 1, [
            p.materials,
            p.steel,
            p.ink,
          ]);
          for (let j = 0; j < 3; j++)
            line(
              iso(x + 0.2 + i * 0.18, y + 0.2 + j * 0.08, h + 18.1),
              iso(x + 0.36 + i * 0.18, y + 0.2 + j * 0.08, h + 18.1),
              p.surface,
              0.5,
            );
        }
      }
    });
    layer('services', () => {
      // A consistent rear corner carries the control room and service riser.
      const coreH =
        shape === 'tower' ? b.h * 0.34 : shape === 'stepped' ? 11 : 5;
      box(x + 0.13, y + 0.14, 0.19, 0.3, h + 4, coreH, dark);
      box(x + 0.1, y + 0.11, 0.25, 0.36, h + 4 + coreH, 2, steel);
      for (let z = h + 7; z < h + coreH + 2; z += 5)
        line(
          iso(x + 0.15, y + 0.445, z),
          iso(x + 0.28, y + 0.445, z),
          active ? p.foreground : p.edge,
          1,
        );
      if (b.design?.balcony) {
        box(x + 0.08, y + 0.83, 0.83, 0.1, h * 0.55, 1, steel);
        railing(x + 0.08, y + 0.93, 0.83, h * 0.55 + 1);
      }
      const pin = attachment(b, 'power'),
        base = iso(pin.x, pin.y, pin.base),
        top = iso(pin.x, pin.y, pin.z);
      line(base, top, p['concrete-shadow'], 1.4);
      line([top[0] - 4, top[1]], [top[0] + 4, top[1]], p.concrete, 1.1);
      for (const dx of [-4, 0, 4])
        line(
          [top[0] + dx, top[1] - 2],
          [top[0] + dx, top[1] + 2],
          p.power,
          1.1,
        );
      if (b.type !== 'power') {
        const pin = attachment(b, 'materials'),
          top = iso(pin.x, pin.y, pin.z);
        line(iso(pin.x, pin.y, pin.base), top, p.materials, 1);
        line(
          [top[0] - 2.5, top[1] - 1],
          [top[0] + 2.5, top[1] + 1],
          p.materials,
          0.8,
        );
      }
    });
    if (options.selected)
      polygon(
        [
          iso(x, y, 1),
          iso(x + 1, y, 1),
          iso(x + 1, y + 1, 1),
          iso(x, y + 1, 1),
        ],
        p.foreground + '05',
        p.foreground,
      );
  };
}
