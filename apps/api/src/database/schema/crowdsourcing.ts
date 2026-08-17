import {
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { fuelPriceObservations, priceNumeric } from './prices';
import { fuelTypes } from './fuels';
import { currencies } from './currencies';
import { stations } from './stations';
import { users } from './users';
import {
  userPriceReportStatusEnum,
  userPriceReportVoteEnum,
  userReputationEventTypeEnum,
} from './crowdsourcing-enums';

/** Application confidence score 0.0–1.0 for a user price report. */
export const confidenceNumeric = numeric('confidence_score', {
  precision: 5,
  scale: 4,
});

export const userPriceReports = pgTable(
  'user_price_reports',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    /** Nullable after account deletion (GDPR anonymization). */
    userId: uuid('user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    stationId: uuid('station_id')
      .notNull()
      .references(() => stations.id, { onDelete: 'cascade' }),
    fuelTypeId: uuid('fuel_type_id')
      .notNull()
      .references(() => fuelTypes.id, { onDelete: 'restrict' }),
    price: priceNumeric.notNull(),
    currencyId: uuid('currency_id')
      .notNull()
      .references(() => currencies.id, { onDelete: 'restrict' }),
    reportedAt: timestamp('reported_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    status: userPriceReportStatusEnum('status').notNull().default('pending'),
    confidenceScore: confidenceNumeric.notNull(),
    sourceObservationId: uuid('source_observation_id').references(
      () => fuelPriceObservations.id,
      { onDelete: 'set null' },
    ),
    supersededByReportId: uuid('superseded_by_report_id'),
    /** Derived server-side distance; exact reporter coordinates are not stored. */
    distanceFromStationMeters: integer('distance_from_station_meters'),
    comment: text('comment'),
    moderationReason: text('moderation_reason'),
  },
  (table) => [
    index('user_price_reports_station_fuel_reported_idx').on(
      table.stationId,
      table.fuelTypeId,
      table.reportedAt,
    ),
    index('user_price_reports_user_created_idx').on(
      table.userId,
      table.createdAt,
    ),
    index('user_price_reports_status_idx').on(table.status),
  ],
);

export const userPriceReportVotes = pgTable(
  'user_price_report_votes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    reportId: uuid('report_id')
      .notNull()
      .references(() => userPriceReports.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    vote: userPriceReportVoteEnum('vote').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex('user_price_report_votes_report_user_unique').on(
      table.reportId,
      table.userId,
    ),
    index('user_price_report_votes_report_idx').on(table.reportId),
  ],
);

export const userReputationEvents = pgTable(
  'user_reputation_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: userReputationEventTypeEnum('type').notNull(),
    points: integer('points').notNull(),
    relatedReportId: uuid('related_report_id').references(
      () => userPriceReports.id,
      { onDelete: 'set null' },
    ),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    metadata: jsonb('metadata'),
  },
  (table) => [
    index('user_reputation_events_user_created_idx').on(
      table.userId,
      table.createdAt,
    ),
  ],
);

export const userReputation = pgTable('user_reputation', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  score: integer('score').notNull().default(50),
  acceptedReportsCount: integer('accepted_reports_count').notNull().default(0),
  confirmedReportsCount: integer('confirmed_reports_count')
    .notNull()
    .default(0),
  rejectedReportsCount: integer('rejected_reports_count').notNull().default(0),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});
