import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

await mkdir('docs/images', { recursive: true });
const browser = await chromium.launch({
  channel: process.env.E2E_CHANNEL || 'msedge',
});
try {
  const page = await browser.newPage({
    viewport: { width: 1600, height: 1000 },
    deviceScaleFactor: 1,
    reducedMotion: 'reduce',
  });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(process.env.PROMO_URL || 'http://127.0.0.1:4184/');
  await page.waitForLoadState('networkidle');
  await page.mouse.move(15, 970);
  await page.screenshot({
    path: 'docs/images/city-nocturne.jpg',
    type: 'jpeg',
    quality: 85,
  });
  await page.mouse.move(850, 650);
  await page.mouse.wheel(0, -460);
  await page.mouse.move(15, 970);
  await page.waitForTimeout(250);
  await page.screenshot({
    path: 'docs/images/streets-and-screens.jpg',
    type: 'jpeg',
    quality: 85,
  });
  await page
    .getByRole('button', { name: 'City projects', exact: true })
    .click();
  await page.screenshot({
    path: 'docs/images/city-projects.jpg',
    type: 'jpeg',
    quality: 85,
  });
  if (errors.length) throw new Error(errors.join('\n'));
  console.log('Captured three real prototype screenshots. No page errors.');
} finally {
  await browser.close();
}
