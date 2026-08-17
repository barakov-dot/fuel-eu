import { NestFactory } from '@nestjs/core';
import type { INestApplicationContext, Type } from '@nestjs/common';
import { loadCliEnv } from './load-env';
import { shutdownApplicationContext } from './shutdown-application-context';

export interface MaintenanceCliOptions<T> {
  module: Type<unknown>;
  label: string;
  run: (app: INestApplicationContext) => Promise<T>;
  formatResult?: (result: T) => void;
}

export async function runMaintenanceCli<T>(
  options: MaintenanceCliOptions<T>,
): Promise<void> {
  loadCliEnv();

  const app = await NestFactory.createApplicationContext(options.module, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const result = await options.run(app);
    if (options.formatResult) {
      options.formatResult(result);
    }
  } catch (error) {
    console.error(`${options.label} failed:`, error);
    process.exitCode = 1;
  } finally {
    await shutdownApplicationContext(app);
  }
}
