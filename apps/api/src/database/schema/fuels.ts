import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { countries } from './countries';
import { dataSources } from './data-sources';
import { fuelCategoryEnum, fuelUnitEnum } from './enums';
import { stations } from './stations';

export const fuelTypes = pgTable(
  'fuel_types',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    code: text('code').notNull(),
    nameEn: text('name_en').notNull(),
    nameRu: text('name_ru'),
    category: fuelCategoryEnum('category').notNull(),
    octaneRating: integer('octane_rating'),
    biofuelPercentage: integer('biofuel_percentage'),
    unit: fuelUnitEnum('unit').notNull(),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [uniqueIndex('fuel_types_code_unique').on(table.code)],
);

export const fuelAliases = pgTable(
  'fuel_aliases',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    dataSourceId: uuid('data_source_id').references(() => dataSources.id, {
      onDelete: 'cascade',
    }),
    countryId: uuid('country_id').references(() => countries.id, {
      onDelete: 'cascade',
    }),
    externalCode: text('external_code'),
    externalName: text('external_name').notNull(),
    fuelTypeId: uuid('fuel_type_id')
      .notNull()
      .references(() => fuelTypes.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index('fuel_aliases_fuel_type_id_idx').on(table.fuelTypeId),
    index('fuel_aliases_data_source_id_idx').on(table.dataSourceId),
    index('fuel_aliases_country_id_idx').on(table.countryId),
  ],
);

export const stationFuels = pgTable(
  'station_fuels',
  {
    stationId: uuid('station_id')
      .notNull()
      .references(() => stations.id, { onDelete: 'cascade' }),
    fuelTypeId: uuid('fuel_type_id')
      .notNull()
      .references(() => fuelTypes.id, { onDelete: 'cascade' }),
    isAvailable: boolean('is_available').notNull().default(true),
    firstSeenAt: timestamp('first_seen_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex('station_fuels_station_fuel_unique').on(
      table.stationId,
      table.fuelTypeId,
    ),
  ],
);
