import {
  boolean,
  geometry,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { countries } from './countries';
import { dataSources } from './data-sources';

export const stations = pgTable(
  'stations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    countryId: uuid('country_id')
      .notNull()
      .references(() => countries.id, { onDelete: 'restrict' }),
    brand: text('brand'),
    name: text('name'),
    addressLine: text('address_line'),
    postalCode: text('postal_code'),
    city: text('city'),
    location: geometry('location', {
      type: 'point',
      mode: 'xy',
      srid: 4326,
    }).notNull(),
    phone: text('phone'),
    website: text('website'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index('stations_country_id_idx').on(table.countryId),
    index('stations_city_idx').on(table.city),
    index('stations_brand_idx').on(table.brand),
    index('stations_location_gist_idx').using('gist', table.location),
  ],
);

export const stationSourceMappings = pgTable(
  'station_source_mappings',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    stationId: uuid('station_id')
      .notNull()
      .references(() => stations.id, { onDelete: 'cascade' }),
    dataSourceId: uuid('data_source_id')
      .notNull()
      .references(() => dataSources.id, { onDelete: 'cascade' }),
    externalStationId: text('external_station_id').notNull(),
    externalName: text('external_name'),
    externalBrand: text('external_brand'),
    rawMetadata: jsonb('raw_metadata'),
    firstSeenAt: timestamp('first_seen_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex('station_source_mappings_source_external_unique').on(
      table.dataSourceId,
      table.externalStationId,
    ),
    index('station_source_mappings_station_id_idx').on(table.stationId),
    index('station_source_mappings_data_source_id_idx').on(table.dataSourceId),
  ],
);
