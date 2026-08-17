import {
  boolean,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export const countries = pgTable(
  'countries',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    iso2: text('iso2').notNull(),
    iso3: text('iso3').notNull(),
    nameEn: text('name_en').notNull(),
    nameRu: text('name_ru'),
    isEuMember: boolean('is_eu_member').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex('countries_iso2_unique').on(table.iso2),
    uniqueIndex('countries_iso3_unique').on(table.iso3),
  ],
);
