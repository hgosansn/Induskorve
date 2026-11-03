import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';

const start = performance.now();
const originalKit = JSON.parse(
  await readFile('src/rendering/assets/parts-batch-01/catalog.json', 'utf8'),
);
const isOriginalSprite = (url) =>
  originalKit.parts.some((p) =>
    Object.values(p.variants).some((v) => url.endsWith(v.file)),
  );
const root = 'asset-studies/parts-batch-01-r1';
await mkdir(root, { recursive: true });
const server = await createServer({
  configLoader: 'native',
  server: { host: '127.0.0.1', port: 0 },
});
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ channel: 'msedge' });
  const page = await browser.newPage({
    viewport: { width: 1400, height: 1100 },
    deviceScaleFactor: 1,
  });
  const errors = [],
    requests = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('request', (r) => requests.push(r.url()));
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/`);
  await page.getByRole('button', { name: 'City', exact: true }).click();
  const initialSprites = requests.filter(isOriginalSprite).length;
  if (initialSprites !== 0)
    throw Error('Kit textures eagerly loaded into city');
  await page.getByRole('button', { name: 'Design atlas', exact: true }).click();
  await page
    .getByRole('radio', { name: 'Reusable parts', exact: true })
    .click();
  await page.locator('[data-parts-ready="true"]').waitFor();
  await page.locator('canvas[data-rendered="true"]').waitFor();
  const normalRequests = requests.filter(
    (url) => url.includes('-256') && isOriginalSprite(url),
  ).length;
  const closeBefore = requests.filter(
    (url) => url.includes('-512') && isOriginalSprite(url),
  ).length;
  if (normalRequests !== 8 || closeBefore !== 0)
    throw Error(
      `Unexpected normal/close texture requests: ${normalRequests}/${closeBefore}`,
    );
  await page
    .locator('[data-contact-sheet]')
    .screenshot({ path: `${root}/contact-sheet.png` });
  await page.getByRole('button', { name: 'Closer view', exact: true }).click();
  await page.waitForFunction(
    () =>
      performance
        .getEntriesByType('resource')
        .filter((e) => e.name.includes('-512') && e.name.endsWith('.webp'))
        .length === 8,
  );
  await page.waitForTimeout(300);
  await page
    .locator('canvas[aria-label="Reusable extraction service cell"]')
    .screenshot({ path: `${root}/assembly-close.png` });
  await page
    .getByRole('button', { name: 'Normal assembly view', exact: true })
    .click();
  const normalAgain = requests.filter(
    (url) => url.includes('-256') && isOriginalSprite(url),
  ).length;
  if (normalAgain !== 8 || errors.length)
    throw Error(`Cache or browser failure: ${JSON.stringify(errors)}`);
  const decodedBytes = await page
    .locator('[data-contact-sheet] img')
    .evaluateAll((images) =>
      images.reduce(
        (n, image) => n + image.naturalWidth * image.naturalHeight * 4,
        0,
      ),
    );
  const report = {
    passed: true,
    initialSprites,
    normalRequests,
    closeBefore,
    closeRequests: 8,
    normalAgain,
    normalDecodedRGBABytes: decodedBytes,
    errors,
    seconds: (performance.now() - start) / 1000,
  };
  await writeFile(
    `${root}/browser-verification.json`,
    JSON.stringify(report, null, 2) + '\n',
  );
  console.log(JSON.stringify(report));
} finally {
  await browser?.close();
  await server.close();
}
