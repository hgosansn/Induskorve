import { serviceStatus } from '../../domain/city/networks';
import { readPalette } from '../palette';
import { createBuildingRenderer } from './buildings';
import { createTerrainRenderer } from './terrain-art';
import { iso } from './geometry';
import { attachment, roofHeight } from './building-layout';
// Canvas orchestration and procedural adverts. Building assemblies and terrain are typed renderers.
// Its typed boundary is artwork.d.ts; camera/input/lifecycle live in scene.ts.
export function createArtwork(ctx) {
  let W,
    H,
    dpr,
    zoom,
    panX,
    panY,
    mode,
    grid,
    hover,
    selected,
    clock,
    buildings,
    terrain,
    net,
    links,
    walkers,
    citizen,
    layer,
    draft,
    preview,
    study;
  const key = (x, y) => `${x},${y}`;
  const P = readPalette();
  const drawBuilding = createBuildingRenderer(ctx, P);
  const drawTerrain = createTerrainRenderer(ctx, P);
  const COLORS = {
    power: P.power,
    materials: P.materials,
    heat: P.production,
    factory: P.production,
    warehouse: P.materials,
  };
  function port(b, kind) {
    const p = attachment(b, kind);
    return iso(p.x, p.y, p.z);
  }
  function connectionPoint(a, b, q, bend) {
    return [
      a[0] + (b[0] - a[0]) * q,
      a[1] + (b[1] - a[1]) * q + 4 * q * (1 - q) * bend,
    ];
  }
  function drawConnections(t) {
    if (layer === 'off') return;
    for (const l of links) {
      if (
        layer !== 'all' &&
        layer !== l.kind &&
        !(layer === 'power' && l.kind === 'heat')
      )
        continue;
      const related = selected && (l.from === selected || l.to === selected),
        dim = selected && !related,
        a = port(l.from, l.kind),
        b = port(l.to, l.kind),
        span = Math.hypot(a[0] - b[0], a[1] - b[1]);
      ctx.save();
      if (l.kind === 'heat') {
        ctx.globalAlpha = dim ? 0.1 : 0.85;
        const start = iso(
          l.from.x + 0.82,
          l.from.y + 0.55,
          roofHeight(l.from) + 7,
        );
        const end = iso(l.to.x + 0.22, l.to.y + 0.25, roofHeight(l.to) + 3);
        const lowA = iso(l.from.x + 0.82, l.from.y + 0.55, 5);
        const lowB = iso(l.to.x + 0.22, l.to.y + 0.25, 5);
        line(start, lowA, P.production, related ? 3 : 2);
        line(lowB, end, P.production, related ? 3 : 2);
        line(lowA, lowB, P.production, related ? 3 : 2);
      } else if (l.kind === 'power') {
        // A continuous suspended wire sags under its weight between roof insulators.
        const sag = Math.max(8, Math.min(31, span * 0.17));
        ctx.globalAlpha = dim ? 0.06 : related ? 0.9 : l.active ? 0.52 : 0.18;
        ctx.strokeStyle = l.active ? P['power'] : P['steel'];
        ctx.lineWidth = related ? 1.35 : 0.65 + l.weight * 0.45;
        ctx.beginPath();
        ctx.moveTo(...a);
        ctx.quadraticCurveTo(
          (a[0] + b[0]) / 2,
          (a[1] + b[1]) / 2 + sag * 2,
          ...b,
        );
        ctx.stroke();
      } else if (l.active) {
        // Wireless traffic arches upward, the inverse of hanging power cables.
        const arch = -Math.max(20, Math.min(65, span * 0.38)),
          count = Math.max(6, Math.min(16, Math.ceil(span / 13)));
        for (let i = 0; i < count; i++) {
          const q = (i / count + t * 0.1 + l.to.id * 0.071) % 1,
            p = connectionPoint(a, b, q, arch);
          ctx.globalAlpha =
            (dim ? 0.06 : related ? 0.95 : 0.6) * Math.sin(Math.PI * q);
          ctx.fillStyle = P['materials'];
          ctx.beginPath();
          ctx.arc(...p, related ? 1.2 : 0.85, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    }
  }
  function variation(b, n) {
    let v =
      Math.sin(
        (b.design ? 0 : b.x * 127.1 + b.y * 311.7) + b.variant * 71 + n * 74.7,
      ) * 43758.5453;
    return v - Math.floor(v);
  }
  function pedestrian(w, t) {
    let p = iso(w.x, w.y);
    let mine = citizen && w.person?.id === citizen.id;
    ctx.fillStyle = P['ink'] + '77';
    ctx.beginPath();
    ctx.ellipse(p[0], p[1], 2.8, 1.1, 0, 0, 7);
    ctx.fill();
    let stride = Math.sin(t * 8 + w.phase) * 1.1;
    line([p[0] - 0.6, p[1] - 2], [p[0] - stride, p[1]], P['surface'], 1);
    line([p[0] + 0.6, p[1] - 2], [p[0] + stride, p[1]], P['surface'], 1);
    line(
      [p[0], p[1] - 2],
      [p[0], p[1] - 5],
      mine ? P['foreground'] : w.color,
      2,
    );
    ctx.fillStyle = P['muted'];
    ctx.fillRect(p[0] - 0.8, p[1] - 7, 1.6, 1.7);
    if (mine) {
      ctx.strokeStyle = P['foreground'] + '88';
      ctx.beginPath();
      ctx.ellipse(p[0], p[1], 4, 2, 0, 0, 7);
      ctx.stroke();
    }
  }

  function poly(points, fill, stroke) {
    ctx.beginPath();
    points.forEach((p, i) => (i ? ctx.lineTo(...p) : ctx.moveTo(...p)));
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 0.6;
      ctx.stroke();
    }
  }
  function line(a, b, color, width = 1) {
    ctx.beginPath();
    ctx.moveTo(...a);
    ctx.lineTo(...b);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
  }
  const advertCache = new Map(),
    advertImages = new Map();
  function drawAdvert(b, t, x, y, width, z, height, on) {
    const v = (n) => variation(b.design ? { ...b, x: 0, y: 0 } : b, n);
    let entry = advertCache.get(b.id);
    if (!entry) {
      const c = document.createElement('canvas');
      c.width = 96;
      c.height = 160;
      entry = { canvas: c, frame: -1 };
      advertCache.set(b.id, entry);
    }
    const frame = Math.floor(t * 12);
    if (entry.frame !== frame) {
      entry.frame = frame;
      const g = entry.canvas.getContext('2d'),
        w = 96,
        h = 160,
        phase = t + v(51) * 20,
        palette = [COLORS[b.type], P.ink, P.foreground];
      g.fillStyle = palette[1];
      g.fillRect(0, 0, w, h);
      let image = null;
      if (b.adImage) {
        image = advertImages.get(b.adImage);
        if (!image) {
          image = new Image();
          image.src = b.adImage;
          advertImages.set(b.adImage, image);
        }
      }
      if (image?.complete && image.naturalWidth) {
        const scale = Math.max(w / image.naturalWidth, h / image.naturalHeight),
          iw = image.naturalWidth * scale,
          ih = image.naturalHeight * scale;
        g.drawImage(image, (w - iw) / 2, (h - ih) / 2, iw, ih);
      } else {
        const style = Math.floor(v(53) * 4);
        g.strokeStyle = palette[0];
        g.fillStyle = palette[0];
        g.lineWidth = 2;
        if (style === 0) {
          g.save();
          g.translate(48, 72);
          g.rotate(Math.sin(phase * 0.4) * 0.3);
          for (let k = 0; k < 5; k++) {
            g.beginPath();
            g.ellipse(
              0,
              0,
              13 + k * 5,
              29 + k * 4,
              phase * 0.15 + k * 0.3,
              0,
              Math.PI * 2,
            );
            g.stroke();
          }
          g.restore();
          g.fillStyle = palette[2];
          g.beginPath();
          g.arc(48 + Math.sin(phase) * 14, 72, 7, 0, 7);
          g.fill();
        } else if (style === 1) {
          for (let j = 0; j < 12; j++) {
            let yy = 28 + j * 8;
            g.beginPath();
            g.moveTo(0, yy);
            for (let xx = 0; xx <= 96; xx += 4)
              g.lineTo(
                xx,
                yy + Math.sin(xx * 0.065 + phase * 1.5 + j * 0.4) * 10,
              );
            g.stroke();
          }
        } else if (style === 2) {
          g.save();
          g.translate(48, 72);
          for (let k = 0; k < 4; k++) {
            g.rotate(phase * 0.05 + 0.5);
            g.strokeRect(-30 + k * 5, -30 + k * 5, 60 - k * 10, 60 - k * 10);
          }
          g.restore();
        } else {
          for (let k = 0; k < 14; k++) {
            let xx = k * 8 - 6,
              hh = 15 + Math.sin(k * 2 + phase) * 12 + v(60 + k) * 40;
            g.globalAlpha = 0.4 + (k % 3) * 0.25;
            g.fillRect(xx, 110 - hh, 6, hh);
          }
          g.globalAlpha = 1;
          g.beginPath();
          g.arc(48, 48, 21 + Math.sin(phase) * 3, 0, 7);
          g.stroke();
        }
        g.textAlign = 'center';
        g.fillStyle = palette[2];
        g.font = 'bold 15px monospace';
        g.fillText(
          ['ION', 'NØR', 'K-7', 'OXIDE', 'VEKT', 'ARC'][Math.floor(v(26) * 6)],
          48,
          22,
        );
        g.font = 'bold 8px monospace';
        g.fillText(
          ['STAY ELECTRIC', 'AFTER HOURS', 'NEW HORIZONS', 'CITY SIGNAL'][
            style
          ],
          48,
          137,
        );
        g.font = '6px monospace';
        g.fillText('TRANSMISSION / ' + String(b.id).padStart(3, '0'), 48, 150);
      }
      // LED scanlines and a slow scanning highlight, tied to this building's phase.
      g.fillStyle = P['ink'] + '55';
      for (let yy = 0; yy < h; yy += 3) g.fillRect(0, yy, w, 1);
      g.fillStyle = P['foreground'] + '14';
      g.fillRect(0, ((phase * 15) % 180) - 20, w, 16);
    }
    const top = iso(x, y, z + height);
    ctx.save();
    ctx.translate(...top);
    ctx.transform(
      (-27 * width) / 96,
      (13.5 * width) / 96,
      0,
      height / 160,
      0,
      0,
    );
    ctx.globalAlpha = on ? 0.85 : 0.15;
    ctx.drawImage(entry.canvas, 0, 0);
    ctx.strokeStyle = on ? P['concrete'] + '77' : P['steel'];
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, 96, 160);
    ctx.restore();
  }
  function building(b, t, ghost = false) {
    const on = net.get(b)?.active ?? (ghost || b.on);
    drawBuilding(b, on, t, { zoom, ghost, selected: selected === b, study });
    if (
      (b.design?.display === 'animated' || b.adImage) &&
      !study?.exploded &&
      (!study || study.focus === 'all' || study.focus === 'shell')
    ) {
      const h = roofHeight(b);
      drawAdvert(b, t, b.x + 0.88, b.y + 0.2, 0.48, 8, Math.max(10, h - 7), on);
    }
  }
  function draw(frame) {
    ({
      W,
      H,
      dpr,
      zoom,
      panX,
      panY,
      mode,
      grid,
      hover,
      selected,
      clock,
      buildings,
      terrain,
      net,
      links,
      walkers,
      citizen,
      layer,
      draft,
      preview,
      study,
    } = frame);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = P['background'];
    ctx.fillRect(0, 0, W, H);
    let bg = ctx.createRadialGradient(
      W * 0.55,
      H * 0.5,
      40,
      W * 0.5,
      H * 0.5,
      W * 0.65,
    );
    bg.addColorStop(0, P['card']);
    bg.addColorStop(1, P['background']);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.translate(W * 0.53 + panX, H * 0.53 + panY);
    ctx.scale(zoom, zoom);
    drawTerrain(frame);
    // foundations, service pipes and buildings in depth order
    [
      ...[...buildings.values()].map((b) => ({
        x: b.x + 0.5,
        y: b.y + 0.5,
        b,
      })),
      ...walkers.map((w) => ({ x: w.x, y: w.y, w })),
    ]
      .sort((a, b) => a.x + a.y - b.x - b.y)
      .forEach((e) => (e.b ? building(e.b, clock) : pedestrian(e.w, clock)));
    drawConnections(clock);
    if (hover && citizen && mode !== 'inspect') {
      let { x, y } = hover;
      let valid = !buildings.has(key(x, y)) && terrain.has(key(x, y));
      poly(
        [iso(x, y), iso(x + 1, y), iso(x + 1, y + 1), iso(x, y + 1)],
        valid ? P['foreground'] + '22' : P['danger'] + '33',
        valid ? P['foreground'] : P['danger'],
      );
      const ghost = preview?.building ?? {
        x,
        y,
        id: -1,
        h: draft?.height ?? 48,
        design: draft?.design,
        modules: draft?.modules,
        type: mode,
        on: true,
        variant: draft?.seed ?? 0.5,
      };
      if (preview) net.set(ghost, preview.service);
      building(ghost, clock, true);
      if (preview) {
        net.delete(ghost);
        const existing = links;
        links = preview.links;
        ctx.save();
        ctx.setLineDash([3, 3]);
        drawConnections(clock);
        ctx.restore();
        links = existing;
      }
      const label = iso(x + 0.5, y + 0.5, -23);
      const message = !valid
        ? 'OCCUPIED / UNREVEALED'
        : serviceStatus(ghost, preview?.service) +
          (preview?.service.output ? ` / ${preview.service.output} metal` : '');
      ctx.font = '9px monospace';
      ctx.textAlign = 'center';
      const width = ctx.measureText(message).width + 12;
      ctx.fillStyle = P.ink;
      ctx.fillRect(label[0] - width / 2, label[1] - 10, width, 15);
      ctx.fillStyle = valid ? P.foreground : P.danger;
      ctx.fillText(message, ...label);
    }
    ctx.restore();
    let vignette = ctx.createRadialGradient(
      W / 2,
      H / 2,
      H * 0.23,
      W / 2,
      H / 2,
      W * 0.68,
    );
    vignette.addColorStop(0, P['ink'] + '00');
    vignette.addColorStop(1, P['ink'] + '99');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, W, H);
  }

  return {
    draw,
    clearCaches() {
      advertCache.clear();
      advertImages.clear();
    },
    dispose() {
      advertCache.clear();
      for (const image of advertImages.values()) image.src = '';
      advertImages.clear();
    },
  };
}
