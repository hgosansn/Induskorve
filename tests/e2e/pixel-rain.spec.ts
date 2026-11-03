import { expect, test } from '@playwright/test';
test('pixel style and rain switch independently without changing the city and remain still under reduced motion', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  const canvas = page.locator('main > canvas');
  const pixels = () =>
    canvas.evaluate(async (el: HTMLCanvasElement) => {
      await new Promise((r) =>
        requestAnimationFrame(() => requestAnimationFrame(r)),
      );
      return el.toDataURL();
    });
  const saved = await page.evaluate(() =>
    localStorage.getItem('induskorve:city:v3'),
  );
  const combined = await pixels();
  const toggle = async (name: string) => {
    await page.getByRole('button', { name: 'City', exact: true }).click();
    await page.getByRole('button', { name, exact: true }).click();
    await page
      .getByRole('dialog', { name: 'City controls' })
      .getByRole('button', { name: 'Close', exact: true })
      .click();
    await expect(
      page.getByRole('dialog', { name: 'City controls' }),
    ).toBeHidden();
  };
  await toggle('Rain');
  const dryPixels = await pixels();
  expect(dryPixels).not.toBe(combined);
  await toggle('Pixel style');
  const smooth = await pixels();
  expect(smooth).not.toBe(dryPixels);
  await toggle('Rain');
  const smoothRain = await pixels();
  expect(smoothRain).not.toBe(smooth);
  await page.waitForTimeout(300);
  expect(await pixels()).toBe(smoothRain);
  expect(
    await page.evaluate(() => localStorage.getItem('induskorve:city:v3')),
  ).toBe(saved);
});
