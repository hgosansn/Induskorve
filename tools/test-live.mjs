import { spawn } from 'node:child_process';
import { generateKeyPairSync, randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { createServer } from 'node:net';
import { cli, portable } from './spacetime.mjs';
import { verifyLiveBrowser } from './live-browser.mjs';

const run = randomUUID();
const directory = resolve('.local-tools/live-tests', run);
await mkdir(directory, { recursive: true });
const keys = generateKeyPairSync('ec', {
  namedCurve: 'prime256v1',
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});
await writeFile(resolve(directory, 'private.pem'), keys.privateKey, {
  mode: 0o600,
});
await writeFile(resolve(directory, 'public.pem'), keys.publicKey);
const port = await new Promise((resolvePort, reject) => {
  const socket = createServer();
  socket.on('error', reject);
  socket.listen(0, '127.0.0.1', () => {
    const address = socket.address();
    socket.close(() => resolvePort(address.port));
  });
});
const uri = `http://127.0.0.1:${port}`;
const binary =
  process.env.SPACETIME_STANDALONE ||
  resolve(dirname(portable), 'spacetimedb-standalone.exe');
const server = spawn(
  binary,
  [
    'start',
    '--listen-addr',
    `127.0.0.1:${port}`,
    '--data-dir',
    directory,
    '--jwt-pub-key-path',
    resolve(directory, 'public.pem'),
    '--jwt-priv-key-path',
    resolve(directory, 'private.pem'),
    '--in-memory',
    '--non-interactive',
  ],
  { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true },
);
let serverError;
server.on('error', (error) => {
  serverError = error;
});
// Avoid writing server-issued tokens or key material to test output.
server.stdout.resume();
server.stderr.resume();
try {
  let available = false;
  for (let i = 0; i < 100; i++) {
    if (serverError) throw serverError;
    if (server.exitCode !== null)
      throw new Error('Isolated SpacetimeDB server stopped.');
    try {
      available = (await fetch(`${uri}/v1/ping`)).ok;
    } catch {
      /* Starting. */
    }
    if (available) break;
    await new Promise((r) => setTimeout(r, 100));
  }
  if (!available) throw new Error('Isolated server did not become ready.');
  const database = `induskorve-test-${run}`;
  const denied = `${database}-auth`;
  const cleanEnv = { ...process.env };
  delete cleanEnv.INDUSKORVE_DEV_AUTH;
  delete cleanEnv.INDUSKORVE_TEST_TICK_MS;
  const configPath = resolve(directory, 'cli.toml');
  cli(
    [
      'publish',
      database,
      '--module-path',
      'spacetimedb',
      '--server',
      uri,
      '--yes=skip-login',
    ],
    {
      configPath,
      env: {
        ...cleanEnv,
        INDUSKORVE_DEV_AUTH: 'local-tests',
        INDUSKORVE_TEST_TICK_MS: '100',
      },
    },
  );
  cli(
    [
      'publish',
      denied,
      '--module-path',
      'spacetimedb',
      '--server',
      uri,
      '--yes=skip-login',
    ],
    { configPath, env: cleanEnv },
  );
  const test = spawn(
    process.execPath,
    [
      'node_modules/vitest/vitest.mjs',
      'run',
      '--config',
      'vitest.live.config.ts',
    ],
    {
      stdio: 'inherit',
      windowsHide: true,
      env: {
        ...cleanEnv,
        TEST_SPACETIMEDB_URI: uri,
        TEST_SPACETIMEDB_DATABASE: database,
        TEST_SPACETIMEDB_AUTH_DATABASE: denied,
      },
    },
  );
  const code = await new Promise((r, reject) => {
    test.on('error', reject);
    test.on('exit', r);
  });
  if (code !== 0) process.exitCode = 1;
  else await verifyLiveBrowser(uri, database, directory);
} finally {
  server.kill();
}
