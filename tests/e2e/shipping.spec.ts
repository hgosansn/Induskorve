import { expect, test } from '@playwright/test';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

test('the shipped product contains neither the playtest page nor its runtime', async ({
  page,
}) => {
  expect(existsSync('dist/playtest.html')).toBe(false);
  expect(existsSync('dist/mesh-pilot.html')).toBe(false);
  expect(existsSync('dist/parts-batch.html')).toBe(false);
  expect(existsSync('dist/asset-studies')).toBe(false);
  expect(
    readdirSync('dist/assets').some((name) => /\.(blend|glb)$/.test(name)),
  ).toBe(false);
  const scripts = readdirSync('dist/assets').filter((name) =>
    name.endsWith('.js'),
  );
  expect(scripts.some((name) => name.includes('playtest'))).toBe(false);
  for (const name of scripts) {
    const source = readFileSync(join('dist/assets', name), 'utf8');
    expect(source).not.toContain('induskorve:daily-playtest:v1');
    expect(source).not.toContain('Daily playtest / The freight terminal');
    expect(source).not.toContain('Anonymous candidates. Real editable meshes');
    expect(source).not.toContain('Retained mesh inspector');
    expect(source).not.toContain('This test harness is loopback-only.');
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
