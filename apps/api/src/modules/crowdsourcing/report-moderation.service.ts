import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DATABASE_CLIENT } from '../../database/database.constants';
import * as schema from '../../database/schema';
import { ReputationService } from './reputation.service';

@Injectable()
export class ReportModerationService {
  constructor(
    @Inject(DATABASE_CLIENT)
    private readonly db: PostgresJsDatabase<typeof schema>,
    private readonly reputationService: ReputationService,
  ) {}

  async acceptReport(reportId: string, reason?: string): Promise<void> {
    await this.setStatus(reportId, 'accepted', reason);
  }

  async rejectReport(reportId: string, reason: string): Promise<void> {
    const [report] = await this.db
      .select()
      .from(schema.userPriceReports)
      .where(eq(schema.userPriceReports.id, reportId))
      .limit(1);

    if (!report) {
      return;
    }

    await this.db
      .update(schema.userPriceReports)
      .set({
        status: 'rejected',
        moderationReason: reason,
      })
      .where(eq(schema.userPriceReports.id, reportId));

    if (report.userId) {
      await this.reputationService.recordEvent(
        report.userId,
        'reportRejected',
        reportId,
        { reason },
      );
    }
  }

  async markDisputed(reportId: string, reason?: string): Promise<void> {
    await this.setStatus(reportId, 'disputed', reason);
  }

  private async setStatus(
    reportId: string,
    status: 'accepted' | 'disputed' | 'rejected' | 'superseded',
    reason?: string,
  ): Promise<void> {
    await this.db
      .update(schema.userPriceReports)
      .set({
        status,
        moderationReason: reason ?? null,
      })
      .where(eq(schema.userPriceReports.id, reportId));
  }
}
