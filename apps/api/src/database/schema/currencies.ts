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

export const currencies = pgTable(
  'currencies',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    code: text('code').notNull(),
    name: text('name').notNull(),
    symbol: text('symbol'),
    decimalDigits: integer('decimal_digits').notNull().default(2),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [uniqueIndex('currencies_code_unique').on(table.code)],
);

export const countryCurrencies = pgTable(
  'country_currencies',
  {
    countryId: uuid('country_id')
      .notNull()
      .references(() => countries.id, { onDelete: 'cascade' }),
    currencyId: uuid('currency_id')
      .notNull()
      .references(() => currencies.id, { onDelete: 'restrict' }),
    validFrom: timestamp('valid_from', { withTimezone: true }),
    validTo: timestamp('valid_to', { withTimezone: true }),
    isPrimary: boolean('is_primary').notNull().default(true),
  },
  (table) => [
    uniqueIndex('country_currencies_country_currency_unique').on(
      table.countryId,
      table.currencyId,
    ),
  ],
);
