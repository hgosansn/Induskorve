import { expect, test } from '@playwright/test';

test('foundry sprites update a reduced-motion preview after decoding and share image requests', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  let release = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  const requests: string[] = [],
    errors: string[] = [];
  page.on('request', (r) => {
    if (r.resourceType() === 'image' && r.url().endsWith('.webp'))
      requests.push(r.url());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/*.webp', async (route) => {
    await held;
    await route.continue();
  });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'City', exact: true }).click();
  await page.getByRole('button', { name: 'Design atlas', exact: true }).click();
  await page.getByRole('radio', { name: 'Foundry', exact: true }).click();
  const canvas = page.getByLabel('Configured building preview', {
    exact: true,
  });
  await expect
    .poll(() => canvas.evaluate((el: HTMLCanvasElement) => el.width))
    .toBeGreaterThan(0);
  await page.waitForTimeout(150);
  const fallback = await canvas.evaluate((el: HTMLCanvasElement) =>
    el.toDataURL(),
  );
  release();
  await expect
    .poll(() => canvas.evaluate((el: HTMLCanvasElement) => el.toDataURL()))
    .not.toBe(fallback);
  await page.waitForLoadState('networkidle');
  expect(requests.some((url) => url.includes('city-furnace-256'))).toBe(true);
  expect(requests.some((url) => url.includes('-512'))).toBe(false);
  expect(new Set(requests).size).toBe(requests.length);
  expect(errors).toEqual([]);
});
