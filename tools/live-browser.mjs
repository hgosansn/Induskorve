import { chromium, expect } from '@playwright/test';
import { createServer } from 'vite';
import { resolve } from 'node:path';

export async function verifyLiveBrowser(uri, database, directory) {
  const vite = await createServer({
    configLoader: 'native',
    server: { host: '127.0.0.1', port: 0 },
    plugins: [
      {
        name: 'isolated-live-test',
        configureServer(server) {
          server.middlewares.use('/__live-test', async (req, res) => {
            res.setHeader('Content-Type', 'text/html');
            res.end(
              await server.transformIndexHtml(
                '/__live-test',
                '<!doctype html><html><head></head><body><div id="root"></div><script type="module" src="/tests/live/browser-harness.tsx"></script></body></html>',
              ),
            );
          });
        },
      },
    ],
  });
  let browser;
  try {
    await vite.listen();
    browser = await chromium.launch({
      channel: process.env.E2E_CHANNEL || 'msedge',
    });
    const a = await browser.newContext({
        viewport: { width: 1440, height: 1000 },
        reducedMotion: 'reduce',
      }),
      b = await browser.newContext({
        viewport: { width: 1440, height: 1000 },
        reducedMotion: 'reduce',
      });
    const pages = await Promise.all([a.newPage(), b.newPage()]);
    const errors = [];
    for (const page of pages) {
      page.on('pageerror', (error) => errors.push(error.message));
      await page.addInitScript(() => {
        localStorage.setItem('onecity-v2', 'preserve-invalid-local-save');
      });
    }
    const url = `${vite.resolvedUrls.local[0]}__live-test?server=${encodeURIComponent(uri)}&database=${encodeURIComponent(database)}`;
    await Promise.all(pages.map((p) => p.goto(url)));
    for (const [i, page] of pages.entries()) {
      await expect(
        page.getByText('The founding district · shared city'),
      ).toBeVisible();
      await page.getByRole('button', { name: 'Join city' }).click();
      await page.getByLabel('Citizen name').fill(`Browser citizen ${i + 1}`);
      await page.getByRole('button', { name: 'Enter the city' }).click();
      await expect(
        page.getByRole('button', { name: 'Contribute', exact: true }),
      ).toBeVisible();
      await page.getByRole('button', { name: 'Close city guide' }).click();
    }
    for (const page of pages) {
      await page.getByRole('button', { name: 'City', exact: true }).click();
      await expect(page.getByText(/5 citizens · 24/)).toBeVisible();
      await expect(page.getByText(/Saved to the shared city/)).toBeVisible();
      expect(
        await page.evaluate(() => localStorage.getItem('onecity-v2')),
      ).toBe('preserve-invalid-local-save');
    }
    await pages[0].keyboard.press('Escape');
    await pages[0].screenshot({ path: resolve(directory, 'live-city.png') });
    expect(errors).toEqual([]);
    console.log(
      'Live browser verification passed: two joined sessions, shared citizens, preserved local saves, no browser errors.',
    );
  } finally {
    await browser?.close();
    await vite.close();
  }
}
