import { config } from 'dotenv';
import { resolve, sep } from 'node:path';

/**
 * Resolve apps/api root whether running from TypeScript source or compiled dist.
 */
export function resolveApiRoot(): string {
  const dir = __dirname;
  if (dir.includes(`${sep}dist${sep}`)) {
    return resolve(dir, '../../..');
  }
  return resolve(dir, '../..');
}

export function resolveRepoRoot(): string {
  return resolve(resolveApiRoot(), '../..');
}

/**
 * Load environment variables for CLI entry points.
 * Works when invoked from repo root via pnpm or directly from apps/api.
 */
export function loadCliEnv(): void {
  const apiRoot = resolveApiRoot();
  const repoRoot = resolveRepoRoot();

  config({ path: resolve(repoRoot, '.env') });
  config({ path: resolve(apiRoot, '.env') });
}
