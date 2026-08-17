import { relations } from 'drizzle-orm';
import { authIdentities } from './auth-identities';
import { authSessions } from './auth-sessions';
import { countries } from './countries';
import { countryCurrencies, currencies } from './currencies';
import { dataSources } from './data-sources';
import { exchangeRates } from './exchange-rates';
import { fuelAliases, fuelTypes, stationFuels } from './fuels';
import { ingestionErrors, ingestionRuns } from './ingestion';
import { fuelPriceObservations } from './prices';
import { stationSourceMappings, stations } from './stations';
import {
  userPriceReports,
  userPriceReportVotes,
  userReputation,
  userReputationEvents,
} from './crowdsourcing';
import { userFavorites } from './user-favorites';
import { userPreferences } from './user-preferences';
import { users } from './users';

export const countriesRelations = relations(countries, ({ many }) => ({
  stations: many(stations),
  dataSources: many(dataSources),
  countryCurrencies: many(countryCurrencies),
  fuelAliases: many(fuelAliases),
}));

export const currenciesRelations = relations(currencies, ({ many }) => ({
  countryCurrencies: many(countryCurrencies),
  priceObservations: many(fuelPriceObservations),
  exchangeRatesBase: many(exchangeRates, { relationName: 'baseCurrency' }),
  exchangeRatesQuote: many(exchangeRates, { relationName: 'quoteCurrency' }),
}));

export const countryCurrenciesRelations = relations(
  countryCurrencies,
  ({ one }) => ({
    country: one(countries, {
      fields: [countryCurrencies.countryId],
      references: [countries.id],
    }),
    currency: one(currencies, {
      fields: [countryCurrencies.currencyId],
      references: [currencies.id],
    }),
  }),
);

export const dataSourcesRelations = relations(dataSources, ({ one, many }) => ({
  country: one(countries, {
    fields: [dataSources.countryId],
    references: [countries.id],
  }),
  stationMappings: many(stationSourceMappings),
  priceObservations: many(fuelPriceObservations),
  fuelAliases: many(fuelAliases),
  exchangeRates: many(exchangeRates),
  ingestionRuns: many(ingestionRuns),
}));

export const ingestionRunsRelations = relations(
  ingestionRuns,
  ({ one, many }) => ({
    dataSource: one(dataSources, {
      fields: [ingestionRuns.dataSourceId],
      references: [dataSources.id],
    }),
    errors: many(ingestionErrors),
  }),
);

export const ingestionErrorsRelations = relations(
  ingestionErrors,
  ({ one }) => ({
    ingestionRun: one(ingestionRuns, {
      fields: [ingestionErrors.ingestionRunId],
      references: [ingestionRuns.id],
    }),
  }),
);

export const stationsRelations = relations(stations, ({ one, many }) => ({
  country: one(countries, {
    fields: [stations.countryId],
    references: [countries.id],
  }),
  sourceMappings: many(stationSourceMappings),
  stationFuels: many(stationFuels),
  priceObservations: many(fuelPriceObservations),
}));

export const stationSourceMappingsRelations = relations(
  stationSourceMappings,
  ({ one, many }) => ({
    station: one(stations, {
      fields: [stationSourceMappings.stationId],
      references: [stations.id],
    }),
    dataSource: one(dataSources, {
      fields: [stationSourceMappings.dataSourceId],
      references: [dataSources.id],
    }),
    priceObservations: many(fuelPriceObservations),
  }),
);

export const fuelTypesRelations = relations(fuelTypes, ({ many }) => ({
  aliases: many(fuelAliases),
  stationFuels: many(stationFuels),
  priceObservations: many(fuelPriceObservations),
}));

export const fuelAliasesRelations = relations(fuelAliases, ({ one }) => ({
  fuelType: one(fuelTypes, {
    fields: [fuelAliases.fuelTypeId],
    references: [fuelTypes.id],
  }),
  dataSource: one(dataSources, {
    fields: [fuelAliases.dataSourceId],
    references: [dataSources.id],
  }),
  country: one(countries, {
    fields: [fuelAliases.countryId],
    references: [countries.id],
  }),
}));

export const stationFuelsRelations = relations(stationFuels, ({ one }) => ({
  station: one(stations, {
    fields: [stationFuels.stationId],
    references: [stations.id],
  }),
  fuelType: one(fuelTypes, {
    fields: [stationFuels.fuelTypeId],
    references: [fuelTypes.id],
  }),
}));

export const fuelPriceObservationsRelations = relations(
  fuelPriceObservations,
  ({ one }) => ({
    station: one(stations, {
      fields: [fuelPriceObservations.stationId],
      references: [stations.id],
    }),
    fuelType: one(fuelTypes, {
      fields: [fuelPriceObservations.fuelTypeId],
      references: [fuelTypes.id],
    }),
    dataSource: one(dataSources, {
      fields: [fuelPriceObservations.dataSourceId],
      references: [dataSources.id],
    }),
    stationSourceMapping: one(stationSourceMappings, {
      fields: [fuelPriceObservations.stationSourceMappingId],
      references: [stationSourceMappings.id],
    }),
    currency: one(currencies, {
      fields: [fuelPriceObservations.currencyId],
      references: [currencies.id],
    }),
  }),
);

export const exchangeRatesRelations = relations(exchangeRates, ({ one }) => ({
  baseCurrency: one(currencies, {
    fields: [exchangeRates.baseCurrencyId],
    references: [currencies.id],
    relationName: 'baseCurrency',
  }),
  quoteCurrency: one(currencies, {
    fields: [exchangeRates.quoteCurrencyId],
    references: [currencies.id],
    relationName: 'quoteCurrency',
  }),
  dataSource: one(dataSources, {
    fields: [exchangeRates.dataSourceId],
    references: [dataSources.id],
  }),
}));

export const usersRelations = relations(users, ({ many, one }) => ({
  sessions: many(authSessions),
  identities: many(authIdentities),
  preferences: one(userPreferences),
  favorites: many(userFavorites),
  priceReports: many(userPriceReports),
  reportVotes: many(userPriceReportVotes),
  reputationEvents: many(userReputationEvents),
  reputation: one(userReputation),
}));

export const authSessionsRelations = relations(authSessions, ({ one }) => ({
  user: one(users, {
    fields: [authSessions.userId],
    references: [users.id],
  }),
}));

export const authIdentitiesRelations = relations(authIdentities, ({ one }) => ({
  user: one(users, {
    fields: [authIdentities.userId],
    references: [users.id],
  }),
}));

export const userPreferencesRelations = relations(
  userPreferences,
  ({ one }) => ({
    user: one(users, {
      fields: [userPreferences.userId],
      references: [users.id],
    }),
    preferredFuelType: one(fuelTypes, {
      fields: [userPreferences.preferredFuelTypeId],
      references: [fuelTypes.id],
    }),
    preferredCurrency: one(currencies, {
      fields: [userPreferences.preferredCurrencyId],
      references: [currencies.id],
    }),
  }),
);

export const userFavoritesRelations = relations(userFavorites, ({ one }) => ({
  user: one(users, {
    fields: [userFavorites.userId],
    references: [users.id],
  }),
  station: one(stations, {
    fields: [userFavorites.stationId],
    references: [stations.id],
  }),
}));

export const userPriceReportsRelations = relations(
  userPriceReports,
  ({ one, many }) => ({
    user: one(users, {
      fields: [userPriceReports.userId],
      references: [users.id],
    }),
    station: one(stations, {
      fields: [userPriceReports.stationId],
      references: [stations.id],
    }),
    fuelType: one(fuelTypes, {
      fields: [userPriceReports.fuelTypeId],
      references: [fuelTypes.id],
    }),
    currency: one(currencies, {
      fields: [userPriceReports.currencyId],
      references: [currencies.id],
    }),
    sourceObservation: one(fuelPriceObservations, {
      fields: [userPriceReports.sourceObservationId],
      references: [fuelPriceObservations.id],
    }),
    votes: many(userPriceReportVotes),
  }),
);

export const userPriceReportVotesRelations = relations(
  userPriceReportVotes,
  ({ one }) => ({
    report: one(userPriceReports, {
      fields: [userPriceReportVotes.reportId],
      references: [userPriceReports.id],
    }),
    user: one(users, {
      fields: [userPriceReportVotes.userId],
      references: [users.id],
    }),
  }),
);

export const userReputationEventsRelations = relations(
  userReputationEvents,
  ({ one }) => ({
    user: one(users, {
      fields: [userReputationEvents.userId],
      references: [users.id],
    }),
    relatedReport: one(userPriceReports, {
      fields: [userReputationEvents.relatedReportId],
      references: [userPriceReports.id],
    }),
  }),
);

export const userReputationRelations = relations(userReputation, ({ one }) => ({
  user: one(users, {
    fields: [userReputation.userId],
    references: [users.id],
  }),
}));
