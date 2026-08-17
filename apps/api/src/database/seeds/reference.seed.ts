import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../schema/index';
import {
  CANONICAL_FUEL_TYPES,
  COUNTRY_HISTORICAL_CURRENCIES,
  COUNTRY_PRIMARY_CURRENCY,
  EU27_COUNTRIES,
  EU_CURRENCIES,
} from './reference-data';
import { CROWDSOURCED_SOURCE } from './crowdsourced-source.seed';

const SCHEMA_VERSION = '2.0.0';

export async function seedReferenceData(connectionString: string) {
  const client = postgres(connectionString, { max: 1 });
  const db = drizzle(client, { schema });

  try {
    for (const country of EU27_COUNTRIES) {
      await db
        .insert(schema.countries)
        .values({
          iso2: country.iso2,
          iso3: country.iso3,
          nameEn: country.nameEn,
          nameRu: country.nameRu,
          isEuMember: true,
        })
        .onConflictDoNothing({ target: schema.countries.iso2 });
    }

    for (const currency of EU_CURRENCIES) {
      await db
        .insert(schema.currencies)
        .values({
          code: currency.code,
          name: currency.name,
          symbol: currency.symbol,
          decimalDigits: currency.decimalDigits,
        })
        .onConflictDoNothing({ target: schema.currencies.code });
    }

    const countryRows = await db.select().from(schema.countries);
    const currencyRows = await db.select().from(schema.currencies);

    const countryByIso2 = new Map(countryRows.map((c) => [c.iso2, c]));
    const currencyByCode = new Map(currencyRows.map((c) => [c.code, c]));

    for (const [iso2, currencyCode] of Object.entries(
      COUNTRY_PRIMARY_CURRENCY,
    )) {
      const country = countryByIso2.get(iso2);
      const currency = currencyByCode.get(currencyCode);
      if (!country || !currency) {
        throw new Error(
          `Missing country or currency for mapping: ${iso2} -> ${currencyCode}`,
        );
      }

      await db
        .insert(schema.countryCurrencies)
        .values({
          countryId: country.id,
          currencyId: currency.id,
          isPrimary: true,
        })
        .onConflictDoNothing();
    }

    for (const historical of COUNTRY_HISTORICAL_CURRENCIES) {
      const country = countryByIso2.get(historical.iso2);
      const currency = currencyByCode.get(historical.currencyCode);
      if (!country || !currency) {
        throw new Error(
          `Missing country or currency for historical mapping: ${historical.iso2}`,
        );
      }

      await db
        .insert(schema.countryCurrencies)
        .values({
          countryId: country.id,
          currencyId: currency.id,
          validFrom: historical.validFrom
            ? new Date(`${historical.validFrom}T00:00:00.000Z`)
            : null,
          validTo: new Date(`${historical.validTo}T23:59:59.999Z`),
          isPrimary: false,
        })
        .onConflictDoNothing();
    }

    for (const fuel of CANONICAL_FUEL_TYPES) {
      await db
        .insert(schema.fuelTypes)
        .values({
          code: fuel.code,
          nameEn: fuel.nameEn,
          nameRu: fuel.nameRu,
          category: fuel.category,
          octaneRating: fuel.octaneRating,
          biofuelPercentage: fuel.biofuelPercentage,
          unit: fuel.unit,
        })
        .onConflictDoNothing({ target: schema.fuelTypes.code });
    }

    await db
      .insert(schema.dataSources)
      .values({
        id: CROWDSOURCED_SOURCE.id,
        code: CROWDSOURCED_SOURCE.code,
        name: CROWDSOURCED_SOURCE.name,
        type: CROWDSOURCED_SOURCE.type,
        countryId: CROWDSOURCED_SOURCE.countryId,
        isActive: CROWDSOURCED_SOURCE.isActive,
        trustWeight: CROWDSOURCED_SOURCE.trustWeight,
      })
      .onConflictDoUpdate({
        target: schema.dataSources.code,
        set: {
          name: CROWDSOURCED_SOURCE.name,
          type: CROWDSOURCED_SOURCE.type,
          trustWeight: CROWDSOURCED_SOURCE.trustWeight,
          isActive: true,
          updatedAt: new Date(),
        },
      });

    await db
      .insert(schema.schemaMetadata)
      .values({
        key: 'schema_version',
        value: SCHEMA_VERSION,
      })
      .onConflictDoUpdate({
        target: schema.schemaMetadata.key,
        set: { value: SCHEMA_VERSION, updatedAt: new Date() },
      });

    await db
      .insert(schema.schemaMetadata)
      .values({
        key: 'reference_seed_applied_at',
        value: new Date().toISOString(),
      })
      .onConflictDoUpdate({
        target: schema.schemaMetadata.key,
        set: {
          value: new Date().toISOString(),
          updatedAt: new Date(),
        },
      });

    console.log(
      `Reference seed complete: ${EU27_COUNTRIES.length} countries, ${EU_CURRENCIES.length} currencies, ${CANONICAL_FUEL_TYPES.length} fuel types`,
    );
  } finally {
    await client.end();
  }
}

export async function clearReferenceData(connectionString: string) {
  const client = postgres(connectionString, { max: 1 });
  const db = drizzle(client, { schema });

  try {
    await db.delete(schema.fuelTypes);
    await db.delete(schema.countryCurrencies);
    await db.delete(schema.currencies);
    await db.delete(schema.countries);
  } finally {
    await client.end();
  }
}
