import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';

const id = process.argv[2] ?? '2026-10-30-pilot-01';
const round = process.argv[3] ?? 'review-r0';
if (!/^[\w-]{1,80}$/.test(id) || !/^[\w-]{1,80}$/.test(round))
  throw Error('Invalid run/round identity');
const root = resolve('asset-studies/mesh-pilot/runs', id),
  out = join(root, 'captures', round);
await mkdir(join(root, 'captures'), { recursive: true });
await mkdir(out);
const before = await readFile(join(root, 'review-sheet.json'));
const sheet = JSON.parse(before);
const server = await createServer({
  configLoader: 'native',
  server: { host: '127.0.0.1', port: 0, strictPort: false },
});
let browser;
try {
  await server.listen();
  const port = server.httpServer.address().port;
  browser = await chromium.launch({
    channel: process.env.E2E_CHANNEL || 'msedge',
  });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1,
    reducedMotion: 'reduce',
  });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => {
    for (const method of ['getItem', 'setItem', 'removeItem', 'clear'])
      Storage.prototype[method] = () => {
        throw Error('Mesh pilot accessed persistent browser storage');
      };
  });
  await page.goto(`http://127.0.0.1:${port}/mesh-pilot.html?run=${id}`);
  await page.locator('[data-pilot-ready="true"]').waitFor();
  const loadButtons = page.getByRole('button', {
    name: 'Load mesh and city context',
    exact: true,
  });
  while (await loadButtons.count()) await loadButtons.first().click();
  await page.waitForFunction(
    (count) =>
      document.querySelectorAll('[data-candidate]').length === count &&
      [...document.querySelectorAll('[data-capture] canvas')].every(
        (c) =>
          c.dataset.rendered === 'true' ||
          c.getAttribute('aria-label') === 'Configured building preview',
      ),
    sheet.candidates.length,
  );
  await page.waitForFunction(
    (count) =>
      document.querySelectorAll('[data-capture$="-context-idle"] canvas')
        .length === count &&
      [...document.querySelectorAll('[data-capture$="-context"] canvas')].every(
        (c) => c.width === c.clientWidth && c.width > 300,
      ),
    sheet.candidates.length,
  );
  await page.evaluate(() => document.fonts.ready);
  const files = [];
  for (const section of await page.locator('[data-capture]').all()) {
    const name = await section.getAttribute('data-capture');
    await section.screenshot({
      path: join(out, `${name}.png`),
      animations: 'disabled',
    });
    files.push(`${name}.png`);
  }
  for (const article of await page.locator('[data-candidate]').all()) {
    const label = await article.getAttribute('data-candidate');
    await article.locator('summary').click();
    const inspector = article.getByLabel('Retained mesh inspector');
    await inspector.screenshot({ path: join(out, `${label}-mesh-city.png`) });
    await article.getByRole('button', { name: 'Rotate inspection' }).click();
    await inspector.screenshot({
      path: join(out, `${label}-mesh-rotated.png`),
    });
    await article.locator('summary').click();
    files.push(`${label}-mesh-city.png`, `${label}-mesh-rotated.png`);
  }
  await page.screenshot({
    path: join(out, 'contact-sheet.png'),
    fullPage: true,
    animations: 'disabled',
  });
  if (errors.length) throw Error(errors.join('\n'));
  const after = await readFile(join(root, 'review-sheet.json'));
  if (!before.equals(after)) throw Error('Review sheet changed during capture');
  await writeFile(
    join(out, 'capture.json'),
    JSON.stringify(
      {
        schemaVersion: 1,
        run: id,
        round,
        browser: browser.version(),
        viewport: { width: 1440, height: 1000, dpr: 1 },
        reviewSheetSha256: createHash('sha256').update(before).digest('hex'),
        contextSha256: sheet.contextSha256,
        storageIsolation: 'persistent Storage methods throw',
        files: [...files, 'contact-sheet.png'],
        errors,
      },
      null,
      2,
    ) + '\n',
  );
  console.log(
    `Captured ${files.length} blind review and mesh-inspection views: ${out}`,
  );
} finally {
  await browser?.close();
  await server.close();
}
