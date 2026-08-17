import { drizzle } from 'drizzle-orm/postgres-js';
import { eq, sql } from 'drizzle-orm';
import postgres from 'postgres';
import { wgs84Point } from '../geometry';
import * as schema from '../schema/index';
import { DEV_IDS } from './dev-data';

export async function seedDevFixtures(connectionString: string) {
  await clearDevFixtures(connectionString);

  const client = postgres(connectionString, { max: 1 });
  const db = drizzle(client, { schema });

  try {
    const finland = await db.query.countries.findFirst({
      where: eq(schema.countries.iso2, 'FI'),
    });
    if (!finland) {
      throw new Error(
        'Finland not found. Run reference seed (pnpm db:seed) first.',
      );
    }

    const eur = await db.query.currencies.findFirst({
      where: eq(schema.currencies.code, 'EUR'),
    });
    const sek = await db.query.currencies.findFirst({
      where: eq(schema.currencies.code, 'SEK'),
    });
    if (!eur || !sek) {
      throw new Error(
        'EUR/SEK currencies not found. Run reference seed (pnpm db:seed) first.',
      );
    }

    const fuelE10 = await db.query.fuelTypes.findFirst({
      where: eq(schema.fuelTypes.code, 'e10'),
    });
    const fuelDiesel = await db.query.fuelTypes.findFirst({
      where: eq(schema.fuelTypes.code, 'diesel'),
    });
    const fuelSp95 = await db.query.fuelTypes.findFirst({
      where: eq(schema.fuelTypes.code, 'sp95'),
    });

    if (!fuelE10 || !fuelDiesel || !fuelSp95) {
      throw new Error(
        'Canonical fuel types not found. Run reference seed first.',
      );
    }

    await db
      .insert(schema.dataSources)
      .values([
        {
          id: DEV_IDS.sourceOfficialFi,
          code: 'fi-official-dev',
          name: 'Finland Official (Dev Fixture)',
          type: 'official',
          countryId: finland.id,
          trustWeight: 90,
        },
        {
          id: DEV_IDS.sourceCommercialFi,
          code: 'fi-commercial-dev',
          name: 'Finland Commercial (Dev Fixture)',
          type: 'commercial',
          countryId: finland.id,
          trustWeight: 70,
        },
      ])
      .onConflictDoNothing({ target: schema.dataSources.code });

    await db
      .insert(schema.stations)
      .values([
        {
          id: DEV_IDS.stationHelsinkiNeste,
          countryId: finland.id,
          brand: 'Neste',
          name: 'Neste Helsinki Kamppi',
          addressLine: 'Mannerheimintie 20',
          postalCode: '00100',
          city: 'Helsinki',
          location: wgs84Point(24.935, 60.169),
          isActive: true,
        },
        {
          id: DEV_IDS.stationHelsinkiShell,
          countryId: finland.id,
          brand: 'Shell',
          name: 'Shell Helsinki Sörnäinen',
          addressLine: 'Hämeentie 19',
          postalCode: '00500',
          city: 'Helsinki',
          location: wgs84Point(24.953, 60.186),
          isActive: true,
        },
        {
          id: DEV_IDS.stationEspooTeboil,
          countryId: finland.id,
          brand: 'Teboil',
          name: 'Teboil Espoo Tapiola',
          addressLine: 'Merituulentie 36',
          postalCode: '02100',
          city: 'Espoo',
          location: wgs84Point(24.809, 60.176),
          isActive: true,
        },
        {
          id: DEV_IDS.stationHelsinkiNoPrice,
          countryId: finland.id,
          brand: 'Unbranded',
          name: 'Helsinki No Price Station',
          addressLine: 'Eteläesplanadi 2',
          postalCode: '00130',
          city: 'Helsinki',
          location: wgs84Point(24.945, 60.1675),
          isActive: true,
        },
        {
          id: DEV_IDS.stationPorvooOutOfRange,
          countryId: finland.id,
          brand: 'ABC',
          name: 'ABC Porvoo',
          addressLine: 'Taidetehtaankatu 1',
          postalCode: '06100',
          city: 'Porvoo',
          location: wgs84Point(25.665, 60.393),
          isActive: true,
        },
        {
          id: DEV_IDS.stationHelsinkiBudget,
          countryId: finland.id,
          brand: 'Budget',
          name: 'Budget Helsinki Keskusta',
          addressLine: 'Keskuskatu 1',
          postalCode: '00100',
          city: 'Helsinki',
          location: wgs84Point(24.941, 60.1705),
          isActive: true,
        },
        {
          id: DEV_IDS.stationHelsinkiSekPrice,
          countryId: finland.id,
          brand: 'Nordic',
          name: 'Nordic Helsinki SEK Fixture',
          addressLine: 'Aleksanterinkatu 52',
          postalCode: '00100',
          city: 'Helsinki',
          location: wgs84Point(24.948, 60.1695),
          isActive: true,
        },
      ])
      .onConflictDoNothing();

    await db
      .insert(schema.stationSourceMappings)
      .values([
        {
          id: DEV_IDS.mappingNesteOfficial,
          stationId: DEV_IDS.stationHelsinkiNeste,
          dataSourceId: DEV_IDS.sourceOfficialFi,
          externalStationId: 'FI-OFF-1001',
          externalName: 'Neste Kamppi',
          externalBrand: 'Neste',
        },
        {
          id: DEV_IDS.mappingShellCommercial,
          stationId: DEV_IDS.stationHelsinkiShell,
          dataSourceId: DEV_IDS.sourceCommercialFi,
          externalStationId: 'FI-COM-2001',
          externalName: 'Shell Sörnäinen',
          externalBrand: 'Shell',
        },
        {
          id: DEV_IDS.mappingTeboilOfficial,
          stationId: DEV_IDS.stationEspooTeboil,
          dataSourceId: DEV_IDS.sourceOfficialFi,
          externalStationId: 'FI-OFF-1002',
          externalName: 'Teboil Tapiola',
          externalBrand: 'Teboil',
        },
        {
          id: DEV_IDS.mappingBudgetOfficial,
          stationId: DEV_IDS.stationHelsinkiBudget,
          dataSourceId: DEV_IDS.sourceOfficialFi,
          externalStationId: 'FI-OFF-1003',
          externalName: 'Budget Keskusta',
          externalBrand: 'Budget',
        },
        {
          id: DEV_IDS.mappingSekOfficial,
          stationId: DEV_IDS.stationHelsinkiSekPrice,
          dataSourceId: DEV_IDS.sourceOfficialFi,
          externalStationId: 'FI-OFF-1004',
          externalName: 'Nordic SEK',
          externalBrand: 'Nordic',
        },
      ])
      .onConflictDoNothing();

    for (const [stationId, fuelTypeId] of [
      [DEV_IDS.stationHelsinkiNeste, fuelE10.id],
      [DEV_IDS.stationHelsinkiNeste, fuelDiesel.id],
      [DEV_IDS.stationHelsinkiNeste, fuelSp95.id],
      [DEV_IDS.stationHelsinkiShell, fuelE10.id],
      [DEV_IDS.stationHelsinkiShell, fuelDiesel.id],
      [DEV_IDS.stationEspooTeboil, fuelE10.id],
      [DEV_IDS.stationEspooTeboil, fuelDiesel.id],
      [DEV_IDS.stationHelsinkiNoPrice, fuelE10.id],
      [DEV_IDS.stationPorvooOutOfRange, fuelE10.id],
      [DEV_IDS.stationHelsinkiBudget, fuelE10.id],
      [DEV_IDS.stationHelsinkiSekPrice, fuelE10.id],
    ] as const) {
      await db
        .insert(schema.stationFuels)
        .values({ stationId, fuelTypeId, isAvailable: true })
        .onConflictDoNothing();
    }

    const observations = [
      {
        stationId: DEV_IDS.stationHelsinkiNeste,
        fuelTypeId: fuelE10.id,
        dataSourceId: DEV_IDS.sourceOfficialFi,
        stationSourceMappingId: DEV_IDS.mappingNesteOfficial,
        price: '1.8990',
        currencyId: eur.id,
        observedAt: new Date('2026-08-01T10:00:00.000Z'),
      },
      {
        stationId: DEV_IDS.stationHelsinkiNeste,
        fuelTypeId: fuelE10.id,
        dataSourceId: DEV_IDS.sourceOfficialFi,
        stationSourceMappingId: DEV_IDS.mappingNesteOfficial,
        price: '1.9190',
        currencyId: eur.id,
        observedAt: new Date('2026-08-10T10:00:00.000Z'),
      },
      {
        stationId: DEV_IDS.stationHelsinkiNeste,
        fuelTypeId: fuelE10.id,
        dataSourceId: DEV_IDS.sourceCommercialFi,
        price: '1.9290',
        currencyId: eur.id,
        observedAt: new Date('2026-08-15T10:00:00.000Z'),
      },
      {
        stationId: DEV_IDS.stationHelsinkiNeste,
        fuelTypeId: fuelDiesel.id,
        dataSourceId: DEV_IDS.sourceOfficialFi,
        stationSourceMappingId: DEV_IDS.mappingNesteOfficial,
        price: '1.7490',
        currencyId: eur.id,
        observedAt: new Date('2026-08-01T10:00:00.000Z'),
      },
      {
        stationId: DEV_IDS.stationHelsinkiNeste,
        fuelTypeId: fuelDiesel.id,
        dataSourceId: DEV_IDS.sourceOfficialFi,
        stationSourceMappingId: DEV_IDS.mappingNesteOfficial,
        price: '1.7690',
        currencyId: eur.id,
        observedAt: new Date('2026-08-15T10:00:00.000Z'),
      },
      {
        stationId: DEV_IDS.stationHelsinkiNeste,
        fuelTypeId: fuelSp95.id,
        dataSourceId: DEV_IDS.sourceOfficialFi,
        stationSourceMappingId: DEV_IDS.mappingNesteOfficial,
        price: '1.9590',
        currencyId: eur.id,
        observedAt: new Date('2026-08-15T10:00:00.000Z'),
      },
      {
        stationId: DEV_IDS.stationHelsinkiShell,
        fuelTypeId: fuelE10.id,
        dataSourceId: DEV_IDS.sourceCommercialFi,
        stationSourceMappingId: DEV_IDS.mappingShellCommercial,
        price: '1.9090',
        currencyId: eur.id,
        observedAt: new Date('2026-08-12T10:00:00.000Z'),
      },
      {
        stationId: DEV_IDS.stationHelsinkiShell,
        fuelTypeId: fuelDiesel.id,
        dataSourceId: DEV_IDS.sourceCommercialFi,
        stationSourceMappingId: DEV_IDS.mappingShellCommercial,
        price: '1.7890',
        currencyId: eur.id,
        observedAt: new Date('2026-08-12T10:00:00.000Z'),
      },
      {
        stationId: DEV_IDS.stationEspooTeboil,
        fuelTypeId: fuelE10.id,
        dataSourceId: DEV_IDS.sourceOfficialFi,
        stationSourceMappingId: DEV_IDS.mappingTeboilOfficial,
        price: '1.8890',
        currencyId: eur.id,
        observedAt: new Date('2026-08-14T10:00:00.000Z'),
      },
      {
        stationId: DEV_IDS.stationEspooTeboil,
        fuelTypeId: fuelDiesel.id,
        dataSourceId: DEV_IDS.sourceOfficialFi,
        stationSourceMappingId: DEV_IDS.mappingTeboilOfficial,
        price: '1.7390',
        currencyId: eur.id,
        observedAt: new Date('2026-08-14T10:00:00.000Z'),
      },
      {
        id: DEV_IDS.obsNesteE10TieA,
        stationId: DEV_IDS.stationHelsinkiNeste,
        fuelTypeId: fuelE10.id,
        dataSourceId: DEV_IDS.sourceOfficialFi,
        stationSourceMappingId: DEV_IDS.mappingNesteOfficial,
        price: '1.9390',
        currencyId: eur.id,
        observedAt: new Date('2026-08-17T10:00:00.000Z'),
        receivedAt: new Date('2026-08-17T10:00:01.000Z'),
      },
      {
        id: DEV_IDS.obsNesteE10TieB,
        stationId: DEV_IDS.stationHelsinkiNeste,
        fuelTypeId: fuelE10.id,
        dataSourceId: DEV_IDS.sourceOfficialFi,
        stationSourceMappingId: DEV_IDS.mappingNesteOfficial,
        price: '1.9490',
        currencyId: eur.id,
        observedAt: new Date('2026-08-17T10:00:00.000Z'),
        receivedAt: new Date('2026-08-17T10:00:02.000Z'),
      },
      {
        stationId: DEV_IDS.stationPorvooOutOfRange,
        fuelTypeId: fuelE10.id,
        dataSourceId: DEV_IDS.sourceOfficialFi,
        price: '1.7990',
        currencyId: eur.id,
        observedAt: new Date('2026-08-14T10:00:00.000Z'),
      },
      {
        stationId: DEV_IDS.stationHelsinkiBudget,
        fuelTypeId: fuelE10.id,
        dataSourceId: DEV_IDS.sourceOfficialFi,
        stationSourceMappingId: DEV_IDS.mappingBudgetOfficial,
        price: '1.8790',
        currencyId: eur.id,
        observedAt: new Date('2026-08-14T10:00:00.000Z'),
      },
      {
        stationId: DEV_IDS.stationHelsinkiSekPrice,
        fuelTypeId: fuelE10.id,
        dataSourceId: DEV_IDS.sourceOfficialFi,
        stationSourceMappingId: DEV_IDS.mappingSekOfficial,
        price: '19.9000',
        currencyId: sek.id,
        observedAt: new Date('2026-08-14T10:00:00.000Z'),
      },
    ];

    for (const obs of observations) {
      await db.insert(schema.fuelPriceObservations).values(obs);
    }

    await db
      .insert(schema.schemaMetadata)
      .values({
        key: 'dev_seed_applied_at',
        value: new Date().toISOString(),
      })
      .onConflictDoUpdate({
        target: schema.schemaMetadata.key,
        set: { value: new Date().toISOString(), updatedAt: new Date() },
      });

    const [{ count }] = await db.execute<{ count: string }>(sql`
      SELECT COUNT(*)::text AS count FROM fuel_price_observations
    `);

    console.log(
      `Dev seed complete: 7 stations, 2 sources, ${count} price observations`,
    );
  } finally {
    await client.end();
  }
}

export async function clearDevFixtures(connectionString: string) {
  const client = postgres(connectionString, { max: 1 });
  const db = drizzle(client, { schema });

  try {
    await db.delete(schema.fuelPriceObservations);
    await db.delete(schema.stationFuels);
    await db.delete(schema.stationSourceMappings);
    await db.delete(schema.stations);
    await db
      .delete(schema.dataSources)
      .where(
        sql`${schema.dataSources.code} IN ('fi-official-dev', 'fi-commercial-dev')`,
      );
  } finally {
    await client.end();
  }
}
