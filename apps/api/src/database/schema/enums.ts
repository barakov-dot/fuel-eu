import { pgEnum } from 'drizzle-orm/pg-core';

export const dataSourceTypeEnum = pgEnum('data_source_type', [
  'official',
  'commercial',
  'fuel_chain',
  'third_party',
  'crowdsourced',
  'manual',
]);

export const fuelCategoryEnum = pgEnum('fuel_category', [
  'gasoline',
  'diesel',
  'gas',
  'hydrogen',
  'electric',
  'other',
]);

export const fuelUnitEnum = pgEnum('fuel_unit', ['liter', 'kilogram', 'kwh']);

export const ingestionRunStatusEnum = pgEnum('ingestion_run_status', [
  'running',
  'succeeded',
  'partially_succeeded',
  'failed',
]);

export const priceServiceModeEnum = pgEnum('price_service_mode', [
  'self',
  'served',
  'unknown',
]);
