import { expect, test, type Locator } from '@playwright/test';
const pixels = (canvas: Locator) =>
  canvas.evaluate(async (el: HTMLCanvasElement) => {
    await new Promise<void>((r) =>
      requestAnimationFrame(() => requestAnimationFrame(() => r())),
    );
    return el.toDataURL();
  });

test('civic families show their own architecture and a live right-wall display without writing city state', async ({
  page,
}) => {
  test.setTimeout(45_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  const saved = await page.evaluate(() =>
    localStorage.getItem('induskorve:city:v3'),
  );
  await page.getByRole('button', { name: 'City', exact: true }).click();
  await page.getByRole('button', { name: 'Design atlas', exact: true }).click();
  const atlas = page.getByRole('dialog', { name: 'Design atlas', exact: true }),
    canvas = atlas.getByLabel('Configured building preview', { exact: true });
  const images = [];
  for (const name of ['Homes', 'Skyscraper', 'Shops']) {
    await atlas.getByRole('radio', { name, exact: true }).click();
    await expect(atlas.getByText(/^Fit checked:/)).toBeVisible();
    const options = await atlas
      .getByLabel('Why is this part here?')
      .locator('option')
      .allTextContents();
    expect(options.join(' ')).not.toMatch(
      /furnace|scrubber|gantry|stock|turbine/i,
    );
    const active = await pixels(canvas);
    images.push(active);
    await atlas.getByRole('button', { name: 'Operating', exact: true }).click();
    await expect.poll(() => pixels(canvas)).not.toBe(active);
    await atlas.getByRole('button', { name: 'Idle', exact: true }).click();
    await expect.poll(() => pixels(canvas)).toBe(active);
  }
  expect(new Set(images).size).toBe(3);
  await atlas.getByRole('radio', { name: 'Skyscraper', exact: true }).click();
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const first = await pixels(canvas);
  await expect.poll(() => pixels(canvas)).not.toBe(first);
  await atlas
    .getByRole('button', { name: 'Facade display', exact: true })
    .click();
  const off = await pixels(canvas);
  await page.waitForTimeout(300);
  expect(await pixels(canvas)).toBe(off);
  expect(
    await page.evaluate(() => localStorage.getItem('induskorve:city:v3')),
  ).toBe(saved);
  expect(errors).toEqual([]);
});

test('homes shops and skyscrapers can be placed and saved with old structures preserved', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.evaluate(() =>
    localStorage.setItem(
      'induskorve:city:v3',
      JSON.stringify({
        version: 3,
        buildings: [{ id: 0, x: 0, y: 0, type: 'power', on: true }],
        appearances: [{ buildingId: 0, height: 85, seed: 0.5 }],
        citizens: [],
      }),
    ),
  );
  await page.reload();
  await page.getByRole('button', { name: /^Join city/ }).click();
  await page.getByLabel('Citizen name', { exact: true }).fill('TownBuilder');
  await page.getByRole('button', { name: /^Enter the city/ }).click();
  const canvas = page.locator('main > canvas');
  for (const [name, type, x, y] of [
    ['Homes', 'residential', 1, 1],
    ['Shops', 'shop', -1, 1],
    ['Skyscraper', 'skyscraper', 1, -1],
  ] as const) {
    await page
      .getByRole('button', { name: 'Add building', exact: true })
      .click();
    await page.getByRole('radio', { name, exact: true }).click();
    await expect(
      page.getByText('Configure machinery', { exact: true }),
    ).toHaveCount(0);
    await page
      .getByRole('button', { name: 'Choose location', exact: true })
      .click();
    const rect = await canvas.boundingBox();
    const zoom = Math.max(
      0.35,
      Math.min(3.5, Math.min(rect!.width / 1100, rect!.height / 750) * 1.1),
    );
    await canvas.click({
      position: {
        x: rect!.width * 0.53 + (x - y) * 27 * zoom,
        y: rect!.height * 0.53 + (x + y + 1) * 13.5 * zoom,
      },
    });
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            JSON.parse(localStorage.getItem('induskorve:city:v3')!).buildings
              .length,
        ),
      )
      .toBeGreaterThan(1);
    const world = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('induskorve:city:v3')!),
    );
    expect(world.buildings.some((b: { type: string }) => b.type === type)).toBe(
      true,
    );
  }
  const before = await page.evaluate(() =>
    localStorage.getItem('induskorve:city:v3'),
  );
  await page.reload();
  expect(
    await page.evaluate(() => localStorage.getItem('induskorve:city:v3')),
  ).toBe(before);
  const world = JSON.parse(before!);
  expect(world.buildings[0]).toEqual({
    id: 0,
    x: 0,
    y: 0,
    type: 'power',
    on: true,
  });
});
