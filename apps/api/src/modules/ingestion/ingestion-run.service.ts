import { Inject, Injectable } from '@nestjs/common';
import { desc, eq } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DATABASE_CLIENT } from '../../database/database.constants';
import * as schema from '../../database/schema';
import type {
  IngestionRunStatus,
  IngestionStats,
} from './types/ingestion.types';
import type { ProviderRecordError } from './providers/fuel-price-provider.interface';

@Injectable()
export class IngestionRunService {
  constructor(
    @Inject(DATABASE_CLIENT)
    private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  async startRun(dataSourceId: string) {
    const startedAt = new Date();
    const [run] = await this.db
      .insert(schema.ingestionRuns)
      .values({
        dataSourceId,
        startedAt,
        status: 'running',
      })
      .returning();

    return run;
  }

  async finishRun(
    runId: string,
    status: IngestionRunStatus,
    stats: IngestionStats,
    metadata?: Record<string, unknown>,
  ) {
    await this.db
      .update(schema.ingestionRuns)
      .set({
        finishedAt: new Date(),
        status,
        recordsFetched: stats.recordsFetched,
        stationsCreated: stats.stationsCreated,
        stationsUpdated: stats.stationsUpdated,
        mappingsCreated: stats.mappingsCreated,
        priceObservationsCreated: stats.priceObservationsCreated,
        recordsSkipped: stats.recordsSkipped,
        errorsCount: stats.errorsCount,
        metadata,
      })
      .where(eq(schema.ingestionRuns.id, runId));
  }

  async recordErrors(runId: string, errors: ProviderRecordError[]) {
    if (errors.length === 0) {
      return;
    }

    const bounded = errors.slice(0, 500);
    await this.db.insert(schema.ingestionErrors).values(
      bounded.map((error) => ({
        ingestionRunId: runId,
        externalRecordId: error.externalRecordId,
        errorCode: error.errorCode,
        message: error.message.slice(0, 2000),
        rawPayload: error.rawPayload,
      })),
    );
  }

  async getLatestRunBySourceCode(sourceCode: string) {
    const source = await this.db.query.dataSources.findFirst({
      where: eq(schema.dataSources.code, sourceCode),
    });
    if (!source) {
      return null;
    }

    return this.db.query.ingestionRuns.findFirst({
      where: eq(schema.ingestionRuns.dataSourceId, source.id),
      orderBy: [desc(schema.ingestionRuns.startedAt)],
    });
  }

  async getActiveSourcesWithLatestRun() {
    const sources = await this.db.query.dataSources.findMany({
      where: eq(schema.dataSources.isActive, true),
      with: {
        country: true,
        ingestionRuns: {
          limit: 1,
          orderBy: [desc(schema.ingestionRuns.startedAt)],
        },
      },
    });

    return sources;
  }
}
