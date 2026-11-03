import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';

const root = process.argv[2] ?? 'asset-studies/foundry/integration-03';
await mkdir(root, { recursive: true });
const start = performance.now();
const server = await createServer({
  configLoader: 'native',
  server: { host: '127.0.0.1', port: 0 },
});
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ channel: 'msedge' });
  const page = await browser.newPage({ reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const base = `http://127.0.0.1:${server.httpServer.address().port}`;
  const recipe = JSON.parse(
    await readFile('asset-studies/foundry/recipe.json', 'utf8'),
  );
  await page.goto(`${base}/parts-batch.html`);
  const measurement = await page.evaluate(async (recipe) => {
    const [
      { createBuildingRenderer },
      { readPalette },
      { projectWorld },
      { foundryKit },
      { loadReusablePart },
    ] = await Promise.all([
      import('/src/rendering/canvas/buildings.ts'),
      import('/src/rendering/palette.ts'),
      import('/src/rendering/canvas/view-model.ts'),
      import('/src/rendering/canvas/foundry-kit.ts'),
      import('/src/rendering/assets/reusable-parts.ts'),
    ]);
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    ctx.translate(220, 430);
    ctx.scale(4, 4);
    const world = projectWorld({
      version: 3,
      citizens: [],
      buildings: [
        {
          id: 1,
          x: 0,
          y: 0,
          type: 'factory',
          on: true,
          modules: recipe.draft.modules,
        },
      ],
      appearances: [
        {
          buildingId: 1,
          height: recipe.draft.height,
          seed: recipe.draft.seed,
          design: recipe.draft.design,
        },
      ],
    });
    const building = world.buildings.get('0,0');
    const draw = createBuildingRenderer(ctx, readPalette());
    const render = () => draw(building, true, 0, { zoom: 4 });
    const cold = performance.now();
    render();
    const firstFallbackDrawMs = performance.now() - cold;
    const sample = () => {
      const runs = [];
      for (let batch = 0; batch < 30; batch++) {
        const at = performance.now();
        for (let i = 0; i < 20; i++) render();
        runs.push((performance.now() - at) / 20);
      }
      runs.sort((a, b) => a - b);
      return { medianMsPerDraw: runs[15], p95MsPerDraw: runs[28], draws: 600 };
    };
    const fallbackCached = sample();
    const needed = foundryKit.filter((p) => p.id !== 'louver-side');
    const loadStart = performance.now();
    const images = await Promise.all(needed.map((p) => loadReusablePart(p)));
    const loadAndDecodeMs = performance.now() - loadStart;
    const ready = performance.now();
    render();
    const firstSpriteCacheDrawMs = performance.now() - ready;
    const spriteCached = sample();
    const resources = performance
      .getEntriesByType('resource')
      .filter(
        (r) =>
          r.initiatorType === 'img' &&
          needed.some((p) => r.name.endsWith(p.variants[256].file)),
      );
    const roleTimings = [];
    for (const [type, modules, stock] of [
      ['power', ['turbine', 'heat-exchanger'], 0],
      ['factory', ['furnace', 'scrubber'], 0],
      ['warehouse', ['loading-bay', 'solar-roof'], 200],
    ]) {
      const state = projectWorld({
        version: 3,
        citizens: [],
        buildings: [{ id: 1, x: 0, y: 0, type, on: true, modules }],
        appearances: [
          {
            buildingId: 1,
            height: recipe.draft.height,
            seed: recipe.draft.seed,
            design: recipe.draft.design,
          },
        ],
      });
      const b = state.buildings.get('0,0');
      b.stock = stock;
      const paint = createBuildingRenderer(ctx, readPalette());
      const at = performance.now();
      paint(b, true, 0, { zoom: 4 });
      const firstCacheDrawMs = performance.now() - at;
      const samples = [];
      for (let batch = 0; batch < 30; batch++) {
        const t = performance.now();
        for (let i = 0; i < 20; i++) paint(b, true, 0, { zoom: 4 });
        samples.push((performance.now() - t) / 20);
      }
      samples.sort((a, b) => a - b);
      roleTimings.push({
        type,
        firstCacheDrawMs,
        cachedMedianMs: samples[15],
        cachedP95Ms: samples[28],
        draws: 600,
      });
    }
    return {
      roleTimings,
      firstFallbackDrawMs,
      loadAndDecodeMs,
      firstSpriteCacheDrawMs,
      fallbackCached,
      spriteCached,
      actualUsedSprites: needed.map((p) => p.id),
      spriteFileBytes: needed.reduce((n, p) => n + p.variants[256].bytes, 0),
      decodedRGBABytes: images.reduce(
        (n, p) => n + p.naturalWidth * p.naturalHeight * 4,
        0,
      ),
      resources: resources.map((r) => ({
        name: r.name.split('/').at(-1),
        encodedBodySize: r.encodedBodySize,
        transferSize: r.transferSize,
      })),
    };
  }, recipe);
  const context = await browser.newContext({
    reducedMotion: 'reduce',
    viewport: { width: 1440, height: 1000 },
  });
  const city = await context.newPage();
  const requests = [];
  city.on('request', (r) => {
    if (r.resourceType() === 'image' && r.url().endsWith('.webp'))
      requests.push(r.url());
  });
  await city.goto(`${base}/`);
  await city.waitForTimeout(700);
  const cityBeforeAtlas = {
    webpRequests: requests.length,
    unique: new Set(requests).size,
  };
  await city.getByRole('button', { name: 'City', exact: true }).click();
  await city.getByRole('button', { name: 'Design atlas', exact: true }).click();
  await city.getByRole('radio', { name: 'Foundry', exact: true }).click();
  await city.waitForLoadState('networkidle');
  await city.screenshot({ path: `${root}/actual-city-atlas.png` });
  const allKitBytes = JSON.parse(
    await readFile('src/rendering/assets/foundry-kit-01/catalog.json', 'utf8'),
  ).parts.reduce((n, p) => n + p.variants[256].bytes, 0);
  const report = {
    measuredAt: new Date().toISOString(),
    seconds: (performance.now() - start) / 1000,
    measurement,
    cityBeforeAtlas,
    allKitBytes,
    errors,
    limits:
      'Local installed Edge, isolated single-building cached Canvas renderer at zoom4, no terrain/adverts/networks; synchronous CPU submission timing is not GPU/frame-time or city-scale FPS. Includes dev-server transfer overhead. Wall time starts after fallback benchmark for load/decode.',
  };
  if (errors.length) throw Error(errors.join(';'));
  await writeFile(
    `${root}/browser-cost.json`,
    JSON.stringify(report, null, 2) + '\n',
  );
  console.log(JSON.stringify(report));
} finally {
  await browser?.close();
  await server.close();
}
