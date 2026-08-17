import { Inject, Injectable } from '@nestjs/common';
import { and, eq, gte, sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DATABASE_CLIENT } from '../../database/database.constants';
import * as schema from '../../database/schema';
import { OFFICIAL_MATCH_TOLERANCE } from './crowdsourcing.constants';
import { ReputationService } from './reputation.service';

@Injectable()
export class CrowdsourcedReconciliationService {
  constructor(
    @Inject(DATABASE_CLIENT)
    private readonly db: PostgresJsDatabase<typeof schema>,
    private readonly reputationService: ReputationService,
  ) {}

  /**
   * After an official/commercial observation is inserted, check recent
   * crowdsourced reports for a close match and reward the reporter.
   */
  async reconcileAfterOfficialObservation(
    stationId: string,
    fuelTypeId: string,
    currencyId: string,
    officialPrice: string,
    observedAt: Date,
  ): Promise<void> {
    const windowStart = new Date(observedAt.getTime() - 48 * 60 * 60 * 1000);

    const reports = await this.db
      .select()
      .from(schema.userPriceReports)
      .where(
        and(
          eq(schema.userPriceReports.stationId, stationId),
          eq(schema.userPriceReports.fuelTypeId, fuelTypeId),
          eq(schema.userPriceReports.currencyId, currencyId),
          sql`${schema.userPriceReports.status} IN ('accepted', 'pending')`,
          gte(schema.userPriceReports.reportedAt, windowStart),
        ),
      );

    for (const report of reports) {
      if (!report.userId) {
        continue;
      }

      const diff = Math.abs(Number(report.price) - Number(officialPrice));

      if (diff <= Number(OFFICIAL_MATCH_TOLERANCE)) {
        await this.reputationService.recordEvent(
          report.userId,
          'reportMatchedOfficial',
          report.id,
          { officialPrice, reportPrice: String(report.price) },
        );
      }
    }
  }
}
