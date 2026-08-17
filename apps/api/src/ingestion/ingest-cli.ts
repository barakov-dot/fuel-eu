import { NestFactory } from '@nestjs/core';
import { resolve } from 'node:path';
import { IngestionCliModule } from '../cli/ingestion-cli.module';
import { loadCliEnv } from '../cli/load-env';
import { shutdownApplicationContext } from '../cli/shutdown-application-context';
import { AdvisoryLockError } from '../modules/ingestion/locking/advisory-lock';
import { IngestionService } from '../modules/ingestion/ingestion.service';
import type { IngestionResult } from '../modules/ingestion/types/ingestion.types';

export interface IngestCliOptions {
  dryRun?: boolean;
  fixturePath?: string;
  syncMode?: 'full' | 'prices';
  location?: { lat: number; lon: number };
}

export function parseIngestCliArgs(
  args: string[],
  defaultFixturePath: string,
): IngestCliOptions {
  const dryRun = args.includes('--dry-run');
  const fixtureArg = args.find((a) => a.startsWith('--fixture='));
  const fixturePath = fixtureArg
    ? fixtureArg.split('=')[1]
    : args.includes('--fixture')
      ? defaultFixturePath
      : undefined;

  const latArg = args.find((a) => a.startsWith('--lat='));
  const lonArg = args.find((a) => a.startsWith('--lon='));
  const lat = latArg ? Number.parseFloat(latArg.split('=')[1]) : undefined;
  const lon = lonArg ? Number.parseFloat(lonArg.split('=')[1]) : undefined;
  const location =
    lat !== undefined &&
    lon !== undefined &&
    Number.isFinite(lat) &&
    Number.isFinite(lon)
      ? { lat, lon }
      : undefined;

  const syncModeArg = args.find((a) => a.startsWith('--sync-mode='));
  const syncMode = syncModeArg?.split('=')[1];
  const parsedSyncMode =
    syncMode === 'full' || syncMode === 'prices' ? syncMode : undefined;

  return { dryRun, fixturePath, location, syncMode: parsedSyncMode };
}

export function printIngestionResult(result: IngestionResult): void {
  console.log(
    JSON.stringify(
      {
        runId: result.runId,
        status: result.status,
        durationMs: result.durationMs,
        recordsFetched: result.recordsFetched,
        stationsCreated: result.stationsCreated,
        stationsUpdated: result.stationsUpdated,
        mappingsCreated: result.mappingsCreated,
        priceObservationsCreated: result.priceObservationsCreated,
        recordsSkipped: result.recordsSkipped,
        errorsCount: result.errorsCount,
        metadata: result.metadata,
      },
      null,
      2,
    ),
  );
}

export async function runIngestCli(
  run: (service: IngestionService) => Promise<IngestionResult>,
  label: string,
): Promise<void> {
  loadCliEnv();

  const app = await NestFactory.createApplicationContext(IngestionCliModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const ingestionService = app.get(IngestionService);
    const result = await run(ingestionService);
    printIngestionResult(result);

    if (result.status === 'failed') {
      process.exitCode = 1;
    }
  } catch (error) {
    if (error instanceof AdvisoryLockError) {
      console.error(error.message);
      process.exitCode = 2;
    } else {
      console.error(`${label} ingestion failed:`, error);
      process.exitCode = 1;
    }
  } finally {
    await shutdownApplicationContext(app);
  }
}

export function resolveDefaultFixture(
  provider:
    | 'france'
    | 'spain'
    | 'germany'
    | 'austria'
    | 'italy'
    | 'slovenia'
    | 'croatia',
): string {
  if (provider === 'france') {
    return resolve(
      __dirname,
      '../../test/fixtures/france/instantaneous-small.json',
    );
  }
  if (provider === 'germany') {
    return resolve(
      __dirname,
      '../../test/fixtures/germany/stations-small.json',
    );
  }
  if (provider === 'austria') {
    return resolve(
      __dirname,
      '../../test/fixtures/austria/vienna-diesel-small.json',
    );
  }
  if (provider === 'italy') {
    return resolve(__dirname, '../../test/fixtures/italy');
  }
  if (provider === 'slovenia') {
    return resolve(__dirname, '../../test/fixtures/slovenia/search-small.json');
  }
  if (provider === 'croatia') {
    return resolve(__dirname, '../../test/fixtures/croatia/data-small.json');
  }
  return resolve(__dirname, '../../test/fixtures/spain/terrestrial-small.json');
}
