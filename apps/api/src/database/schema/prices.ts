import {
  boolean,
  index,
  jsonb,
  numeric,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { currencies } from './currencies';
import { dataSources } from './data-sources';
import { priceServiceModeEnum } from './enums';
import { fuelTypes } from './fuels';
import { stationSourceMappings, stations } from './stations';

/** Fuel price per unit; numeric(12,4) preserves exact decimal values. */
export const priceNumeric = numeric('price', { precision: 12, scale: 4 });

export const fuelPriceObservations = pgTable(
  'fuel_price_observations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    stationId: uuid('station_id')
      .notNull()
      .references(() => stations.id, { onDelete: 'cascade' }),
    fuelTypeId: uuid('fuel_type_id')
      .notNull()
      .references(() => fuelTypes.id, { onDelete: 'restrict' }),
    dataSourceId: uuid('data_source_id')
      .notNull()
      .references(() => dataSources.id, { onDelete: 'restrict' }),
    stationSourceMappingId: uuid('station_source_mapping_id').references(
      () => stationSourceMappings.id,
      { onDelete: 'set null' },
    ),
    price: priceNumeric.notNull(),
    currencyId: uuid('currency_id')
      .notNull()
      .references(() => currencies.id, { onDelete: 'restrict' }),
    observedAt: timestamp('observed_at', { withTimezone: true }).notNull(),
    serviceMode: priceServiceModeEnum('service_mode')
      .notNull()
      .default('unknown'),
    receivedAt: timestamp('received_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    confidence: numeric('confidence', { precision: 5, scale: 4 }),
    isUserReport: boolean('is_user_report').notNull().default(false),
    rawPayload: jsonb('raw_payload'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('fuel_price_observations_station_fuel_observed_idx').on(
      table.stationId,
      table.fuelTypeId,
      table.observedAt,
    ),
    index('fuel_price_observations_source_observed_idx').on(
      table.dataSourceId,
      table.observedAt,
    ),
    index('fuel_price_observations_observed_at_idx').on(table.observedAt),
    uniqueIndex('fuel_price_observations_ingestion_dedup_unique').on(
      table.stationSourceMappingId,
      table.fuelTypeId,
      table.serviceMode,
      table.observedAt,
      table.price,
      table.currencyId,
    ),
  ],
);
