import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const apiRoot = resolve(__dirname, '../..');

function runScript(script: string, args: string[] = []): void {
  const result = spawnSync('pnpm', ['exec', 'ts-node', script, ...args], {
    cwd: apiRoot,
    env: process.env,
    encoding: 'utf-8',
    stdio: 'pipe',
  });

  if (result.status !== 0) {
    console.error(result.stdout);
    console.error(result.stderr);
    throw new Error(`CLI smoke failed for ${script}: exit ${result.status}`);
  }
}

try {
  runScript('src/ingestion/run-france.ts', ['--dry-run', '--fixture']);
  runScript('src/ingestion/run-spain.ts', ['--dry-run', '--fixture']);
  runScript('src/ingestion/run-germany.ts', ['--dry-run', '--fixture']);
  runScript('src/ingestion/run-austria.ts', ['--dry-run', '--fixture']);
  console.log('CLI smoke checks passed.');
} catch (error) {
  console.error(error);
  process.exit(1);
}
