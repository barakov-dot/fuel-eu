import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { dataSources } from './data-sources';
import { ingestionRunStatusEnum } from './enums';

export const ingestionRuns = pgTable(
  'ingestion_runs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    dataSourceId: uuid('data_source_id')
      .notNull()
      .references(() => dataSources.id, { onDelete: 'restrict' }),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    status: ingestionRunStatusEnum('status').notNull(),
    recordsFetched: integer('records_fetched').notNull().default(0),
    stationsCreated: integer('stations_created').notNull().default(0),
    stationsUpdated: integer('stations_updated').notNull().default(0),
    mappingsCreated: integer('mappings_created').notNull().default(0),
    priceObservationsCreated: integer('price_observations_created')
      .notNull()
      .default(0),
    recordsSkipped: integer('records_skipped').notNull().default(0),
    errorsCount: integer('errors_count').notNull().default(0),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('ingestion_runs_data_source_started_idx').on(
      table.dataSourceId,
      table.startedAt,
    ),
    index('ingestion_runs_status_idx').on(table.status),
  ],
);

export const ingestionErrors = pgTable(
  'ingestion_errors',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ingestionRunId: uuid('ingestion_run_id')
      .notNull()
      .references(() => ingestionRuns.id, { onDelete: 'cascade' }),
    externalRecordId: text('external_record_id'),
    errorCode: text('error_code'),
    message: text('message').notNull(),
    rawPayload: jsonb('raw_payload'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index('ingestion_errors_run_id_idx').on(table.ingestionRunId)],
);
