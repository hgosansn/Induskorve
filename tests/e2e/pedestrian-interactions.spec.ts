import { expect, test, type Page } from '@playwright/test';

async function findSelf(page: Page) {
  await page.getByRole('button', { name: 'City', exact: true }).click();
  await page.getByRole('button', { name: 'Find my pedestrian' }).click();
  await page
    .getByRole('dialog', { name: 'City controls' })
    .getByRole('button', { name: 'Close', exact: true })
    .click();
  await expect(
    page.getByRole('dialog', { name: 'City controls' }),
  ).toBeHidden();
  await page.waitForTimeout(200);
}

test('own pedestrian can be hovered, moved and safely cancelled without changing the saved city', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.evaluate(() =>
    localStorage.setItem(
      'induskorve:city:v3',
      JSON.stringify({
        version: 3,
        buildings: [{ id: 1, x: 1, y: 1, type: 'power', on: true }],
        appearances: [{ buildingId: 1, height: 36, seed: 0.5 }],
        citizens: [],
      }),
    ),
  );
  await page.reload();
  const cityCanvas = page.locator('main > canvas');
  const initialBox = (await cityCanvas.boundingBox())!;
  const zoom = Math.min(initialBox.width / 1100, initialBox.height / 750) * 1.1;
  await page.mouse.move(
    initialBox.width * 0.53,
    initialBox.height * 0.53 + 40.5 * zoom,
  );
  await expect(cityCanvas).toHaveAttribute('data-hover-kind', 'building');
  await expect(cityCanvas).toHaveCSS('cursor', 'pointer');
  await expect(cityCanvas).toHaveAttribute(
    'aria-description',
    'Generating station',
  );
  await page.getByRole('button', { name: /^Join city/ }).click();
  await page.getByLabel('Citizen name', { exact: true }).fill('Stroller');
  await page.getByRole('button', { name: /^Enter the city/ }).click();
  await findSelf(page);
  const canvas = page.locator('main > canvas'),
    box = (await canvas.boundingBox())!;
  const x = box.x + box.width * 0.53,
    y = box.y + box.height * 0.53;
  await page.mouse.move(x, y - 8);
  await expect(canvas).toHaveAttribute('data-hover-kind', 'pedestrian');
  await expect(canvas).toHaveAttribute(
    'aria-description',
    /Stroller.*You.*Drag/,
  );
  await expect(canvas).toHaveCSS('cursor', 'pointer');
  const saved = await page.evaluate(() =>
    localStorage.getItem('induskorve:city:v3'),
  );
  // The expanded target accepts clicks beside the visible body.
  await page.mouse.click(x + 12, y - 8);
  const profile = page.getByRole('complementary', {
    name: 'Pedestrian inspector',
  });
  await expect(
    profile.getByRole('heading', { name: 'Stroller' }),
  ).toBeVisible();
  await expect(profile.getByText('Just joined', { exact: true })).toBeVisible();
  await expect(
    profile.getByText('Building contributions', { exact: true }),
  ).toBeVisible();
  expect(JSON.parse(saved!).citizens[0].joinedAt).toBeGreaterThan(0);
  await page.screenshot({ path: 'test-results/pedestrian-profile.png' });
  await profile
    .getByRole('button', { name: 'Close pedestrian inspector' })
    .click();
  await page.mouse.move(x, y - 8);
  await page.mouse.down();
  await expect(canvas).toHaveCSS('cursor', 'grabbing');
  await page.mouse.move(x + 28, y + 10, { steps: 6 });
  await page.mouse.up();
  await findSelf(page);
  await page.mouse.move(x, y - 8);
  await expect(canvas).toHaveAttribute('aria-description', /Stroller.*You/);
  // A cancelled pickup returns the same person to the original path.
  await page.mouse.down();
  await page.mouse.move(15, box.height - 15, { steps: 4 });
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await findSelf(page);
  await page.mouse.move(x, y - 8);
  await expect(canvas).toHaveAttribute('aria-description', /Stroller.*You/);
  expect(
    await page.evaluate(() => localStorage.getItem('induskorve:city:v3')),
  ).toBe(saved);
  await page.screenshot({ path: 'test-results/pedestrian-hover.png' });
});

for (const recorded of [true, false])
  test(`citizen profile uses attributed contributions and ${recorded ? 'recorded' : 'unknown legacy'} join time`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await page.evaluate(
      (recorded) =>
        localStorage.setItem(
          'induskorve:city:v3',
          JSON.stringify({
            version: 3,
            buildings: [
              {
                id: 1,
                x: 1,
                y: 1,
                type: 'power',
                on: true,
                creatorId: 'citizen-1',
                creator: 'Builder',
              },
            ],
            appearances: [{ buildingId: 1, height: 36, seed: 0.5 }],
            citizens: [
              {
                id: 'citizen-1',
                name: 'Builder',
                ...(recorded ? { joinedAt: Date.now() - 3600000 } : {}),
              },
            ],
          }),
        ),
      recorded,
    );
    await page.reload();
    await page.getByRole('button', { name: /^Join city/ }).click();
    await page.getByLabel('Citizen name', { exact: true }).fill('Builder');
    await page.getByRole('button', { name: /^Enter the city/ }).click();
    await findSelf(page);
    const canvas = page.locator('main > canvas'),
      box = (await canvas.boundingBox())!;
    await page.mouse.click(box.width * 0.53, box.height * 0.53 - 8);
    const profile = page.getByRole('complementary', {
      name: 'Pedestrian inspector',
    });
    await expect(
      profile.getByRole('heading', { name: 'Builder' }),
    ).toBeVisible();
    await expect(
      profile
        .locator('dl > div')
        .filter({ hasText: 'Building contributions' })
        .locator('dd'),
    ).toHaveText('1');
    await expect(
      profile
        .locator('dl > div')
        .filter({ hasText: 'Time since joined' })
        .locator('dd'),
    ).toHaveText(recorded ? /1 h/ : 'Not recorded');
    await page.keyboard.press('Escape');
    await expect(profile).toHaveCount(0);
  });
