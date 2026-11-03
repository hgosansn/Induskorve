import { expect, test } from '@playwright/test';

const world = {
  version: 3,
  citizens: [],
  buildings: [
    { id: 0, x: 1, y: 1, type: 'power', on: true },
    {
      id: 1,
      x: 2,
      y: 1,
      type: 'warehouse',
      on: true,
      modules: ['loading-bay'],
    },
    { id: 2, x: 3, y: 1, type: 'factory', on: true },
    { id: 3, x: 2, y: 2, type: 'warehouse', on: true },
  ],
  appearances: [0, 1, 2, 3].map((buildingId) => ({
    buildingId,
    height: 40,
    seed: 0.5,
  })),
  economy: {
    cycle: 5,
    shippedMetal: 0,
    stockpiles: [
      { buildingId: 1, metal: 300 },
      { buildingId: 3, metal: 190 },
    ],
  },
};

test('guided contributions conserve stock, unlock technology and survive reload', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.clock.install({ time: new Date('2026-11-01T10:00:00Z') });
  await page.goto('/');
  await page.evaluate(
    (value) =>
      localStorage.setItem('induskorve:city:v3', JSON.stringify(value)),
    world,
  );
  await page.reload();
  await page.clock.pauseAt(new Date('2026-11-01T10:00:02Z'));
  await page
    .getByRole('button', { name: 'City projects', exact: true })
    .click();
  const guide = page.getByRole('complementary', { name: 'City guide' });
  await guide.getByRole('button', { name: 'Projects', exact: true }).click();
  await expect(
    guide.getByRole('button', { name: /Preview .* contribution/ }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Join city' }).click();
  await page.clock.runFor(500);
  await page.getByLabel('Citizen name', { exact: true }).fill('Mira');
  await page.getByRole('button', { name: 'Enter the city' }).click();
  await guide.getByRole('button', { name: 'Projects', exact: true }).click();
  const first = guide.getByRole('region', {
    name: 'Freight coordination',
    exact: true,
  });
  await first.getByLabel('Contribution · metal').fill('0');
  await expect(
    first.getByRole('button', { name: 'Preview 0 metal contribution' }),
  ).toBeDisabled();
  await first.getByLabel('Contribution · metal').fill('80');
  await first
    .getByRole('button', { name: 'Preview 80 metal contribution' })
    .click();
  await expect(page.getByRole('dialog')).toContainText(
    'Warehouse #1: 80 metal',
  );
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem('induskorve:city:v3')!).economy
          .stockpiles[0].metal,
    ),
  ).toBe(300);
  await first.getByLabel('Contribution · metal').fill('160');
  await first
    .getByRole('button', { name: 'Preview 160 metal contribution' })
    .click();
  await page.getByRole('button', { name: 'Confirm 160 metal' }).click();
  await expect(first.getByText('Complete', { exact: true })).toBeVisible();
  await guide.getByLabel('Coordinate all powered warehouses').check();
  const second = guide.getByRole('region', {
    name: 'Materials exchange',
    exact: true,
  });
  await second
    .getByRole('button', { name: 'Preview 320 metal contribution' })
    .click();
  await expect(page.getByRole('dialog')).toContainText(
    'Warehouse #3: 180 metal',
  );
  await page.getByRole('button', { name: 'Confirm 320 metal' }).click();
  await expect(second.getByText('Complete', { exact: true })).toBeVisible();
  await guide
    .getByRole('button', { name: 'Preview coordinated dispatch' })
    .click();
  await page.getByRole('button', { name: 'Confirm change' }).click();
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('induskorve:city:v3')!),
  );
  expect(saved.economy.shippedMetal).toBe(10);
  expect(
    saved.economy.stockpiles.every((s: { metal: number }) => s.metal === 0),
  ).toBe(true);
  expect(
    saved.progression.projects.reduce(
      (sum: number, p: { delivered: number }) => sum + p.delivered,
      0,
    ),
  ).toBe(480);
  await guide.getByRole('button', { name: 'History', exact: true }).click();
  await expect(guide.getByText('Mira · you · cycle 5').first()).toBeVisible();
  await page.screenshot({ path: 'test-results/guided-history-desktop.png' });
  await page.reload();
  await page
    .getByRole('button', { name: 'City projects', exact: true })
    .click();
  await guide.getByRole('button', { name: 'Projects', exact: true }).click();
  await expect(guide.getByText('Complete', { exact: true })).toHaveCount(2);
  expect(errors).toEqual([]);
});

test('guidance reflows on mobile and links a real shortage to inspection', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.evaluate(
    (value) =>
      localStorage.setItem(
        'induskorve:city:v3',
        JSON.stringify({
          ...value,
          buildings: value.buildings.map((b) =>
            b.id === 0 ? { ...b, on: false } : b,
          ),
        }),
      ),
    world,
  );
  await page.reload();
  await page
    .getByRole('button', { name: 'City projects', exact: true })
    .click();
  const guide = page.getByRole('complementary', { name: 'City guide' });
  await guide.getByRole('button', { name: 'Needs', exact: true }).click();
  await expect(
    guide.getByText('Needs power', { exact: true }).first(),
  ).toBeVisible();
  await page.screenshot({ path: 'test-results/guided-needs-mobile.png' });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(375);
  await guide
    .getByRole('button', { name: 'Inspect structure' })
    .first()
    .click();
  await expect(guide).toHaveCount(0);
  await expect(
    page.getByRole('complementary', { name: 'Structure inspector' }),
  ).toBeVisible();
  await expect(
    page.getByText('Join city to interact', { exact: true }),
  ).toBeVisible();
});

test('guide stays below controls across screen sizes and enlarged text', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const trigger = page.getByRole('button', {
    name: 'City projects',
    exact: true,
  });
  await trigger.focus();
  await page.keyboard.press('Enter');
  const guide = page.getByRole('complementary', { name: 'City guide' });
  await expect(guide).toBeVisible();
  for (const width of [320, 375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect
      .poll(async () => {
        const a = await page.locator('main > header').boundingBox(),
          b = await guide.boundingBox();
        return (
          !!a && !!b && b.y >= a.y + a.height + 8 && b.x + b.width <= width
        );
      })
      .toBe(true);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
  }
  await page.setViewportSize({ width: 375, height: 1000 });
  await page.addStyleTag({ content: 'html { font-size: 200%; }' });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
    .toBeLessThanOrEqual(375);
  const a = (await page.locator('main > header').boundingBox())!,
    b = (await guide.boundingBox())!;
  expect(b.y).toBeGreaterThanOrEqual(a.y + a.height + 8);
  const project = guide.getByRole('heading', {
    name: 'Freight coordination',
    exact: true,
  });
  await project.scrollIntoViewIfNeeded();
  await expect(project).toBeInViewport();
  await page.screenshot({ path: 'test-results/guided-enlarged-text.png' });
  await guide.getByRole('button', { name: 'Close city guide' }).click();
  await expect(guide).toHaveCount(0);
});
