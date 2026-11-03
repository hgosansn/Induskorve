import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

export const portable = resolve(
  '.local-tools/spacetime-2.13.0/spacetimedb-cli.exe',
);
export function cli(args, options = {}) {
  const { configPath, ...spawnOptions } = options;
  const binary =
    process.env.SPACETIME_CLI ||
    (existsSync(portable) ? portable : 'spacetime');
  const prefix =
    binary === portable
      ? ['--root-dir', resolve('.local-tools/spacetime-data')]
      : [];
  if (configPath || binary === portable)
    prefix.push(
      '--config-path',
      configPath || resolve('.local-tools/cli.toml'),
    );
  const result = spawnSync(binary, [...prefix, ...args], {
    stdio: 'inherit',
    windowsHide: true,
    ...spawnOptions,
  });
  if (result.error)
    throw new Error(
      'Install SpacetimeDB CLI 2.13.0 or set SPACETIME_CLI to its executable.',
      { cause: result.error },
    );
  if (result.status !== 0)
    throw new Error(`SpacetimeDB CLI exited with ${result.status}.`);
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === resolve('tools/spacetime.mjs')
) {
  const action = process.argv[2];
  if (action === 'build') cli(['build', '--module-path', 'spacetimedb']);
  else if (action === 'generate')
    cli([
      'generate',
      '--lang',
      'typescript',
      '--module-path',
      'spacetimedb',
      '--out-dir',
      'src/infrastructure/spacetimedb/module-bindings',
      '-y',
    ]);
  else if (action === 'publish') {
    const database = process.env.SPACETIMEDB_DATABASE;
    const server = process.env.SPACETIMEDB_URI;
    if (!database || !server || !process.env.SPACETIMEAUTH_CLIENT_ID)
      throw new Error(
        'Set SPACETIMEDB_DATABASE, SPACETIMEDB_URI and SPACETIMEAUTH_CLIENT_ID before publishing.',
      );
    if (process.env.INDUSKORVE_DEV_AUTH || process.env.INDUSKORVE_TEST_TICK_MS)
      throw new Error(
        'Remove local-test overrides before publishing a live database.',
      );
    cli([
      'publish',
      database,
      '--module-path',
      'spacetimedb',
      '--server',
      server,
    ]);
  } else throw new Error('Use build, generate or publish.');
}
