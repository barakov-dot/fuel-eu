import {
  boolean,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { countries } from './countries';
import { dataSourceTypeEnum } from './enums';

export const dataSources = pgTable(
  'data_sources',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    code: text('code').notNull(),
    name: text('name').notNull(),
    type: dataSourceTypeEnum('type').notNull(),
    countryId: uuid('country_id').references(() => countries.id, {
      onDelete: 'set null',
    }),
    baseUrl: text('base_url'),
    isActive: boolean('is_active').notNull().default(true),
    trustWeight: integer('trust_weight').notNull().default(50),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [uniqueIndex('data_sources_code_unique').on(table.code)],
);
