import { Inject, Injectable } from '@nestjs/common';
import { HealthIndicatorService } from '@nestjs/terminus';
import { sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DATABASE_CLIENT } from '../../database/database.constants';
import * as schema from '../../database/schema';

@Injectable()
export class PostgisHealthIndicator {
  constructor(
    @Inject(DATABASE_CLIENT)
    private readonly db: PostgresJsDatabase<typeof schema>,
    private readonly healthIndicatorService: HealthIndicatorService,
  ) {}

  async isHealthy(key: string) {
    const indicator = this.healthIndicatorService.check(key);

    try {
      const result = await this.db.execute(sql`
        SELECT extname
        FROM pg_extension
        WHERE extname = 'postgis'
        LIMIT 1
      `);

      if (result.length === 0) {
        return indicator.down({
          message: 'PostGIS extension is not installed',
        });
      }

      const versionResult = await this.db.execute(
        sql`SELECT PostGIS_Version() AS version`,
      );
      const version = versionResult[0]?.version as string | undefined;

      return indicator.up({ version: version ?? 'unknown' });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'PostGIS check failed';
      return indicator.down({ message });
    }
  }
}
