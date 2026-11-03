import { expect, test } from '@playwright/test';
test('ground squares select obscured buildings and focus reveals the rear building', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.evaluate(() =>
    localStorage.setItem(
      'induskorve:city:v3',
      JSON.stringify({
        version: 3,
        buildings: [
          { id: 1, x: 1, y: 1, type: 'shop', on: true },
          { id: 2, x: 2, y: 2, type: 'skyscraper', on: true },
        ],
        appearances: [
          { buildingId: 1, height: 36, seed: 0.5 },
          { buildingId: 2, height: 85, seed: 0.5 },
        ],
        citizens: [],
      }),
    ),
  );
  await page.reload();
  await page.waitForLoadState('networkidle');
  const canvas = page.locator('main > canvas'),
    box = (await canvas.boundingBox())!;
  const zoom = Math.min(box.width / 1100, box.height / 750) * 1.1;
  const rear = { x: box.width * 0.53, y: box.height * 0.53 + 40.5 * zoom };
  await page.mouse.move(rear.x, rear.y);
  await expect(canvas).toHaveAttribute('aria-description', 'Neighborhood shop');
  const before = await canvas.screenshot();
  await canvas.click({ position: rear });
  const inspector = page.getByRole('complementary', {
    name: 'Structure inspector',
  });
  await expect(
    inspector.getByRole('heading', { name: 'Neighborhood shop' }),
  ).toBeVisible();
  await page.screenshot({ path: 'test-results/rear-building-focus.png' });
  await inspector.getByRole('button', { name: 'Close inspector' }).click();
  // Hover remains independent of selection. Clearing focus restores the scene.
  await page.mouse.move(rear.x, rear.y);
  await expect
    .poll(async () => Buffer.compare(await canvas.screenshot(), before))
    .toBe(0);
  await canvas.click({
    position: { x: rear.x, y: box.height * 0.53 + 67.5 * zoom },
  });
  await expect(
    inspector.getByRole('heading', { name: 'Residential skyscraper' }),
  ).toBeVisible();
});
