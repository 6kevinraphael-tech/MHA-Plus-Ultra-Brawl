/**
 * Starts the online relay + Vite dev server together.
 * Usage: npm run dev
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const relayPort = process.env.ONLINE_PORT ?? '8787';

function run(cmd, args, label) {
  const child = spawn(cmd, args, {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, PORT: relayPort },
  });
  child.on('exit', (code) => {
    if (code && code !== 0) console.error(`[${label}] exited with code ${code}`);
  });
  return child;
}

console.log(`Starting online relay on port ${relayPort}…`);
const relay = run('node', ['server/index.mjs'], 'relay');

await new Promise((resolve) => setTimeout(resolve, 400));

console.log('Starting Vite…');
const vite = spawn('npx', ['vite'], {
  cwd: root,
  stdio: 'inherit',
  shell: true,
  env: {
    ...process.env,
    VITE_ONLINE_WS_URL: `ws://localhost:${relayPort}`,
  },
});

function shutdown() {
  relay.kill('SIGTERM');
  vite.kill('SIGTERM');
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
