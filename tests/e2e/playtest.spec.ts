import { expect, test } from '@playwright/test';

test('plays a daily contribution scenario through completion without changing the city save', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/playtest.html');
  const citySave = await page.evaluate(() =>
    localStorage.getItem('induskorve:city:v3'),
  );
  const panel = page.getByRole('main', {
    name: 'Daily playtest / The freight terminal',
  });
  const actor = async (name: string) =>
    panel.getByRole('radio', { name: new RegExp(`^${name}`) }).click();
  const mode = async (name: string) =>
    panel.getByRole('radio', { name, exact: true }).click();
  const confirm = async () =>
    panel.getByRole('button', { name: 'Confirm contribution' }).click();
  const plot = async (n: number, occupied = false) =>
    panel
      .getByRole('button', {
        name: `Plot ${n} · ${occupied ? 'foundry' : 'empty'}`,
        exact: true,
      })
      .click();
  const day = async () =>
    panel.getByRole('button', { name: '+1 day', exact: true }).click();
  await plot(1);
  await expect(panel.getByLabel('Contribution forecast')).toContainText(
    'Powered output 0 → 12/day',
  );
  await confirm();
  await plot(2);
  await expect(
    panel.getByRole('button', { name: 'Confirm contribution' }),
  ).toBeDisabled();
  await actor('Ivo');
  await confirm();
  await actor('Sol');
  await mode('expand');
  await panel.getByRole('button', { name: /Generator ·/ }).click();
  await confirm();
  await day();
  await expect(panel.getByTestId('playtest-clock')).toHaveText('Day 2 · 00:00');
  await actor('Mira');
  await plot(1, true);
  await confirm();
  await actor('Ivo');
  await plot(2, true);
  await confirm();
  await actor('Sol');
  await mode('connect');
  await plot(1, true);
  await confirm();
  await day();
  await expect(panel).toContainText('Freight bottleneck');
  await actor('Mira');
  await panel.getByRole('button', { name: 'Connect depot → terminal' }).click();
  await confirm();
  await actor('Ivo');
  await mode('expand');
  await panel.getByRole('button', { name: /Generator ·/ }).click();
  await confirm();
  await actor('Sol');
  await mode('place');
  await panel
    .getByRole('radio', { name: 'Slender tower', exact: true })
    .click();
  await plot(3);
  await confirm();
  await day();
  await actor('Mira');
  await mode('expand');
  await panel.getByRole('button', { name: /Freight handling ·/ }).click();
  await confirm();
  await actor('Ivo');
  await plot(3, true);
  await confirm();
  await actor('Sol');
  await mode('connect');
  await plot(3, true);
  await confirm();
  await day();
  await expect(panel.getByTestId('playtest-project')).toHaveText('160 / 160');
  await expect(panel).toContainText('Terminal operational');
  await expect(panel.getByLabel('Run diagnostics')).toContainText(
    '12 contributions',
  );
  await panel.getByLabel('Test participants').scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'test-results/daily-playtest.png' });
  expect(
    await page.evaluate(() => localStorage.getItem('induskorve:city:v3')),
  ).toBe(citySave);
  await page.reload();
  await expect(page.getByTestId('playtest-project')).toHaveText('160 / 160');
  await expect(
    page.getByRole('button', { name: 'Run clock', exact: true }),
  ).toBeVisible();
});

test('accelerates time only while open, cancels drafts, and preserves invalid experiment data', async ({
  page,
}) => {
  await page.goto('/playtest.html');
  const panel = page.getByRole('main', {
    name: 'Daily playtest / The freight terminal',
  });
  await panel
    .getByRole('button', { name: 'Plot 1 · empty', exact: true })
    .click();
  await page.keyboard.press('Escape');
  await expect(panel).toBeVisible();
  await expect(
    panel.getByRole('button', { name: 'Confirm contribution' }),
  ).toHaveCount(0);
  await panel.getByRole('button', { name: 'Run clock', exact: true }).click();
  const hour = () =>
    page.evaluate(
      () =>
        JSON.parse(
          localStorage.getItem('induskorve:daily-playtest:v1') ?? '{"hour":0}',
        ).hour as number,
    );
  await expect.poll(hour).toBeGreaterThan(0);
  await panel
    .getByRole('link', { name: 'Return to city', exact: true })
    .click();
  const closedAt = await hour();
  await page.waitForTimeout(1300);
  expect(await hour()).toBe(closedAt);
  await page.evaluate(() =>
    localStorage.setItem('induskorve:daily-playtest:v1', '{invalid'),
  );
  await page.goto('/playtest.html');
  await expect(page.getByRole('alert')).toContainText('preserved');
  await expect(
    page.getByRole('button', { name: '+1 day', exact: true }),
  ).toBeDisabled();
  expect(
    await page.evaluate(() =>
      localStorage.getItem('induskorve:daily-playtest:v1'),
    ),
  ).toBe('{invalid');
});
