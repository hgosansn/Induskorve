import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { mkdir, writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';

const root = 'asset-studies/current-kit-01/sweep';
await mkdir(root, { recursive: true });
const start = performance.now();
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
    viewport: { width: 1440, height: 1100 },
    reducedMotion: 'reduce',
  });
  let currentCase = 'startup';
  const errors = [];
  page.on('pageerror', (e) =>
    errors.push({ case: currentCase, message: e.message, stack: e.stack }),
  );
  const cases = [],
    profiles = [];
  const modules = {
    power: ['turbine', 'heat-exchanger'],
    factory: ['furnace', 'scrubber'],
    warehouse: ['loading-bay', 'solar-roof'],
  };
  for (const kind of Object.keys(modules))
    for (const shape of ['block', 'stepped', 'tower']) {
      for (const height of [24, 85])
        cases.push({
          kind,
          shape,
          height,
          modules: modules[kind],
          stock: kind === 'warehouse' ? 200 : 0,
          profile: true,
        });
      cases.push({ kind, shape, height: 78, modules: [], stock: 0 });
      if (kind === 'warehouse')
        for (const stock of [0, 150, 400])
          cases.push({
            kind,
            shape,
            height: 78,
            modules: modules[kind],
            stock,
          });
      if (kind === 'factory')
        for (const subset of [['furnace'], ['scrubber']])
          cases.push({ kind, shape, height: 78, modules: subset, stock: 0 });
    }
  for (const kind of Object.keys(modules))
    cases.push({
      kind,
      shape: 'stepped',
      height: 78,
      modules: modules[kind],
      stock: kind === 'warehouse' ? 200 : 0,
      lineup: true,
    });
  for (const subset of [['turbine'], ['heat-exchanger']])
    cases.push({
      kind: 'power',
      shape: 'stepped',
      height: 78,
      modules: subset,
      stock: 0,
    });
  await page.goto(`${base}/asset-study.html`);
  await page.waitForLoadState('networkidle');
  await page.evaluate(async () => {
    const [{ foundryKit }, { loadReusablePart }] = await Promise.all([
      import('/src/rendering/canvas/foundry-kit.ts'),
      import('/src/rendering/assets/sprite-runtime.ts'),
    ]);
    await Promise.all(foundryKit.map((p) => loadReusablePart(p)));
  });
  const results = [];
  for (const [index, c] of cases.entries()) {
    currentCase = JSON.stringify(c);
    const recipe = {
      draft: {
        kind: c.kind,
        height: c.height,
        seed: 0.5,
        modules: c.modules,
        design: {
          shape: c.shape,
          stacks: true,
          balcony: true,
          display: 'none',
        },
      },
      stock: c.stock,
    };
    await page.goto(
      `${base}/asset-study.html?recipe=${encodeURIComponent(JSON.stringify(recipe))}`,
    );
    await page.locator('[data-study-ready]').waitFor({ timeout: 5000 });
    await page.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        ),
    );
    const metadata = JSON.parse(
      await page.locator('#study-metadata').textContent(),
    );
    if (metadata.errors.length)
      throw Error(JSON.stringify({ case: c, errors: metadata.errors }));
    if (c.kind === 'warehouse') {
      const cargo = metadata.assembly.parts.filter(
        (p) => p.kind === 'cargo',
      ).length;
      if (cargo !== Math.min(8, Math.ceil(c.stock / 50)))
        throw Error('Stock artwork count mismatch');
    }
    for (const [module, part] of [
      ['furnace', 'second-furnace'],
      ['turbine', 'extra-turbine'],
      ['heat-exchanger', 'heat-recovery'],
      ['loading-bay', 'gantry'],
      ['solar-roof', 'solar'],
    ])
      if (
        metadata.assembly.parts.some((p) => p.id === part) !==
        c.modules.includes(module)
      )
        throw Error(`Module presence mismatch ${part}`);
    const id = `${index}-${c.kind}-${c.shape}-${c.height}-${c.stock}`;
    if (
      c.kind === 'warehouse' &&
      c.shape === 'stepped' &&
      c.height === 78 &&
      c.modules.length > 0
    )
      await page
        .locator('[data-capture="close"] canvas')
        .screenshot({ path: `${root}/warehouse-stock-${c.stock}.png` });
    if (c.profile || c.lineup) {
      await page
        .locator('[data-capture="close"] canvas')
        .screenshot({ path: `${root}/${id}.png` });
      const shot = { ...c, id };
      if (c.profile) profiles.push(shot);
      if (c.lineup) results.push({ ...shot, lineup: true });
    }
    results.push({
      ...c,
      id,
      passed: true,
      parts: metadata.assembly.parts.length,
    });
  }
  // Three equal-frame role views and a second sheet spanning all profiles/heights.
  for (const [name, shots] of [
    ['lineup', results.filter((r) => r.lineup && !r.passed)],
    ['profiles', profiles],
  ]) {
    await page.setContent(
      `<link rel="stylesheet" href="${base}/src/app/palette.css"><style>body{margin:0;background:var(--background);color:var(--foreground);font:14px monospace}main{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;padding:12px}figure{margin:0;border:1px solid var(--edge)}figcaption{padding:8px}img{width:100%;display:block}</style><main>${shots.map((s) => `<figure><figcaption>${s.kind} · ${s.shape} · h${s.height}</figcaption><img src="${base}/${root}/${s.id}.png"></figure>`).join('')}</main>`,
    );
    await page
      .locator('img')
      .evaluateAll((imgs) => Promise.all(imgs.map((i) => i.decode())));
    await page
      .locator('main')
      .screenshot({ path: `asset-studies/current-kit-01/${name}.png` });
  }
  if (errors.length) throw Error(JSON.stringify(errors));
  const report = {
    passed: true,
    measuredAt: new Date().toISOString(),
    seconds: (performance.now() - start) / 1000,
    caseCount: cases.length,
    cases: results.filter((r) => r.passed),
    errors,
    limits:
      'Fixed seed .5. Short/tall profiles, module states and empty/partial/full stock are reviewed samples, not every saved-city combination or engineering validation.',
  };
  await writeFile(
    `${root}/report.json`,
    JSON.stringify(report, null, 2) + '\n',
  );
  console.log(
    JSON.stringify({
      passed: true,
      caseCount: cases.length,
      seconds: report.seconds,
      errors,
    }),
  );
} finally {
  await browser?.close();
  await server.close();
}
