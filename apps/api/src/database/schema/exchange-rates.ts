import {
  date,
  index,
  numeric,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { currencies } from './currencies';
import { dataSources } from './data-sources';

/** ECB-style FX rates; numeric(18,8) for high-precision conversion. */
export const exchangeRateNumeric = numeric('rate', {
  precision: 18,
  scale: 8,
});

export const exchangeRates = pgTable(
  'exchange_rates',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    baseCurrencyId: uuid('base_currency_id')
      .notNull()
      .references(() => currencies.id, { onDelete: 'restrict' }),
    quoteCurrencyId: uuid('quote_currency_id')
      .notNull()
      .references(() => currencies.id, { onDelete: 'restrict' }),
    rate: exchangeRateNumeric.notNull(),
    rateDate: date('rate_date').notNull(),
    dataSourceId: uuid('data_source_id').references(() => dataSources.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex('exchange_rates_base_quote_date_unique').on(
      table.baseCurrencyId,
      table.quoteCurrencyId,
      table.rateDate,
    ),
    index('exchange_rates_rate_date_idx').on(table.rateDate),
  ],
);
