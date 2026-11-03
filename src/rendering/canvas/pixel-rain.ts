import type { Palette } from '../palette';
import type { RenderFrame } from './view-model';

/** Bounded deterministic weather in the low-resolution city buffer. */
export function paintPixelRain(
  ctx: CanvasRenderingContext2D,
  frame: RenderFrame,
  p: Palette,
  time: number,
) {
  const { W, H, dpr } = frame;
  const snap = (n: number) => Math.round(n / 2) * 2;
  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const count = Math.min(220, Math.ceil((W * H) / 6500));
  for (let i = 0; i < count; i++) {
    const y = ((i * 173.39 + time * (70 + (i % 5) * 17)) % (H + 24)) - 12;
    const x = ((i * 347.71 + time * 19) % (W + 24)) - 12;
    ctx.fillStyle =
      i % 4 === 0 ? p['concrete-light'] + '65' : p.materials + '38';
    ctx.fillRect(snap(x), snap(y), 2, 4);
    ctx.fillRect(snap(x) + 2, snap(y) + 4, 2, i % 3 === 0 ? 6 : 4);
  }
  let i = 0;
  for (const road of frame.streets.roads.values()) {
    const index = i++;
    if (index % 5 !== 0) continue;
    const phase = (time + index * 0.137) % 1.8;
    if (phase > 0.22) continue;
    const x = snap(W * 0.53 + frame.panX + (road.x - road.y) * 27 * frame.zoom);
    const y = snap(
      H * 0.53 + frame.panY + (road.x + road.y + 1) * 13.5 * frame.zoom,
    );
    if (x < 0 || x > W || y < 0 || y > H) continue;
    ctx.fillStyle = p.materials + (phase < 0.1 ? '55' : '22');
    const spread = phase < 0.1 ? 2 : 4;
    ctx.fillRect(x - spread, y, 2, 2);
    ctx.fillRect(x + spread, y, 2, 2);
  }
  ctx.restore();
}
