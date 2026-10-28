import { expect, test } from '@playwright/test';

test('static assets and lazy UI resolve beneath a Pages repository path', async ({
  page,
}) => {
  const failures: string[] = [];
  page.on('pageerror', (error) => failures.push(error.message));
  page.on('response', (response) => {
    if (response.status() >= 400) failures.push(response.url());
  });
  // Model a static host mounting dist/ at /Induskorve/, with no SPA rewrites.
  await page.route('**/Induskorve/**', async (route) => {
    const url = new URL(route.request().url());
    url.pathname = url.pathname.replace(/^\/Induskorve/, '');
    const response = await route.fetch({ url: url.href });
    await route.fulfill({ response });
  });
  await page.goto('/Induskorve/');
  await page.getByRole('button', { name: 'Join city' }).click();
  await expect(page.getByLabel('Citizen name', { exact: true })).toBeVisible();
  expect(failures).toEqual([]);
});

test('spectator, join, cancel, leave and persistence', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'INDUSKORVE', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('radiogroup', { name: 'Construction tools' }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Join city' }).click();
  await page.getByLabel('Citizen name', { exact: true }).fill('Test Citizen');
  await page.getByRole('button', { name: 'Enter the city' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(
    page.getByRole('radiogroup', { name: 'Construction tools' }),
  ).toBeVisible();
  await page.getByRole('radio', { name: 'Power', exact: true }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Click to build' }),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(
    page.getByRole('status').filter({ hasText: 'Click to build' }),
  ).toHaveCount(0);
  await page.getByRole('radio', { name: 'Power', exact: true }).click();
  await page
    .locator('canvas')
    .click({ position: { x: 350, y: 350 }, button: 'right' });
  await expect(
    page.getByRole('status').filter({ hasText: 'Click to build' }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Find my pedestrian' }).click();
  await page.getByRole('button', { name: 'Reset camera' }).click();
  await page.getByRole('button', { name: 'Leave edit mode' }).click();
  await expect(
    page.getByRole('radiogroup', { name: 'Construction tools' }),
  ).toHaveCount(0);
  await page.reload();
  await expect(page.getByText(/1 local citizens/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Join city' })).toBeVisible();
  expect(errors).toEqual([]);
});
test('legacy city migrates and remains inspectable', async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      'onecity-v2',
      JSON.stringify({
        buildings: [
          { id: 0, x: 0, y: 0, type: 'power', h: 85, on: true, variant: 0.6 },
        ],
        citizens: [],
      }),
    ),
  );
  await page.goto('/');
  await expect(page.getByText(/1 structures/)).toBeVisible();
  const canvas = page.locator('canvas');
  const box = (await canvas.boundingBox())!;
  await canvas.click({
    position: { x: box.width * 0.53, y: box.height * 0.53 - 25 },
  });
  await expect(
    page.getByRole('heading', { name: 'Generating station' }),
  ).toBeVisible();
  await expect(page.getByText('Join city to interact')).toBeVisible();
});
test('mobile controls and accessible join dismissal', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Join city' }).click();
  await expect(page.getByLabel('Citizen name', { exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Join city' })).toBeFocused();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test('construction, machinery switch and save survive a production reload', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.evaluate(() =>
    localStorage.setItem(
      'induskorve:city:v3',
      JSON.stringify({
        version: 3,
        buildings: [{ id: 0, x: 0, y: 0, type: 'power', on: true }],
        appearances: [{ buildingId: 0, height: 85, seed: 0.6 }],
        citizens: [],
      }),
    ),
  );
  await page.reload();
  await page.getByRole('button', { name: 'Join city' }).click();
  await page.getByLabel('Citizen name', { exact: true }).fill('Builder');
  await page.getByRole('button', { name: 'Enter the city' }).click();
  await page.getByRole('radio', { name: 'Storage', exact: true }).click();
  const canvas = page.locator('canvas');
  const box = (await canvas.boundingBox())!;
  const zoom = Math.min(box.width / 1100, box.height / 750) * 1.1;
  // Center of revealed tile (1,1) in the founding camera.
  await canvas.click({
    position: { x: box.width * 0.53, y: box.height * 0.53 + 40.5 * zoom },
  });
  await expect(page.getByText(/2 structures/)).toBeVisible();
  await page.keyboard.press('Escape');
  await canvas.click({
    position: { x: box.width * 0.53, y: box.height * 0.53 - 25 },
  });
  await expect(
    page.getByRole('heading', { name: 'Generating station' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Pause machinery' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Paused' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Close inspector' }).click();
  await page.reload();
  await expect(page.getByText(/2 structures/)).toBeVisible();
  const save = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('induskorve:city:v3')!),
  );
  expect(save.buildings.find((b: { id: number }) => b.id === 0).on).toBe(false);
  expect(save.buildings.find((b: { id: number }) => b.id === 1).creator).toBe(
    'Builder',
  );
  expect(errors).toEqual([]);
});
