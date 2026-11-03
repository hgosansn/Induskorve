import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { mkdir, writeFile } from 'node:fs/promises';
const root = 'asset-studies/streets-01';
await mkdir(root, { recursive: true });
const server = await createServer({
  configLoader: 'native',
  server: { host: '127.0.0.1', port: 0 },
});
let browser;
try {
  await server.listen();
  const base = `http://127.0.0.1:${server.httpServer.address().port}`;
  browser = await chromium.launch({ channel: 'msedge' });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: 'reduce',
  });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${base}/`);
  await page.waitForLoadState('networkidle');
  await page
    .locator('main > canvas')
    .screenshot({ path: `${root}/district-after.png` });
  await page.locator('main > canvas').hover();
  await page.mouse.wheel(0, -700);
  await page.waitForTimeout(350);
  await page
    .locator('main > canvas')
    .screenshot({ path: `${root}/close-after.png` });
  await page.evaluate(() => {
    document.body.innerHTML =
      '<main id="street-review" style="padding:20px;background:var(--background);color:var(--foreground)"><h1>Street fixtures and local pedestrian variety</h1><h2>Junction, road-edge and pedestrian lighting</h2><canvas id="fixtures" width="1300" height="220"></canvas><h2>Six stable pedestrian silhouettes · standing and walking</h2><canvas id="people" width="1300" height="170"></canvas><h2>Checked curb pockets and aligned light pools</h2><canvas id="streets" width="1300" height="700"></canvas></main>';
  });
  const metrics = await page.evaluate(async () => {
    const [
      {
        createStreetPainter,
        createStreetLampRenderer,
        createStreetPropRenderer,
      },
      { streetScenery },
      { buildStreets },
      { readPalette },
      { createPedestrianRenderer, pedestrianAppearance },
    ] = await Promise.all([
      import('/src/rendering/canvas/streets.ts'),
      import('/src/rendering/canvas/street-scenery.ts'),
      import('/src/domain/city/streets.ts'),
      import('/src/rendering/palette.ts'),
      import('/src/rendering/canvas/pedestrians.ts'),
    ]);
    const p = readPalette();
    const canvasCount = [];
    const create = document.createElement.bind(document);
    document.createElement = function (tag, ...args) {
      const element = create(tag, ...args);
      if (tag === 'canvas') canvasCount.push(element);
      return element;
    };
    const terrain = new Map();
    for (let x = -5; x <= 5; x++)
      for (let y = -5; y <= 5; y++) terrain.set(`${x},${y}`, { x, y });
    const planStart = performance.now();
    const layout = buildStreets(new Map(), terrain);
    const topologyMs = performance.now() - planStart;
    const visualStart = performance.now(),
      scenery = streetScenery(layout);
    const sceneryPlanMs = performance.now() - visualStart;
    const fixture = document.querySelector('#fixtures').getContext('2d');
    const renderLamp = createStreetLampRenderer(fixture, p),
      renderProp = createStreetPropRenderer(fixture, p);
    const kinds = ['cantilever', 'twin', 'capped'];
    kinds.forEach((kind, i) => {
      for (let corner = 0; corner < 2; corner++) {
        const lamp = {
          ...scenery.lamps.find((l) => l.kind === kind),
          x: 0,
          y: 0,
        };
        if (corner) {
          lamp.corner = 2;
          lamp.heads = lamp.heads.map((h) => ({ x: -h.x, y: -h.y }));
        }
        fixture.save();
        fixture.translate(85 + i * 260 + corner * 90, 155);
        fixture.scale(5, 5);
        renderLamp(lamp);
        fixture.restore();
      }
      fixture.fillStyle = p.foreground;
      fixture.font = '13px monospace';
      fixture.fillText(kind, 70 + i * 260, 195);
    });
    ['cabinet', 'route-post', 'bollard'].forEach((kind, i) => {
      const prop = {
        ...scenery.props.find((v) => v.kind === kind),
        x: 0,
        y: 0,
      };
      fixture.save();
      fixture.translate(860 + i * 150, 155);
      fixture.scale(5, 5);
      renderProp(prop);
      fixture.restore();
      fixture.fillStyle = p.foreground;
      fixture.font = '12px monospace';
      fixture.fillText(kind, 825 + i * 150, 195);
    });
    const crowdCanvas = document.querySelector('#people'),
      crowd = crowdCanvas.getContext('2d'),
      drawPerson = createPedestrianRenderer(crowd, p);
    const profiles = new Map();
    for (let i = 0; profiles.size < 6 && i < 100; i++) {
      const w = {
        x: 0,
        y: 0,
        tx: 1,
        ty: 0,
        phase: i * 0.31,
        color: p.steel,
        ambient: true,
        moving: false,
      };
      profiles.set(pedestrianAppearance(w).kind, w);
    }
    [...profiles].forEach(([kind, w], i) => {
      crowd.save();
      crowd.translate(70 + i * 210, 105);
      crowd.scale(8, 8);
      drawPerson(w, 0);
      crowd.restore();
      crowd.save();
      crowd.translate(120 + i * 210, 105);
      crowd.scale(8, 8);
      drawPerson({ ...w, moving: true }, 0.8);
      crowd.restore();
      crowd.fillStyle = p.foreground;
      crowd.font = '12px monospace';
      crowd.fillText(kind, 55 + i * 210, 145);
    });
    const canvas = document.querySelector('#streets'),
      ctx = canvas.getContext('2d');
    const surface = document.createElement('canvas');
    surface.width = canvas.width;
    surface.height = canvas.height;
    const target = surface.getContext('2d');
    target.fillStyle = p.background;
    target.fillRect(0, 0, surface.width, surface.height);
    target.translate(650, 360);
    target.scale(1.9, 1.9);
    const at = performance.now(),
      painter = createStreetPainter(target, p);
    for (const road of layout.roads.values()) painter.road(road);
    painter.paths(layout);
    painter.lighting(layout);
    const staticBaseMs = performance.now() - at;
    const lamps = createStreetLampRenderer(ctx, p),
      props = createStreetPropRenderer(ctx, p),
      pedestrians = createPedestrianRenderer(ctx, p);
    const nodes = [...layout.nodes.values()];
    const walkers = Array.from({ length: 24 }, (_, i) => {
      const node = nodes[(i * 13) % nodes.length],
        next = layout.nodes.get(layout.neighbors.get(node.id)[0]);
      return {
        x: node.x,
        y: node.y,
        tx: next.x,
        ty: next.y,
        phase: i * 0.31,
        color: p.steel,
        ambient: true,
        moving: true,
      };
    });
    const entries = [
      ...scenery.lamps.map((l) => ({ ...l, lamp: l })),
      ...scenery.props.map((v) => ({ ...v, prop: v })),
      ...walkers.map((w) => ({ ...w, walker: w })),
    ].sort((a, b) => a.x + a.y - b.x - b.y);
    const render = (time) => {
      ctx.resetTransform();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(surface, 0, 0);
      ctx.translate(650, 360);
      ctx.scale(1.9, 1.9);
      for (const e of entries)
        if (e.lamp) lamps(e.lamp);
        else if (e.prop) props(e.prop);
        else pedestrians(e.walker, time);
    };
    const first = performance.now();
    render(0);
    const firstFixtureCrowdMs = performance.now() - first;
    const samples = [];
    for (let batch = 0; batch < 20; batch++) {
      const t = performance.now();
      for (let i = 0; i < 5; i++) render(batch * 0.05 + i * 0.01);
      samples.push((performance.now() - t) / 5);
    }
    samples.sort((a, b) => a - b);
    render(0.8);
    const bytes = canvasCount
      .filter((c) => c !== surface)
      .reduce((n, c) => n + c.width * c.height * 4, 0);
    document.createElement = create;
    return {
      roadTiles: layout.roads.size,
      lamps: scenery.lamps.length,
      lampFamilies: [...new Set(scenery.lamps.map((l) => l.kind))],
      raisedProps: scenery.props.length,
      propFamilies: [...new Set(scenery.props.map((v) => v.kind))],
      ambientWalkers: walkers.length,
      pedestrianFamilies: [...profiles.keys()],
      lampSprites: lamps.stats(),
      propSprites: props.stats(),
      staticBaseMs,
      topologyMs,
      sceneryPlanMs,
      firstFixtureCrowdMs,
      cachedMedianMs: samples[10],
      cachedP95Ms: samples[19],
      generatedReviewCachesRGBABytes: bytes,
      limits:
        'Local CPU Canvas submission, synthetic 11x11 terrain, no buildings/networks/GPU completion. Review cache bytes include separate gallery and scene renderers, not a product memory total. No downloaded image assets.',
    };
  });
  await page
    .locator('#street-review')
    .screenshot({ path: `${root}/contact-sheet.png` });
  for (const id of ['fixtures', 'people', 'streets'])
    await page.locator(`#${id}`).screenshot({ path: `${root}/${id}.png` });
  if (errors.length) throw Error(errors.join(';'));
  await writeFile(
    `${root}/cost.json`,
    JSON.stringify(
      { ...metrics, errors, measuredAt: new Date().toISOString() },
      null,
      2,
    ) + '\n',
  );
  console.log(JSON.stringify(metrics));
} finally {
  await browser?.close();
  await server.close();
}
