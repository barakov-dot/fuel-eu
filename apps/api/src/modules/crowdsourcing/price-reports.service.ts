import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { and, desc, eq, gte, lte, sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DATABASE_CLIENT } from '../../database/database.constants';
import * as schema from '../../database/schema';
import { userPriceReports } from '../../database/schema/crowdsourcing';
import { CROWDSOURCED_SOURCE_ID } from '../../database/seeds/crowdsourced-source.seed';
import {
  AUTO_ACCEPT_CONFIDENCE_THRESHOLD,
  CORROBORATION_WINDOW_MINUTES,
  REPORT_DUPLICATE_COOLDOWN_MINUTES,
  REPORT_MAX_AGE_HOURS,
  REPORT_MAX_FUTURE_MINUTES,
  REPORT_MAX_PRICE,
  REPORT_MIN_PRICE,
} from './crowdsourcing.constants';
import { ConfidenceService } from './confidence.service';
import { ReputationService } from './reputation.service';
import type { CreatePriceReportDto } from './dto/price-report.dto';
import type { VoteReportDto } from './dto/vote-report.dto';
import { PriceCandidateQueryService } from '../prices/price-candidate-query.service';
import { ReportImagesService } from '../ocr/report-images.service';

@Injectable()
export class PriceReportsService {
  constructor(
    @Inject(DATABASE_CLIENT)
    private readonly db: PostgresJsDatabase<typeof schema>,
    private readonly reputationService: ReputationService,
    private readonly confidenceService: ConfidenceService,
    private readonly priceCandidateQuery: PriceCandidateQueryService,
    @Inject(forwardRef(() => ReportImagesService))
    private readonly reportImagesService: ReportImagesService,
  ) {}

  async createReport(
    userId: string,
    stationId: string,
    dto: CreatePriceReportDto,
  ) {
    await this.getStationOrThrow(stationId);
    const fuelType = await this.getFuelTypeOrThrow(dto.fuelTypeId);
    const currency = await this.getCurrencyOrThrow(dto.currency);

    this.validatePrice(dto.price);
    this.validateReportedAt(dto.reportedAt);

    const reportedAt = dto.reportedAt ? new Date(dto.reportedAt) : new Date();

    await this.checkDuplicateCooldown(
      userId,
      stationId,
      dto.fuelTypeId,
      dto.price,
    );

    const distanceMeters = await this.computeDistanceMeters(
      stationId,
      dto.location?.lat,
      dto.location?.lon,
    );

    let linkedImage: typeof schema.reportImages.$inferSelect | null = null;
    if (dto.reportImageId) {
      linkedImage = await this.reportImagesService.validateImageForReport(
        userId,
        stationId,
        dto.reportImageId,
      );
    }

    const reputationScore = await this.reputationService.getScore(userId);
    const trustedReference =
      await this.priceCandidateQuery.fetchTrustedReferencePrice(
        stationId,
        dto.fuelTypeId,
        currency.id,
      );

    const confidence = this.confidenceService.computeInitialConfidence({
      reputationScore,
      distanceMeters,
      reportedAt,
      trustedReferencePrice: trustedReference,
      reportedPrice: dto.price,
      hasPhotoEvidence: !!linkedImage,
    });

    const status =
      confidence >= AUTO_ACCEPT_CONFIDENCE_THRESHOLD ? 'accepted' : 'pending';

    const corroboratingReport = await this.findCorroboratingReport(
      stationId,
      dto.fuelTypeId,
      currency.id,
      dto.price,
      reportedAt,
    );

    const report = await this.db.transaction(async (tx) => {
      const [created] = await tx
        .insert(schema.userPriceReports)
        .values({
          userId,
          stationId,
          fuelTypeId: dto.fuelTypeId,
          price: dto.price,
          currencyId: currency.id,
          reportedAt,
          status,
          confidenceScore: this.confidenceService.formatConfidence(confidence),
          distanceFromStationMeters: distanceMeters,
          comment: dto.comment?.trim() || null,
        })
        .returning();

      if (corroboratingReport) {
        await this.applyCorroboration(tx, created, corroboratingReport);
        return created;
      }

      if (status === 'accepted') {
        const observationId = await this.createObservation(tx, {
          stationId,
          fuelTypeId: dto.fuelTypeId,
          currencyId: currency.id,
          price: dto.price,
          observedAt: reportedAt,
          confidence,
        });

        await tx
          .update(schema.userPriceReports)
          .set({ sourceObservationId: observationId })
          .where(eq(schema.userPriceReports.id, created.id));

        created.sourceObservationId = observationId;
        await this.reputationService.recordEvent(
          userId,
          'reportSubmitted',
          created.id,
          undefined,
          tx,
        );
      }

      if (linkedImage) {
        await this.reportImagesService.linkImageToReport(
          tx,
          created.id,
          linkedImage.id,
          {
            ocrAssisted: dto.ocrAssisted ?? false,
            originalCandidate: dto.originalCandidate,
          },
        );
      }

      return created;
    });

    const voteCounts = await this.getVoteCounts(report.id);
    const evidence = await this.getReportEvidence(report.id);

    return this.mapReportResponse(report, fuelType, currency, voteCounts, {
      isAuthor: true,
      userVote: null,
      evidence,
    });
  }

  async listStationReports(
    stationId: string,
    fuelTypeId: string | undefined,
    limit: number,
    currentUserId?: string,
  ) {
    if (!(await this.stationExists(stationId))) {
      throw new NotFoundException(`Station ${stationId} not found`);
    }

    const conditions = [
      eq(schema.userPriceReports.stationId, stationId),
      sql`${schema.userPriceReports.status} IN ('accepted', 'pending', 'disputed')`,
    ];

    if (fuelTypeId) {
      conditions.push(eq(schema.userPriceReports.fuelTypeId, fuelTypeId));
    }

    const rows = await this.db
      .select({
        report: schema.userPriceReports,
        fuelCode: schema.fuelTypes.code,
        fuelNameEn: schema.fuelTypes.nameEn,
        currencyCode: schema.currencies.code,
      })
      .from(schema.userPriceReports)
      .innerJoin(
        schema.fuelTypes,
        eq(schema.userPriceReports.fuelTypeId, schema.fuelTypes.id),
      )
      .innerJoin(
        schema.currencies,
        eq(schema.userPriceReports.currencyId, schema.currencies.id),
      )
      .where(and(...conditions))
      .orderBy(desc(schema.userPriceReports.reportedAt))
      .limit(limit);

    const items = await Promise.all(
      rows.map(async (row) => {
        const voteCounts = await this.getVoteCounts(row.report.id);
        const userVote = currentUserId
          ? await this.getUserVote(row.report.id, currentUserId)
          : null;
        const evidence = await this.getReportEvidence(row.report.id);

        return this.mapReportResponse(
          row.report,
          { code: row.fuelCode, nameEn: row.fuelNameEn },
          { code: row.currencyCode },
          voteCounts,
          {
            isAuthor: currentUserId === row.report.userId,
            userVote,
            evidence,
          },
        );
      }),
    );

    return { items };
  }

  async listMyReports(userId: string, limit: number) {
    const rows = await this.db
      .select({
        report: schema.userPriceReports,
        fuelCode: schema.fuelTypes.code,
        fuelNameEn: schema.fuelTypes.nameEn,
        currencyCode: schema.currencies.code,
        stationName: schema.stations.name,
        stationBrand: schema.stations.brand,
        stationCity: schema.stations.city,
        countryIso2: schema.countries.iso2,
      })
      .from(schema.userPriceReports)
      .innerJoin(
        schema.fuelTypes,
        eq(schema.userPriceReports.fuelTypeId, schema.fuelTypes.id),
      )
      .innerJoin(
        schema.currencies,
        eq(schema.userPriceReports.currencyId, schema.currencies.id),
      )
      .innerJoin(
        schema.stations,
        eq(schema.userPriceReports.stationId, schema.stations.id),
      )
      .innerJoin(
        schema.countries,
        eq(schema.stations.countryId, schema.countries.id),
      )
      .where(eq(schema.userPriceReports.userId, userId))
      .orderBy(desc(schema.userPriceReports.createdAt))
      .limit(limit);

    const items = await Promise.all(
      rows.map(async (row) => {
        const voteCounts = await this.getVoteCounts(row.report.id);
        const evidence = await this.getReportEvidence(row.report.id);
        return {
          ...this.mapReportResponse(
            row.report,
            { code: row.fuelCode, nameEn: row.fuelNameEn },
            { code: row.currencyCode },
            voteCounts,
            { isAuthor: true, userVote: null, evidence },
          ),
          station: {
            id: row.report.stationId,
            name: row.stationName,
            brand: row.stationBrand,
            city: row.stationCity,
            countryIso2: row.countryIso2,
          },
        };
      }),
    );

    return { items };
  }

  async voteOnReport(userId: string, reportId: string, dto: VoteReportDto) {
    const report = await this.getReportOrThrow(reportId);

    if (report.userId === userId) {
      throw new ForbiddenException('You cannot vote on your own report');
    }

    if (!['accepted', 'pending', 'disputed'].includes(report.status)) {
      throw new BadRequestException('Report is not eligible for voting');
    }

    await this.db
      .insert(schema.userPriceReportVotes)
      .values({
        reportId,
        userId,
        vote: dto.vote,
      })
      .onConflictDoUpdate({
        target: [
          schema.userPriceReportVotes.reportId,
          schema.userPriceReportVotes.userId,
        ],
        set: {
          vote: dto.vote,
          updatedAt: new Date(),
        },
      });

    await this.recalculateReportConfidence(reportId);

    const updated = await this.getReportOrThrow(reportId);
    const voteCounts = await this.getVoteCounts(reportId);

    if (dto.vote === 'confirm' && report.userId) {
      await this.reputationService.recordEvent(
        report.userId,
        'reportConfirmed',
        reportId,
      );
    } else if (dto.vote === 'dispute' && report.userId) {
      await this.reputationService.recordEvent(
        report.userId,
        'reportDisputed',
        reportId,
      );
    }

    return {
      reportId,
      vote: dto.vote,
      status: updated.status,
      confidence: updated.confidenceScore,
      confirmations: voteCounts.confirmations,
      disputes: voteCounts.disputes,
    };
  }

  private async recalculateReportConfidence(reportId: string) {
    const report = await this.getReportOrThrow(reportId);
    const voteCounts = await this.getVoteCounts(reportId);

    const reputationScore = report.userId
      ? await this.reputationService.getScore(report.userId)
      : 50;

    const trustedReference =
      await this.priceCandidateQuery.fetchTrustedReferencePrice(
        report.stationId,
        report.fuelTypeId,
        report.currencyId,
      );

    const confidence = this.confidenceService.computeInitialConfidence({
      reputationScore,
      distanceMeters: report.distanceFromStationMeters,
      reportedAt: report.reportedAt,
      trustedReferencePrice: trustedReference,
      reportedPrice: String(report.price),
      confirmCount: voteCounts.confirmations,
      disputeCount: voteCounts.disputes,
    });

    let status = report.status;
    if (
      confidence >= AUTO_ACCEPT_CONFIDENCE_THRESHOLD &&
      status === 'pending'
    ) {
      status = 'accepted';
    }
    if (
      voteCounts.disputes > voteCounts.confirmations &&
      voteCounts.disputes >= 2
    ) {
      status = 'disputed';
    }

    await this.db.transaction(async (tx) => {
      await tx
        .update(schema.userPriceReports)
        .set({
          confidenceScore: this.confidenceService.formatConfidence(confidence),
          status,
        })
        .where(eq(schema.userPriceReports.id, reportId));

      if (status === 'accepted' && !report.sourceObservationId) {
        const observationId = await this.createObservation(tx, {
          stationId: report.stationId,
          fuelTypeId: report.fuelTypeId,
          currencyId: report.currencyId,
          price: String(report.price),
          observedAt: report.reportedAt,
          confidence,
        });

        await tx
          .update(schema.userPriceReports)
          .set({ sourceObservationId: observationId })
          .where(eq(schema.userPriceReports.id, reportId));

        if (report.userId) {
          await this.reputationService.recordEvent(
            report.userId,
            'reportSubmitted',
            reportId,
            undefined,
            tx,
          );
        }
      }
    });
  }

  private async applyCorroboration(
    tx: PostgresJsDatabase<typeof schema>,
    newReport: typeof userPriceReports.$inferSelect,
    existingReport: typeof userPriceReports.$inferSelect,
  ) {
    const voteCounts = await this.getVoteCounts(existingReport.id);

    const reputationScore = existingReport.userId
      ? await this.reputationService.getScore(existingReport.userId)
      : 50;

    const confidence = this.confidenceService.computeInitialConfidence({
      reputationScore,
      distanceMeters: existingReport.distanceFromStationMeters,
      reportedAt: existingReport.reportedAt,
      trustedReferencePrice: null,
      reportedPrice: String(existingReport.price),
      confirmCount: voteCounts.confirmations + 1,
      disputeCount: voteCounts.disputes,
    });

    await tx
      .update(schema.userPriceReports)
      .set({
        confidenceScore: this.confidenceService.formatConfidence(confidence),
      })
      .where(eq(schema.userPriceReports.id, existingReport.id));

    if (existingReport.sourceObservationId) {
      await tx
        .update(schema.userPriceReports)
        .set({ sourceObservationId: existingReport.sourceObservationId })
        .where(eq(schema.userPriceReports.id, newReport.id));

      await this.reputationService.recordEvent(
        newReport.userId!,
        'reportSubmitted',
        newReport.id,
        { corroboration: true },
        tx,
      );
    }
  }

  private async findCorroboratingReport(
    stationId: string,
    fuelTypeId: string,
    currencyId: string,
    price: string,
    reportedAt: Date,
  ) {
    const windowStart = new Date(
      reportedAt.getTime() - CORROBORATION_WINDOW_MINUTES * 60 * 1000,
    );
    const windowEnd = new Date(
      reportedAt.getTime() + CORROBORATION_WINDOW_MINUTES * 60 * 1000,
    );

    const [existing] = await this.db
      .select()
      .from(schema.userPriceReports)
      .where(
        and(
          eq(schema.userPriceReports.stationId, stationId),
          eq(schema.userPriceReports.fuelTypeId, fuelTypeId),
          eq(schema.userPriceReports.currencyId, currencyId),
          eq(schema.userPriceReports.price, price),
          sql`${schema.userPriceReports.status} IN ('accepted', 'pending')`,
          gte(schema.userPriceReports.reportedAt, windowStart),
          lte(schema.userPriceReports.reportedAt, windowEnd),
          sql`${schema.userPriceReports.sourceObservationId} IS NOT NULL`,
        ),
      )
      .orderBy(desc(schema.userPriceReports.reportedAt))
      .limit(1);

    return existing ?? null;
  }

  private async createObservation(
    tx: PostgresJsDatabase<typeof schema>,
    params: {
      stationId: string;
      fuelTypeId: string;
      currencyId: string;
      price: string;
      observedAt: Date;
      confidence: number;
    },
  ): Promise<string> {
    const [observation] = await tx
      .insert(schema.fuelPriceObservations)
      .values({
        stationId: params.stationId,
        fuelTypeId: params.fuelTypeId,
        dataSourceId: CROWDSOURCED_SOURCE_ID,
        price: params.price,
        currencyId: params.currencyId,
        observedAt: params.observedAt,
        confidence: this.confidenceService.formatConfidence(params.confidence),
        isUserReport: true,
      })
      .returning({ id: schema.fuelPriceObservations.id });

    return observation.id;
  }

  private async checkDuplicateCooldown(
    userId: string,
    stationId: string,
    fuelTypeId: string,
    price: string,
  ) {
    const cooldownStart = new Date(
      Date.now() - REPORT_DUPLICATE_COOLDOWN_MINUTES * 60 * 1000,
    );

    const [existing] = await this.db
      .select({ id: schema.userPriceReports.id })
      .from(schema.userPriceReports)
      .where(
        and(
          eq(schema.userPriceReports.userId, userId),
          eq(schema.userPriceReports.stationId, stationId),
          eq(schema.userPriceReports.fuelTypeId, fuelTypeId),
          eq(schema.userPriceReports.price, price),
          gte(schema.userPriceReports.createdAt, cooldownStart),
        ),
      )
      .limit(1);

    if (existing) {
      throw new ConflictException(
        'You recently submitted the same price for this fuel. Please wait before reporting again.',
      );
    }
  }

  private async computeDistanceMeters(
    stationId: string,
    lat?: number,
    lon?: number,
  ): Promise<number | null> {
    if (lat === undefined || lon === undefined) {
      return null;
    }

    const rows = await this.db.execute<{ distance_meters: number }>(sql`
      SELECT ST_Distance(
        s.location::geography,
        ST_SetSRID(ST_MakePoint(${lon}, ${lat}), 4326)::geography
      ) AS distance_meters
      FROM ${schema.stations} s
      WHERE s.id = ${stationId}
    `);

    const distance = rows[0]?.distance_meters;
    return distance !== undefined ? Math.round(distance) : null;
  }

  private validatePrice(price: string) {
    if (!/^\d+(\.\d{1,4})?$/.test(price)) {
      throw new BadRequestException(
        'Price must be a positive decimal string with up to 4 decimal places',
      );
    }

    const numeric = Number(price);
    if (
      numeric <= Number(REPORT_MIN_PRICE) ||
      numeric > Number(REPORT_MAX_PRICE)
    ) {
      throw new BadRequestException(
        `Price must be between ${REPORT_MIN_PRICE} and ${REPORT_MAX_PRICE}`,
      );
    }
  }

  private validateReportedAt(reportedAt?: string) {
    if (!reportedAt) {
      return;
    }

    const date = new Date(reportedAt);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('Invalid reportedAt timestamp');
    }

    const now = Date.now();
    const maxFuture = REPORT_MAX_FUTURE_MINUTES * 60 * 1000;
    const maxAge = REPORT_MAX_AGE_HOURS * 60 * 60 * 1000;

    if (date.getTime() > now + maxFuture) {
      throw new BadRequestException('reportedAt cannot be in the future');
    }

    if (date.getTime() < now - maxAge) {
      throw new BadRequestException(
        `reportedAt cannot be older than ${REPORT_MAX_AGE_HOURS} hours`,
      );
    }
  }

  private async getStationOrThrow(stationId: string) {
    const [station] = await this.db
      .select({
        id: schema.stations.id,
        countryId: schema.stations.countryId,
      })
      .from(schema.stations)
      .where(eq(schema.stations.id, stationId))
      .limit(1);

    if (!station) {
      throw new NotFoundException(`Station ${stationId} not found`);
    }

    return station;
  }

  private async stationExists(stationId: string) {
    const [station] = await this.db
      .select({ id: schema.stations.id })
      .from(schema.stations)
      .where(eq(schema.stations.id, stationId))
      .limit(1);
    return !!station;
  }

  private async getFuelTypeOrThrow(fuelTypeId: string) {
    const [fuel] = await this.db
      .select()
      .from(schema.fuelTypes)
      .where(eq(schema.fuelTypes.id, fuelTypeId))
      .limit(1);

    if (!fuel) {
      throw new NotFoundException(`Fuel type ${fuelTypeId} not found`);
    }

    return fuel;
  }

  private async getCurrencyOrThrow(code: string) {
    const [currency] = await this.db
      .select()
      .from(schema.currencies)
      .where(eq(schema.currencies.code, code.toUpperCase()))
      .limit(1);

    if (!currency) {
      throw new NotFoundException(`Currency ${code} not found`);
    }

    return currency;
  }

  private async getReportOrThrow(reportId: string) {
    const [report] = await this.db
      .select()
      .from(schema.userPriceReports)
      .where(eq(schema.userPriceReports.id, reportId))
      .limit(1);

    if (!report) {
      throw new NotFoundException(`Report ${reportId} not found`);
    }

    return report;
  }

  private async getVoteCounts(reportId: string) {
    const rows = await this.db.execute<{
      confirmations: number;
      disputes: number;
    }>(sql`
      SELECT
        COUNT(*) FILTER (WHERE vote = 'confirm')::int AS confirmations,
        COUNT(*) FILTER (WHERE vote = 'dispute')::int AS disputes
      FROM ${schema.userPriceReportVotes}
      WHERE report_id = ${reportId}
    `);

    return {
      confirmations: rows[0]?.confirmations ?? 0,
      disputes: rows[0]?.disputes ?? 0,
    };
  }

  private async getUserVote(reportId: string, userId: string) {
    const [vote] = await this.db
      .select({ vote: schema.userPriceReportVotes.vote })
      .from(schema.userPriceReportVotes)
      .where(
        and(
          eq(schema.userPriceReportVotes.reportId, reportId),
          eq(schema.userPriceReportVotes.userId, userId),
        ),
      )
      .limit(1);

    return vote?.vote ?? null;
  }

  private async getReportEvidence(reportId: string) {
    const [link] = await this.db
      .select({
        ocrAssisted: schema.userPriceReportImages.ocrAssisted,
      })
      .from(schema.userPriceReportImages)
      .where(eq(schema.userPriceReportImages.reportId, reportId))
      .limit(1);

    return {
      hasPhoto: !!link,
      ocrAssisted: link?.ocrAssisted ?? false,
    };
  }

  private mapReportResponse(
    report: typeof userPriceReports.$inferSelect,
    fuel: { code: string; nameEn: string },
    currency: { code: string },
    voteCounts: { confirmations: number; disputes: number },
    meta: {
      isAuthor: boolean;
      userVote: string | null;
      evidence?: { hasPhoto: boolean; ocrAssisted: boolean };
    },
  ) {
    return {
      id: report.id,
      stationId: report.stationId,
      fuelTypeId: report.fuelTypeId,
      fuelCode: fuel.code,
      fuelName: fuel.nameEn,
      price: String(report.price),
      currency: currency.code,
      reportedAt: report.reportedAt.toISOString(),
      createdAt: report.createdAt.toISOString(),
      status: report.status,
      confidence: String(report.confidenceScore),
      confirmations: voteCounts.confirmations,
      disputes: voteCounts.disputes,
      isAuthor: meta.isAuthor,
      userVote: meta.userVote,
      evidence: meta.evidence ?? { hasPhoto: false, ocrAssisted: false },
    };
  }
}
