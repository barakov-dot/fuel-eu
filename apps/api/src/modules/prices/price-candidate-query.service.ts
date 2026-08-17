import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DATABASE_CLIENT } from '../../database/database.constants';
import * as schema from '../../database/schema';
import { CANDIDATE_MAX_AGE_HOURS } from './price-selection.constants';
import type {
  PriceCandidate,
  PriceServiceMode,
} from './price-selection.service';

type CandidateRow = {
  observation_id: string;
  station_id: string;
  fuel_type_id: string;
  fuel_code: string;
  fuel_name_en: string;
  data_source_id: string;
  data_source_code: string;
  data_source_name: string;
  data_source_type: string;
  data_source_trust_weight: number;
  price: string;
  currency_code: string;
  observed_at: Date;
  received_at: Date;
  observation_confidence: string | null;
  service_mode: PriceServiceMode;
  confirmation_count: number;
  dispute_count: number;
};

@Injectable()
export class PriceCandidateQueryService {
  constructor(
    @Inject(DATABASE_CLIENT)
    private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  async fetchCandidatesForStations(
    stationIds: string[],
    fuelTypeId?: string,
    currency?: string,
  ): Promise<PriceCandidate[]> {
    if (stationIds.length === 0) {
      return [];
    }

    const fuelFilter = fuelTypeId
      ? sql`AND o.fuel_type_id = ${fuelTypeId}`
      : sql``;
    const currencyFilter = currency ? sql`AND cur.code = ${currency}` : sql``;

    const rows = await this.db.execute<CandidateRow>(sql`
      WITH station_set AS (
        SELECT unnest(ARRAY[${sql.join(
          stationIds.map((id) => sql`${id}::uuid`),
          sql`, `,
        )}]) AS station_id
      ),
      vote_counts AS (
        SELECT
          r.source_observation_id AS observation_id,
          COUNT(*) FILTER (WHERE v.vote = 'confirm')::int AS confirmation_count,
          COUNT(*) FILTER (WHERE v.vote = 'dispute')::int AS dispute_count
        FROM ${schema.userPriceReports} r
        LEFT JOIN ${schema.userPriceReportVotes} v ON v.report_id = r.id
        WHERE r.source_observation_id IS NOT NULL
          AND r.status IN ('accepted', 'disputed')
        GROUP BY r.source_observation_id
      )
      SELECT
        o.id AS observation_id,
        o.station_id,
        o.fuel_type_id,
        ft.code AS fuel_code,
        ft.name_en AS fuel_name_en,
        ds.id AS data_source_id,
        ds.code AS data_source_code,
        ds.name AS data_source_name,
        ds.type AS data_source_type,
        ds.trust_weight AS data_source_trust_weight,
        o.price::text AS price,
        cur.code AS currency_code,
        o.observed_at,
        o.received_at,
        o.service_mode,
        o.confidence::text AS observation_confidence,
        COALESCE(vc.confirmation_count, 0) AS confirmation_count,
        COALESCE(vc.dispute_count, 0) AS dispute_count
      FROM ${schema.fuelPriceObservations} o
      INNER JOIN station_set ss ON ss.station_id = o.station_id
      INNER JOIN ${schema.fuelTypes} ft ON ft.id = o.fuel_type_id
      INNER JOIN ${schema.dataSources} ds ON ds.id = o.data_source_id
      INNER JOIN ${schema.currencies} cur ON cur.id = o.currency_id
      LEFT JOIN vote_counts vc ON vc.observation_id = o.id
      WHERE o.observed_at >= NOW() - (${CANDIDATE_MAX_AGE_HOURS} * INTERVAL '1 hour')
        ${fuelFilter}
        ${currencyFilter}
      ORDER BY o.station_id, o.fuel_type_id, o.observed_at DESC
    `);

    return rows.map((row) => this.mapRow(row));
  }

  async fetchTrustedReferencePrice(
    stationId: string,
    fuelTypeId: string,
    currencyId: string,
  ): Promise<string | null> {
    const rows = await this.db.execute<{ price: string }>(sql`
      SELECT o.price::text AS price
      FROM ${schema.fuelPriceObservations} o
      INNER JOIN ${schema.dataSources} ds ON ds.id = o.data_source_id
      WHERE o.station_id = ${stationId}
        AND o.fuel_type_id = ${fuelTypeId}
        AND o.currency_id = ${currencyId}
        AND ds.type IN ('official', 'commercial', 'fuel_chain')
        AND o.observed_at >= NOW() - INTERVAL '7 days'
      ORDER BY o.observed_at DESC, o.received_at DESC
      LIMIT 1
    `);

    return rows[0]?.price ?? null;
  }

  private mapRow(row: CandidateRow): PriceCandidate {
    return {
      observationId: row.observation_id,
      stationId: row.station_id,
      fuelTypeId: row.fuel_type_id,
      fuelCode: row.fuel_code,
      fuelNameEn: row.fuel_name_en,
      dataSourceId: row.data_source_id,
      dataSourceCode: row.data_source_code,
      dataSourceName: row.data_source_name,
      dataSourceType: row.data_source_type,
      sourceTrustWeight: row.data_source_trust_weight,
      price: row.price,
      currencyCode: row.currency_code,
      observedAt:
        row.observed_at instanceof Date
          ? row.observed_at
          : new Date(row.observed_at),
      receivedAt:
        row.received_at instanceof Date
          ? row.received_at
          : new Date(row.received_at),
      observationConfidence: row.observation_confidence
        ? Number(row.observation_confidence)
        : null,
      serviceMode: row.service_mode ?? 'unknown',
      confirmationCount: row.confirmation_count,
      disputeCount: row.dispute_count,
    };
  }
}
