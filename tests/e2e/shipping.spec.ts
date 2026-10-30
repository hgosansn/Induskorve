import { expect, test } from '@playwright/test';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

test('the shipped product contains neither the playtest page nor its runtime', async ({
  page,
}) => {
  expect(existsSync('dist/playtest.html')).toBe(false);
  const scripts = readdirSync('dist/assets').filter((name) =>
    name.endsWith('.js'),
  );
  expect(scripts.some((name) => name.includes('playtest'))).toBe(false);
  for (const name of scripts) {
    const source = readFileSync(join('dist/assets', name), 'utf8');
    expect(source).not.toContain('induskorve:daily-playtest:v1');
    expect(source).not.toContain('Daily playtest / The freight terminal');
  }
  await page.goto('/');
  await page.getByRole('button', { name: 'City', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Design atlas', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Daily playtest', exact: true }),
  ).toHaveCount(0);
});
