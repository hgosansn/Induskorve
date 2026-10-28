// Preserved procedural Canvas artwork. No persistence, DOM UI, or gameplay mutations.
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
    layer;
  const key = (x, y) => `${x},${y}`;
  const COLORS = {
    power: '#ebca5e',
    materials: '#70b7e3',
    factory: '#d59065',
    warehouse: '#70b7e3',
  };
  const iso = (x, y, z = 0) => [(x - y) * 27, (x + y) * 13.5 - z];
  function attachment(b, kind) {
    const h = b.type === 'warehouse' ? 16 + variation(b, 2) * 16 : b.h;
    return {
      x: b.x + (kind === 'power' ? 0.46 : 0.64),
      y: b.y + (kind === 'power' ? 0.51 : 0.4),
      z: h + 3 + (kind === 'power' ? 15 : 11),
      base: h + 3,
    };
  }
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
      if (layer !== 'all' && layer !== l.kind) continue;
      const related = selected && (l.from === selected || l.to === selected),
        dim = selected && !related,
        a = port(l.from, l.kind),
        b = port(l.to, l.kind),
        span = Math.hypot(a[0] - b[0], a[1] - b[1]);
      ctx.save();
      if (l.kind === 'power') {
        // A continuous suspended wire sags under its weight between roof insulators.
        const sag = Math.max(8, Math.min(31, span * 0.17));
        ctx.globalAlpha = dim ? 0.06 : related ? 0.9 : l.active ? 0.52 : 0.18;
        ctx.strokeStyle = l.active ? '#d7b955' : '#747055';
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
          ctx.fillStyle = '#85c9e7';
          ctx.beginPath();
          ctx.arc(...p, related ? 1.2 : 0.85, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    }
  }
  function buildingIdentity(b, t, ghost) {
    const n = net.get(b),
      color = COLORS[b.type] || COLORS.factory;
    let h = b.type === 'warehouse' ? 16 + variation(b, 2) * 16 : b.h;
    // Colored fascia on two faces is readable even with network lines hidden.
    poly(
      [
        iso(b.x + 0.17, b.y + 0.88, 6),
        iso(b.x + 0.8, b.y + 0.88, 6),
        iso(b.x + 0.8, b.y + 0.88, 9),
        iso(b.x + 0.17, b.y + 0.88, 9),
      ],
      color + 'b0',
    );
    poly(
      [
        iso(b.x + 0.88, b.y + 0.17, 6),
        iso(b.x + 0.88, b.y + 0.8, 6),
        iso(b.x + 0.88, b.y + 0.8, 9),
        iso(b.x + 0.88, b.y + 0.17, 9),
      ],
      color + '75',
    );
    let p = iso(b.x + 0.52, b.y + 0.52, h + 13);
    ctx.fillStyle = color;
    ctx.font = 'bold 7px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(
      b.type === 'power' ? 'ϟ' : b.type === 'warehouse' ? '▤' : '▥',
      p[0],
      p[1],
    );
    if (ghost) return;
    // Real rooftop hardware replaces abstract circular endpoint markers.
    {
      const p = attachment(b, 'power'),
        base = iso(p.x, p.y, p.base),
        top = iso(p.x, p.y, p.z);
      line(base, top, '#738274', 1.5);
      line([top[0] - 5, top[1] + 2], [top[0] + 5, top[1] + 2], '#9b9b7b', 1.4);
      for (const dx of [-4, 0, 4]) {
        line(
          [top[0] + dx, top[1] + 3],
          [top[0] + dx, top[1] - 1],
          '#aaa88a',
          1.5,
        );
        line(
          [top[0] + dx - 1.5, top[1] + 1],
          [top[0] + dx + 1.5, top[1] + 1],
          '#d4be79',
          0.7,
        );
      }
    }
    if (b.type !== 'power') {
      const p = attachment(b, 'materials'),
        base = iso(p.x, p.y, p.base),
        top = iso(p.x, p.y, p.z);
      line(base, top, '#6c8c8c', 1);
      line([top[0] - 3, top[1] + 3], [top[0] + 3, top[1] - 1], '#81a9ac', 1);
      line([top[0] - 3, top[1] - 1], [top[0] + 3, top[1] + 3], '#81a9ac', 1);
    }
  }
  function variation(b, n) {
    let v =
      Math.sin(b.x * 127.1 + b.y * 311.7 + b.variant * 71 + n * 74.7) *
      43758.5453;
    return v - Math.floor(v);
  }
  function pedestrian(w, t) {
    let p = iso(w.x, w.y);
    let mine = citizen && w.person?.id === citizen.id;
    ctx.fillStyle = '#07120e77';
    ctx.beginPath();
    ctx.ellipse(p[0], p[1], 2.8, 1.1, 0, 0, 7);
    ctx.fill();
    let stride = Math.sin(t * 8 + w.phase) * 1.1;
    line([p[0] - 0.6, p[1] - 2], [p[0] - stride, p[1]], '#26372d', 1);
    line([p[0] + 0.6, p[1] - 2], [p[0] + stride, p[1]], '#26372d', 1);
    line([p[0], p[1] - 2], [p[0], p[1] - 5], mine ? '#e5e9a4' : w.color, 2);
    ctx.fillStyle = '#c3b391';
    ctx.fillRect(p[0] - 0.8, p[1] - 7, 1.6, 1.7);
    if (mine) {
      ctx.strokeStyle = '#dcebad88';
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
  function face(x, y, w, d, z, h, colors) {
    let a = iso(x, y, z),
      b = iso(x + w, y, z),
      c = iso(x + w, y + d, z),
      e = iso(x, y + d, z),
      A = iso(x, y, z + h),
      B = iso(x + w, y, z + h),
      C = iso(x + w, y + d, z + h),
      E = iso(x, y + d, z + h);
    poly([b, c, C, B], colors[1], '#192525');
    poly([c, e, E, C], colors[2], '#192525');
    poly([A, B, C, E], colors[0], '#52615a');
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
    const v = (n) => variation(b, n);
    let entry = advertCache.get(b);
    if (!entry) {
      const c = document.createElement('canvas');
      c.width = 96;
      c.height = 160;
      entry = { canvas: c, frame: -1 };
      advertCache.set(b, entry);
    }
    const frame = Math.floor(t * 12);
    if (entry.frame !== frame) {
      entry.frame = frame;
      const g = entry.canvas.getContext('2d'),
        w = 96,
        h = 160,
        phase = t + v(51) * 20,
        palette = [
          ['#7ad9cd', '#193e40', '#e9f5b5'],
          ['#d891ad', '#492b44', '#f7d1b5'],
          ['#d9bd66', '#3c4230', '#eef2c0'],
          ['#7da7df', '#263752', '#bbecde'],
        ][Math.floor(v(52) * 4)];
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
      g.fillStyle = '#0a181955';
      for (let yy = 0; yy < h; yy += 3) g.fillRect(0, yy, w, 1);
      g.fillStyle = '#e6fff414';
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
    ctx.strokeStyle = on ? '#acc7b377' : '#354b3a';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, 96, 160);
    ctx.restore();
  }
  function building(b, t, ghost = false) {
    let { x, y, h, type } = b;
    let on = ghost ? true : (net.get(b)?.active ?? b.on);
    const v = (n) => variation(b, n);
    ctx.globalAlpha = ghost ? 0.5 : 1;
    let styles = [
      ['#667064', '#3e4d44', '#2d3d35'],
      ['#65716e', '#3b4f49', '#283c37'],
      ['#746b5d', '#504a3c', '#393e32'],
      ['#586461', '#364641', '#273b35'],
    ];
    let c = styles[Math.floor(v(1) * styles.length)],
      tall = type === 'warehouse' ? 16 + v(2) * 16 : h;
    let w = 0.57 + v(3) * 0.22,
      d = 0.58 + v(4) * 0.22,
      ox = 0.1 + (1 - w) * 0.2,
      oy = 0.1 + (1 - d) * 0.2;
    face(x + 0.06, y + 0.06, 0.88, 0.88, 0, 3, [
      '#515c4b',
      '#303e33',
      '#28372d',
    ]);
    // Tiered masses and attached machinery change silhouettes without changing footprints.
    let tier = v(6) > 0.55 && type !== 'warehouse';
    face(x + ox, y + oy, w, d, 3, tier ? tall * 0.68 : tall, c);
    if (tier)
      face(
        x + ox + 0.09,
        y + oy + 0.08,
        w - 0.18,
        d - 0.16,
        3 + tall * 0.68,
        tall * 0.32,
        [c[0], c[1], c[2]],
      );
    for (let n = 0; n < 5; n++) {
      let xx = ox + 0.045 + (n * (w - 0.09)) / 5;
      line(
        iso(x + xx, y + oy + d, 4),
        iso(x + xx, y + oy + d, tier ? tall * 0.67 : tall + 2),
        '#67725c',
        0.7,
      );
    }
    // Deterministic occupancy per window, on both visible facades.
    let lamp = v(11) > 0.72 ? '#7fbdb0' : v(11) > 0.45 ? '#d9a56a' : '#e0bc75';
    for (let z = 9; z < tall - 1; z += 7)
      for (let n = 0; n < 4; n++) {
        let xx = ox + 0.06 + (n * (w - 0.1)) / 4;
        let lit = on && v(40 + n + z * 2) > 0.43;
        poly(
          [
            iso(x + xx, y + oy + d + 0.004, z),
            iso(x + xx + 0.058, y + oy + d + 0.004, z),
            iso(x + xx + 0.058, y + oy + d + 0.004, z + 3),
            iso(x + xx, y + oy + d + 0.004, z + 3),
          ],
          lit ? lamp : '#192d28',
        );
        if (v(60 + n + z) > 0.35) {
          let yy = oy + 0.05 + (n * (d - 0.1)) / 4;
          poly(
            [
              iso(x + ox + w + 0.004, y + yy, z),
              iso(x + ox + w + 0.004, y + yy + 0.05, z),
              iso(x + ox + w + 0.004, y + yy + 0.05, z + 2),
              iso(x + ox + w + 0.004, y + yy, z + 2),
            ],
            on && v(80 + n + z) > 0.55 ? lamp : '#1b302b',
          );
        }
      }
    if (type === 'warehouse') {
      for (let n = 0; n < 6; n++)
        line(
          iso(x + ox + 0.04 + (n * w) / 7, y + oy, tall + 3),
          iso(x + ox + 0.04 + (n * w) / 7, y + oy + d, tall + 3),
          '#85907d',
          0.8,
        );
      face(x + 0.3, y + 0.8, 0.25, 0.1, 3, 10, [
        '#64735d',
        '#26382c',
        '#16291e',
      ]);
      for (let n = 0; n < 3; n++)
        face(x + 0.08 + n * 0.13, y + 0.84, 0.1, 0.1, 3, 3 + v(n + 18) * 4, [
          '#998667',
          '#5b6147',
          '#414e36',
        ]);
    } else {
      // Roof ventilation or chimneys; only some factories have stacks.
      let count =
        type === 'power' ? 2 + Math.floor(v(14) * 2) : v(15) > 0.45 ? 1 : 0;
      for (let k = 0; k < count; k++) {
        let sx = x + ox + 0.08 + k * 0.2,
          sy = y + oy + 0.1,
          sh = type === 'power' ? 27 + v(16 + k) * 38 : 14 + v(16 + k) * 28;
        face(sx, sy, 0.09, 0.1, tall + 3, sh, [
          '#9a9981',
          '#63715b',
          '#405440',
        ]);
        for (let band = 9; band < sh; band += 13)
          face(sx - 0.006, sy - 0.006, 0.102, 0.112, tall + 3 + band, 1.8, [
            '#a18f6c',
            '#877a55',
            '#5b6044',
          ]);
        if (on && !ghost) {
          let p = iso(sx + 0.04, sy + 0.05, tall + sh + 4);
          for (let i = 0; i < 6; i++) {
            let phase = (t * 0.085 + i / 6 + v(17 + k)) % 1;
            ctx.beginPath();
            ctx.ellipse(
              p[0] + phase * 23,
              p[1] - phase * 55,
              2 + phase * 12,
              1 + phase * 7,
              -0.4,
              0,
              7,
            );
            ctx.fillStyle = `rgba(160,174,143,${(1 - phase) * 0.08})`;
            ctx.fill();
          }
        }
      }
      face(x + ox + 0.2, y + oy + 0.25, 0.22, 0.22, tall + 3, 5, [
        '#84907b',
        '#4d6351',
        '#344b3b',
      ]);
      let vent = iso(x + ox + 0.31, y + oy + 0.36, tall + 8);
      ctx.strokeStyle = '#293f32';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(vent[0], vent[1], 4, 2, 0, 0, 7);
      ctx.stroke();
      if (on)
        line(
          [vent[0] - Math.cos(t * 2) * 3, vent[1] - Math.sin(t * 2)],
          [vent[0] + Math.cos(t * 2) * 3, vent[1] + Math.sin(t * 2)],
          '#b1b399',
          1,
        );
    }
    // Service balconies, ladders, and an asymmetric exterior pipe.
    if (v(20) > 0.45) {
      let z = Math.max(8, tall * 0.48);
      face(x + ox - 0.035, y + oy + d, 0.5, 0.12, z, 2, [
        '#8a8f71',
        '#536750',
        '#314932',
      ]);
      line(
        iso(x + ox, y + oy + d + 0.12, z + 6),
        iso(x + ox + 0.48, y + oy + d + 0.12, z + 6),
        '#a5a88b',
        0.8,
      );
      for (let n = 0; n < 5; n++)
        line(
          iso(x + ox + n * 0.11, y + oy + d + 0.12, z),
          iso(x + ox + n * 0.11, y + oy + d + 0.12, z + 6),
          '#73856b',
          0.7,
        );
    }
    if (v(22) > 0.5) {
      let xx = x + ox + w - 0.04;
      line(
        iso(xx, y + oy + d + 0.015, 4),
        iso(xx, y + oy + d + 0.015, tall + 5),
        '#889379',
        1.8,
      );
      for (let z = 5; z < tall; z += 4)
        line(
          iso(xx - 0.06, y + oy + d + 0.02, z),
          iso(xx + 0.025, y + oy + d + 0.02, z),
          '#8a9879',
          0.8,
        );
    }
    // Front-facing signs are freestanding letters, not boxed screens.
    {
      let p = iso(
        x + ox + w * 0.5,
        y + oy + d + 0.025,
        Math.max(12, tall * 0.68),
      );
      ctx.save();
      ctx.translate(...p);
      ctx.transform(1, 0.5, 0, 1, 0, 0);
      ctx.font = 'bold 6px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = on ? '#c2d3b4' : '#566d59';
      if (on) {
        ctx.shadowColor = '#a8ceb4';
        ctx.shadowBlur = 3;
      }
      ctx.fillText(
        ['ION', 'NØR', 'K-7', 'OXIDE', 'VEKT', 'ARC'][Math.floor(v(26) * 6)],
        0,
        0,
      );
      ctx.restore();
    }
    // The broad right-hand wall carries a nearly full-height LED advertising surface.
    if (tall > 22 && !ghost) {
      drawAdvert(
        b,
        t,
        x + ox + w + 0.008,
        y + oy + 0.025,
        d - 0.05,
        8,
        tall - 11,
        on,
      );
    }
    // Side sheds, fuel tanks, roof antennas and scattered warning lights.
    if (v(28) > 0.6)
      face(x + 0.7, y + 0.42, 0.2, 0.3, 3, 9 + v(29) * 8, [
        '#6c7c66',
        '#435a44',
        '#304a34',
      ]);
    if (v(30) > 0.65) {
      line(
        iso(x + 0.6, y + 0.5, tall + 5),
        iso(x + 0.6, y + 0.5, tall + 22),
        '#9ca88c',
        0.7,
      );
      line(
        iso(x + 0.5, y + 0.5, tall + 18),
        iso(x + 0.7, y + 0.5, tall + 18),
        '#9ca88c',
        0.7,
      );
    }
    if (on && v(32) > 0.6) {
      let p = iso(x + 0.23, y + 0.25, tall + 6);
      ctx.fillStyle = Math.sin(t * 2 + b.id) > 0.2 ? '#d3825d' : '#6c6045';
      ctx.fillRect(p[0], p[1], 1.5, 1.5);
    }
    if (selected === b) {
      let p = iso(x + 0.5, y + 0.5, tall + 18);
      ctx.fillStyle = '#e0e4c4';
      ctx.beginPath();
      ctx.arc(...p, 2, 0, 7);
      ctx.fill();
    }
    buildingIdentity(b, t, ghost);
    ctx.globalAlpha = 1;
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
    } = frame);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#111b1c';
    ctx.fillRect(0, 0, W, H);
    let bg = ctx.createRadialGradient(
      W * 0.55,
      H * 0.5,
      40,
      W * 0.5,
      H * 0.5,
      W * 0.65,
    );
    bg.addColorStop(0, '#2c3933');
    bg.addColorStop(1, '#101a1c');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.translate(W * 0.53 + panX, H * 0.53 + panY);
    ctx.scale(zoom, zoom);
    for (const tile of [...terrain.values()].sort(
      (a, b) => a.x + a.y - b.x - b.y,
    )) {
      let { x, y } = tile;
      let r = 0;
      let noise = Math.abs(Math.sin(x * 128.4 + y * 33.7));
      let road = x % 4 === 0 || y % 4 === 0;
      let a = iso(x, y),
        b = iso(x + 1, y),
        c = iso(x + 1, y + 1),
        d = iso(x, y + 1);
      poly(
        [a, b, c, d],
        road ? '#24332f' : noise > 0.5 ? '#354139' : '#303d35',
        grid ? '#5c6c4f' : '#3b473b',
      );
      if (road) {
        line(iso(x + 0.2, y + 0.2), iso(x + 0.8, y + 0.8), '#60705a', 0.6);
        if (y % 4 === 0) {
          line(iso(x, y + 0.36), iso(x + 1, y + 0.36), '#6e7460', 1);
          line(iso(x, y + 0.64), iso(x + 1, y + 0.64), '#6e7460', 1);
          for (let j = 0; j < 4; j++)
            line(
              iso(x + j * 0.25, y + 0.25),
              iso(x + j * 0.25, y + 0.75),
              '#435345',
              1,
            );
        }
      }
      if (!terrain.has(key(x + 1, y)) && noise > 0.6)
        face(x + 0.4, y + 0.4, 0.06, 0.06, 0, 4, [
          '#b7bb87',
          '#8d8c58',
          '#656f48',
        ]);
    }
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
        valid ? '#d0e6ad22' : '#dd9a7833',
        valid ? '#c5d7a0' : '#dd9a78',
      );
      if (mode !== 'inspect' && valid)
        building(
          {
            x,
            y,
            h: mode === 'power' ? 60 : 35,
            type: mode,
            on: true,
            variant: 0.5,
          },
          clock,
          true,
        );
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
    vignette.addColorStop(0, '#07110f00');
    vignette.addColorStop(1, '#07110f99');
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
