import { numeric, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { currencies } from './currencies';
import { fuelTypes } from './fuels';
import { users } from './users';

export const userPreferences = pgTable('user_preferences', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  preferredFuelTypeId: uuid('preferred_fuel_type_id').references(
    () => fuelTypes.id,
    { onDelete: 'set null' },
  ),
  preferredCurrencyId: uuid('preferred_currency_id').references(
    () => currencies.id,
    { onDelete: 'set null' },
  ),
  defaultRefuelLiters: numeric('default_refuel_liters', {
    precision: 8,
    scale: 2,
  }),
  vehicleConsumptionLPer100Km: numeric('vehicle_consumption_l_per_100km', {
    precision: 6,
    scale: 2,
  }),
  locale: text('locale').notNull().default('en'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});
