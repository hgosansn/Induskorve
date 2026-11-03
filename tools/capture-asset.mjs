import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { resolve, relative, join, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { format } from 'prettier';

// A fresh directory prevents a later iteration overwriting its baseline.
const output = resolve(
  process.argv[2] ??
    `asset-studies/foundry/captures/${new Date().toISOString().replaceAll(':', '-')}`,
);
const recipe = process.argv[3]
  ? JSON.parse(await readFile(resolve(process.argv[3]), 'utf8'))
  : undefined;
await mkdir(dirname(output), { recursive: true });
await mkdir(output, { recursive: false });
const server = await createServer({
  configLoader: 'native',
  server: { host: '127.0.0.1', port: 4181, strictPort: true },
});
let browser;
try {
  await server.listen();
  browser = await chromium.launch({
    channel: process.env.E2E_CHANNEL || 'msedge',
  });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1100 },
    deviceScaleFactor: 1,
    reducedMotion: 'reduce',
  });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  // Assert the isolated tool never accesses persistent city state.
  await page.addInitScript(() => {
    for (const method of ['getItem', 'setItem', 'removeItem', 'clear'])
      Storage.prototype[method] = () => {
        throw new Error('Asset study accessed browser storage');
      };
  });
  await page.goto(
    `http://127.0.0.1:4181/asset-study.html${recipe ? `?recipe=${encodeURIComponent(JSON.stringify(recipe))}` : '?'}${process.argv.includes('--pieces') ? '&pieces=true' : ''}`,
  );
  await page.locator('[data-study-ready]').waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.waitForLoadState('networkidle');
  await page.waitForFunction(() =>
    [...document.querySelectorAll('canvas')].every(
      (c) =>
        c.width === c.clientWidth && c.width > 0 && c.height === c.clientHeight,
    ),
  );
  const metadata = JSON.parse(
    await page.locator('#study-metadata').textContent(),
  );
  if (metadata.errors.length) throw new Error(metadata.errors.join('\n'));
  const files = [];
  for (const figure of await page.locator('[data-capture]').all()) {
    const filename = `${await figure.getAttribute('data-capture')}.png`;
    await figure.screenshot({
      path: join(output, filename),
      animations: 'disabled',
    });
    files.push(filename);
  }
  await page.screenshot({
    path: join(output, 'contact-sheet.png'),
    fullPage: true,
    animations: 'disabled',
  });
  if (errors.length) throw new Error(errors.join('\n'));
  const hash = createHash('sha256');
  async function hashSources(dir) {
    for (const entry of (await readdir(dir, { withFileTypes: true })).sort(
      (a, b) => a.name.localeCompare(b.name),
    )) {
      const file = join(dir, entry.name);
      if (entry.isDirectory()) await hashSources(file);
      else {
        hash.update(relative(process.cwd(), file).replaceAll('\\', '/'));
        hash.update(await readFile(file));
      }
    }
  }
  await hashSources(resolve('src'));
  await writeFile(
    join(output, 'manifest.json'),
    await format(
      JSON.stringify(
        {
          ...metadata,
          capturedAt: new Date().toISOString(),
          gitHead: execFileSync('git', ['rev-parse', 'HEAD'], {
            encoding: 'utf8',
          }).trim(),
          sourceSha256: hash.digest('hex'),
          viewport: { width: 1440, height: 1100, dpr: 1 },
          clock: 0,
          browser: browser.version(),
          files: [...files, 'contact-sheet.png'],
        },
        null,
        2,
      ),
      { parser: 'json' },
    ),
  );
  console.log(`Captured ${files.length} views and contact sheet: ${output}`);
} finally {
  await browser?.close();
  await server.close();
}
