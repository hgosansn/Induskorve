import { test, expect } from '@playwright/test';
async function join(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: 'Join city' }).click();
  await page.getByLabel('Citizen name', { exact: true }).fill('Builder');
  await page.getByRole('button', { name: 'Enter the city' }).click();
}
test('workshop design persists through ghost placement and reload', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
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
  await expect(page.getByRole('button', { name: 'Add building' })).toHaveCount(
    0,
  );
  await join(page);
  await page.getByRole('button', { name: 'Add building' }).click();
  await page.getByRole('radio', { name: 'Storage', exact: true }).click();
  await page.getByRole('radio', { name: 'tower', exact: true }).click();
  await page.getByRole('radio', { name: 'No display', exact: true }).click();
  await page.getByLabel('Service balcony').uncheck();
  await page.screenshot({ path: 'test-results/workshop.png' });
  await page.getByRole('button', { name: 'Choose location' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const canvas = page.locator('main > canvas');
  const box = (await canvas.boundingBox())!;
  const zoom = Math.min(box.width / 1100, box.height / 750) * 1.1;
  await page.mouse.move(box.width * 0.53, box.height * 0.53 + 40.5 * zoom);
  await page.screenshot({ path: 'test-results/ghost.png' });
  await canvas.click({
    position: { x: box.width * 0.53, y: box.height * 0.53 + 40.5 * zoom },
  });
  await expect(
    page.getByRole('button', { name: 'Cancel placement' }),
  ).toHaveCount(0);
  await page.reload();
  const save = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('induskorve:city:v3')!),
  );
  expect(save.buildings).toHaveLength(2);
  expect(save.buildings[1].type).toBe('warehouse');
  expect(save.appearances[1].design).toEqual({
    shape: 'tower',
    stacks: true,
    balcony: false,
    display: 'none',
  });
  expect(save.appearances[1].height).toBe(48);
  expect(errors).toEqual([]);
});
test('cancel is non-mutating and bottom stays clear on mobile', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await join(page);
  const saved = await page.evaluate(() =>
    localStorage.getItem('induskorve:city:v3'),
  );
  await page.getByRole('button', { name: 'Add building' }).click();
  await page.getByRole('button', { name: 'Choose location' }).click();
  await page.keyboard.press('Escape');
  await expect(
    page.getByRole('button', { name: 'Cancel placement' }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Add building' }).click();
  await page.getByRole('button', { name: 'Choose location' }).click();
  await page
    .locator('main > canvas')
    .click({ position: { x: 200, y: 400 }, button: 'right' });
  expect(
    await page.evaluate(() => localStorage.getItem('induskorve:city:v3')),
  ).toBe(saved);
  expect(
    await page.evaluate(() =>
      [...document.querySelectorAll('main button')].every(
        (b) => b.getBoundingClientRect().bottom < innerHeight / 2,
      ),
    ),
  ).toBe(true);
  await page.screenshot({ path: 'test-results/clean-mobile.png' });
});
test('Pages subpath loads workshop', async ({ page }) => {
  await page.route('**/Induskorve/**', async (route) => {
    const url = new URL(route.request().url());
    url.pathname = url.pathname.replace(/^\/Induskorve/, '');
    await route.fulfill({ response: await route.fetch({ url: url.href }) });
  });
  await page.goto('/Induskorve/');
  await join(page);
  await page.getByRole('button', { name: 'Add building' }).click();
  await expect(
    page.getByRole('heading', { name: 'Design your building' }),
  ).toBeVisible();
});
