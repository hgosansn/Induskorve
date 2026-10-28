import { test, expect, type Locator } from '@playwright/test';
import { createHash } from 'node:crypto';
async function canvasHash(canvas: Locator) {
  // Read after React's configuration change has reached the Canvas frame.
  const data = await canvas.evaluate(async (el: HTMLCanvasElement) => {
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
    return el.toDataURL();
  });
  return createHash('sha256').update(data).digest('hex');
}
async function join(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: 'Join city' }).click();
  await page.getByLabel('Citizen name', { exact: true }).fill('Builder');
  await page.getByRole('button', { name: 'Enter the city' }).click();
}
test('workshop design persists through ghost placement and reload', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
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
  await page.getByRole('checkbox', { name: 'Loading bay' }).check();
  const preview = page.getByLabel('Configured building preview');
  await page.getByLabel('Layout seed', { exact: true }).fill('734123');
  const layout = await canvasHash(preview);
  await page
    .getByRole('button', { name: 'Generate another layout', exact: true })
    .click();
  await expect.poll(() => canvasHash(preview)).not.toBe(layout);
  await page.getByLabel('Layout seed', { exact: true }).fill('734123');
  await expect.poll(() => canvasHash(preview)).toBe(layout);
  expect(
    await page
      .getByRole('dialog')
      .evaluate((el) => getComputedStyle(el).borderRadius),
  ).toBe('0px');
  expect(
    await page
      .getByRole('button', { name: 'Choose location' })
      .evaluate((el) => getComputedStyle(el).borderRadius),
  ).toBe('0px');
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
  expect(save.buildings[1].modules).toEqual(['loading-bay']);
  expect(save.appearances[1].design).toEqual({
    shape: 'tower',
    stacks: true,
    balcony: false,
    display: 'none',
  });
  expect(save.appearances[1].height).toBe(48);
  expect(save.appearances[1].seed).toBe(0.734123);
  expect(errors).toEqual([]);
});
test('cancel is non-mutating and bottom stays clear on mobile', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await join(page);
  const saved = await page.evaluate(
    () => JSON.parse(localStorage.getItem('induskorve:city:v3')!).buildings,
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
    await page.evaluate(
      () => JSON.parse(localStorage.getItem('induskorve:city:v3')!).buildings,
    ),
  ).toEqual(saved);
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
  await expect(page.getByRole('button', { name: 'Join city' })).toBeVisible();
  await page.screenshot({ path: 'test-results/district.png' });
  await join(page);
  await page.getByRole('button', { name: 'Add building' }).click();
  await expect(
    page.getByRole('heading', { name: 'Design your building' }),
  ).toBeVisible();
});

test('real production, full storage, dispatch and outage are visible in the inspector', async ({
  page,
}) => {
  await page.clock.install();
  await page.goto('/');
  await page.evaluate(() =>
    localStorage.setItem(
      'induskorve:city:v3',
      JSON.stringify({
        version: 3,
        citizens: [],
        buildings: [
          {
            id: 0,
            x: 0,
            y: 0,
            type: 'power',
            on: true,
            modules: ['heat-exchanger'],
          },
          { id: 1, x: 1, y: 0, type: 'warehouse', on: true },
          {
            id: 2,
            x: 1,
            y: 1,
            type: 'factory',
            on: true,
            modules: ['furnace'],
          },
        ],
        appearances: [0, 1, 2].map((buildingId) => ({
          buildingId,
          height: 48,
          seed: 0.5,
        })),
        economy: { cycle: 0, stockpiles: [{ buildingId: 1, metal: 190 }] },
      }),
    ),
  );
  await page.reload();
  await join(page);
  await page.clock.fastForward(10_001);
  let economy = await page.evaluate(
    () => JSON.parse(localStorage.getItem('induskorve:city:v3')!).economy,
  );
  expect(economy.stockpiles[0].metal).toBe(200);
  const canvas = page.locator('main > canvas');
  const box = (await canvas.boundingBox())!;
  const zoom = Math.min(box.width / 1100, box.height / 750) * 1.1;
  await canvas.click({
    position: {
      x: box.width * 0.53 + 27 * zoom,
      y: box.height * 0.53 + 27 * zoom,
    },
  });
  await expect(page.getByText('200 / 200 metal stored')).toBeVisible();
  await page.getByRole('button', { name: 'Dispatch 200 metal' }).click();
  await page.clock.fastForward(10_001);
  await expect(page.getByText('22 / 200 metal stored')).toBeVisible();
  await page.getByRole('button', { name: 'Pause machinery' }).click();
  await page.clock.fastForward(10_001);
  await expect(page.getByText('22 / 200 metal stored')).toBeVisible();
  economy = await page.evaluate(
    () => JSON.parse(localStorage.getItem('induskorve:city:v3')!).economy,
  );
  expect(economy.shippedMetal).toBe(200);
  await page.screenshot({ path: 'test-results/industry.png' });
});

test('asset atlas renders each family and module without editing the city', async ({
  page,
}) => {
  // This integration check captures every family and module; allow headroom on shared CI runners.
  test.setTimeout(45_000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  const saved = await page.evaluate(() =>
    localStorage.getItem('induskorve:city:v3'),
  );
  await canvasHash(page.locator('main > canvas'));
  await page.screenshot({ path: 'test-results/nocturne-district.png' });
  await page.getByRole('button', { name: 'City', exact: true }).click();
  await page.getByRole('button', { name: 'Design atlas', exact: true }).click();
  const atlas = page.getByRole('dialog', { name: 'Design atlas', exact: true });
  const canvas = atlas.locator('canvas');
  const pixels = () => canvasHash(canvas);
  for (const [family, equipment] of [
    ['Power', ['Extra turbine', 'Heat recovery']],
    ['Foundry', ['Second furnace', 'Exhaust scrubber']],
    ['Freight', ['Loading bay', 'Solar roof']],
  ] as const) {
    await atlas.getByRole('radio', { name: family, exact: true }).click();
    for (const module of equipment) {
      const before = await pixels();
      await atlas.getByRole('checkbox', { name: new RegExp(module) }).uncheck();
      await expect.poll(pixels).not.toBe(before);
      await atlas.getByRole('checkbox', { name: new RegExp(module) }).check();
      await expect.poll(pixels).toBe(before);
    }
    await expect(atlas.getByText(/^Fit checked:/)).toBeVisible();
    const composed = await pixels();
    await atlas
      .getByLabel('Why is this part here?')
      .selectOption(
        family === 'Power'
          ? 'cooler'
          : family === 'Foundry'
            ? 'extraction'
            : 'solar',
      );
    await expect.poll(pixels).not.toBe(composed);
    await expect(atlas.getByText(/^Mounted on:/)).toContainText(
      family === 'Freight' ? 'Storage hall' : 'Foundation and apron',
    );
    if (family === 'Power')
      await page.screenshot({ path: 'test-results/atlas-part-role.png' });
    await atlas.getByLabel('Why is this part here?').selectOption('all');
    await expect.poll(pixels).toBe(composed);
    await page.screenshot({
      path: `test-results/atlas-${family.toLowerCase()}.png`,
    });
  }
  await atlas.getByRole('radio', { name: 'Foundry', exact: true }).click();
  const assembled = await pixels();
  await atlas
    .getByRole('button', { name: 'Separate layers', exact: true })
    .click();
  await expect.poll(pixels).not.toBe(assembled);
  await page.screenshot({ path: 'test-results/atlas-exploded.png' });
  for (const layer of [
    'foundation',
    'shell',
    'machinery',
    'modules',
    'services',
  ]) {
    await atlas.getByRole('radio', { name: layer, exact: true }).click();
    await expect(
      atlas.getByRole('radio', { name: layer, exact: true }),
    ).toHaveAttribute('data-state', 'on');
  }
  await atlas.getByRole('radio', { name: 'Complete', exact: true }).click();
  const operating = await pixels();
  await atlas.getByRole('button', { name: 'Operating', exact: true }).click();
  await expect.poll(pixels).not.toBe(operating);
  await expect(
    atlas.getByRole('button', { name: 'Idle', exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem('induskorve:city:v3')),
  ).toBe(saved);
  expect(errors).toEqual([]);
});

test('asset atlas fits a narrow screen and returns focus when dismissed', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'City', exact: true }).click();
  await page.getByRole('button', { name: 'Design atlas', exact: true }).click();
  const atlas = page.getByRole('dialog', { name: 'Design atlas', exact: true });
  await expect(atlas).toBeVisible();
  expect(await atlas.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
    true,
  );
  await page.screenshot({ path: 'test-results/atlas-mobile.png' });
  await page.keyboard.press('Escape');
  await expect(atlas).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Design atlas', exact: true }),
  ).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(
    page.getByRole('button', { name: 'City', exact: true }),
  ).toBeFocused();
});

test('facade profiles and mounted displays change the architecture without editing the city', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const saved = await page.evaluate(() =>
    localStorage.getItem('induskorve:city:v3'),
  );
  await page.getByRole('button', { name: 'City', exact: true }).click();
  await page.getByRole('button', { name: 'Design atlas', exact: true }).click();
  const atlas = page.getByRole('dialog', { name: 'Design atlas', exact: true });
  const pixels = () => canvasHash(atlas.locator('canvas'));
  let previousProfile = await pixels();
  for (const profile of ['Block', 'Tower', 'Stepped']) {
    await atlas.getByRole('radio', { name: profile, exact: true }).click();
    await expect.poll(pixels).not.toBe(previousProfile);
    previousProfile = await pixels();
    await page.screenshot({
      path: `test-results/facade-${profile.toLowerCase()}.png`,
    });
  }
  await atlas
    .getByRole('button', { name: 'Facade display', exact: true })
    .click();
  await expect.poll(pixels).not.toBe(previousProfile);
  await page.screenshot({ path: 'test-results/facade-display.png' });
  await atlas
    .getByRole('button', { name: 'Facade display', exact: true })
    .click();
  await expect.poll(pixels).toBe(previousProfile);
  expect(
    await page.evaluate(() => localStorage.getItem('induskorve:city:v3')),
  ).toBe(saved);
});

test('WFC lab varies reproducibly, exposes floor sections and preserves the city', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  const saved = await page.evaluate(() =>
    localStorage.getItem('induskorve:city:v3'),
  );
  await page.getByRole('button', { name: 'City', exact: true }).click();
  await page.getByRole('button', { name: 'Design atlas', exact: true }).click();
  const atlas = page.getByRole('dialog', { name: 'Design atlas', exact: true });
  await atlas.getByRole('radio', { name: 'WFC lab', exact: true }).click();
  const pixels = () => canvasHash(atlas.getByLabel('WFC building preview'));
  await expect(atlas.getByRole('status')).toContainText('all floors connected');
  const initial = await pixels();
  await page.screenshot({ path: 'test-results/wfc-terraces.png' });
  await atlas.getByRole('button', { name: 'Next seed', exact: true }).click();
  await expect.poll(pixels).not.toBe(initial);
  await atlas.getByLabel('Generation seed').fill('42');
  await expect.poll(pixels).toBe(initial);
  for (const style of ['Spire', 'Courtyard']) {
    await atlas.getByRole('radio', { name: style, exact: true }).click();
    await expect(atlas.getByRole('status')).toContainText('Solved');
    await page.screenshot({
      path: `test-results/wfc-${style.toLowerCase()}.png`,
    });
  }
  const complete = await pixels();
  await atlas.getByRole('slider').fill('2');
  await expect.poll(pixels).not.toBe(complete);
  await expect(
    atlas.getByRole('table', { name: 'Floor 2 plan' }),
  ).toBeVisible();
  const section = await pixels();
  await atlas
    .getByRole('button', { name: 'Show structure', exact: true })
    .click();
  await expect.poll(pixels).not.toBe(section);
  await page.screenshot({ path: 'test-results/wfc-section.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await atlas.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
    true,
  );
  await atlas.getByLabel('Generation seed').fill('73');
  await expect(atlas.getByRole('status')).toContainText('Solved');
  await page.screenshot({ path: 'test-results/wfc-mobile.png' });
  expect(
    await page.evaluate(() => localStorage.getItem('induskorve:city:v3')),
  ).toBe(saved);
  expect(errors).toEqual([]);
});

test('modular city renders at district and close zoom with no storage rewrite', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  const canvas = page.locator('main > canvas');
  await canvasHash(canvas);
  const saved = await page.evaluate(() =>
    localStorage.getItem('induskorve:city:v3'),
  );
  const colors = await canvas.evaluate((el: HTMLCanvasElement) => {
    const data = el
      .getContext('2d')!
      .getImageData(0, 0, el.width, el.height).data;
    const unique = new Set<number>();
    for (let i = 0; i < data.length; i += 128)
      unique.add((data[i]! << 16) | (data[i + 1]! << 8) | data[i + 2]!);
    return unique.size;
  });
  expect(colors).toBeGreaterThan(100);
  await page.screenshot({ path: 'test-results/modular-city.png' });
  await page.mouse.move(760, 530);
  await page.mouse.wheel(0, -650);
  await canvasHash(canvas);
  await page.screenshot({ path: 'test-results/modular-city-close.png' });
  expect(
    await page.evaluate(() => localStorage.getItem('induskorve:city:v3')),
  ).toBe(saved);
  expect(errors).toEqual([]);
});
