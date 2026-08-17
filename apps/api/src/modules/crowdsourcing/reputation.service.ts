import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DATABASE_CLIENT } from '../../database/database.constants';
import * as schema from '../../database/schema';
import {
  REPUTATION_INITIAL,
  REPUTATION_MAX,
  REPUTATION_MIN,
  REPUTATION_POINTS,
} from './crowdsourcing.constants';

const EVENT_TYPE_MAP = {
  reportSubmitted: 'report_submitted',
  reportConfirmed: 'report_confirmed',
  reportDisputed: 'report_disputed',
  reportMatchedOfficial: 'report_matched_official',
  reportRejected: 'report_rejected',
  abusePenalty: 'abuse_penalty',
} as const;

@Injectable()
export class ReputationService {
  constructor(
    @Inject(DATABASE_CLIENT)
    private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  async ensureReputation(
    userId: string,
    tx?: PostgresJsDatabase<typeof schema>,
  ) {
    const db = tx ?? this.db;
    await db
      .insert(schema.userReputation)
      .values({
        userId,
        score: REPUTATION_INITIAL,
      })
      .onConflictDoNothing({ target: schema.userReputation.userId });
  }

  async getScore(userId: string): Promise<number> {
    await this.ensureReputation(userId);
    const [row] = await this.db
      .select({ score: schema.userReputation.score })
      .from(schema.userReputation)
      .where(eq(schema.userReputation.userId, userId))
      .limit(1);
    return row?.score ?? REPUTATION_INITIAL;
  }

  async getSummary(userId: string) {
    await this.ensureReputation(userId);
    const [row] = await this.db
      .select()
      .from(schema.userReputation)
      .where(eq(schema.userReputation.userId, userId))
      .limit(1);

    return {
      score: row?.score ?? REPUTATION_INITIAL,
      acceptedReportsCount: row?.acceptedReportsCount ?? 0,
      confirmedReportsCount: row?.confirmedReportsCount ?? 0,
      rejectedReportsCount: row?.rejectedReportsCount ?? 0,
    };
  }

  async recordEvent(
    userId: string,
    eventKey: keyof typeof REPUTATION_POINTS,
    relatedReportId?: string,
    metadata?: Record<string, unknown>,
    tx?: PostgresJsDatabase<typeof schema>,
  ): Promise<number> {
    const db = tx ?? this.db;
    const points = REPUTATION_POINTS[eventKey];

    await this.ensureReputation(userId, db);

    await db.insert(schema.userReputationEvents).values({
      userId,
      type: EVENT_TYPE_MAP[eventKey],
      points,
      relatedReportId: relatedReportId ?? null,
      metadata: metadata ?? null,
    });

    const [current] = await db
      .select()
      .from(schema.userReputation)
      .where(eq(schema.userReputation.userId, userId))
      .limit(1);

    const newScore = this.clampScore(
      (current?.score ?? REPUTATION_INITIAL) + points,
    );

    const updateValues: Partial<typeof schema.userReputation.$inferInsert> = {
      score: newScore,
      updatedAt: new Date(),
    };

    if (eventKey === 'reportSubmitted') {
      updateValues.acceptedReportsCount =
        (current?.acceptedReportsCount ?? 0) + 1;
    } else if (eventKey === 'reportConfirmed') {
      updateValues.confirmedReportsCount =
        (current?.confirmedReportsCount ?? 0) + 1;
    } else if (eventKey === 'reportRejected') {
      updateValues.rejectedReportsCount =
        (current?.rejectedReportsCount ?? 0) + 1;
    }

    await db
      .update(schema.userReputation)
      .set(updateValues)
      .where(eq(schema.userReputation.userId, userId));

    return newScore;
  }

  clampScore(score: number): number {
    return Math.max(REPUTATION_MIN, Math.min(REPUTATION_MAX, score));
  }

  reputationToBaseConfidence(reputationScore: number): number {
    const normalized = this.clampScore(reputationScore) / REPUTATION_MAX;
    return 0.3 + normalized * 0.4;
  }
}
