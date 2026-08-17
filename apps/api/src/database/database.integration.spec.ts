import { drizzle } from 'drizzle-orm/postgres-js';
import { eq, sql } from 'drizzle-orm';
import postgres from 'postgres';
import * as schema from './schema/index';
import { EU27_COUNTRIES } from './seeds/reference-data';
import { seedDevFixtures } from './seeds/dev.seed';
import { seedReferenceData } from './seeds/reference.seed';
import { DEV_IDS, PRIMARY_DEV_STATION_ID } from './seeds/dev-data';

const connectionString = process.env.DATABASE_URL;

const describeIfDb = connectionString ? describe : describe.skip;

describeIfDb('Database integration', () => {
  let client: ReturnType<typeof postgres>;

  beforeAll(async () => {
    client = postgres(connectionString!, { max: 5 });
    await seedReferenceData(connectionString!);
    await seedDevFixtures(connectionString!);
  });

  afterAll(async () => {
    await client.end();
  });

  it('seeds all 27 EU countries', async () => {
    const db = drizzle(client, { schema });
    const rows = await db.select().from(schema.countries);
    expect(rows.length).toBe(27);
    for (const expected of EU27_COUNTRIES) {
      expect(rows.some((r) => r.iso2 === expected.iso2)).toBe(true);
    }
  });

  it('enforces unique source station mapping constraint', async () => {
    const db = drizzle(client, { schema });
    await expect(
      db.insert(schema.stationSourceMappings).values({
        stationId: DEV_IDS.stationHelsinkiNeste,
        dataSourceId: DEV_IDS.sourceOfficialFi,
        externalStationId: 'FI-OFF-1001',
      }),
    ).rejects.toThrow();
  });

  it('preserves price decimal values accurately', async () => {
    const db = drizzle(client, { schema });
    const [row] = await db
      .select({ price: schema.fuelPriceObservations.price })
      .from(schema.fuelPriceObservations)
      .where(eq(schema.fuelPriceObservations.stationId, PRIMARY_DEV_STATION_ID))
      .limit(1);

    expect(String(row?.price)).toMatch(/^\d+\.\d{4}$/);
  });

  it('retains multiple historical observations', async () => {
    const db = drizzle(client, { schema });
    const fuelE10 = await db.query.fuelTypes.findFirst({
      where: eq(schema.fuelTypes.code, 'e10'),
    });

    const rows = await db
      .select()
      .from(schema.fuelPriceObservations)
      .where(
        sql`${schema.fuelPriceObservations.stationId} = ${PRIMARY_DEV_STATION_ID}
            AND ${schema.fuelPriceObservations.fuelTypeId} = ${fuelE10!.id}`,
      );

    expect(rows.length).toBe(5);
  });

  it('latest price query returns newest observation per fuel', async () => {
    const result = await client`
      SELECT DISTINCT ON (fuel_type_id) price::text, ft.code
      FROM fuel_price_observations o
      INNER JOIN fuel_types ft ON ft.id = o.fuel_type_id
      WHERE o.station_id = ${PRIMARY_DEV_STATION_ID}
      ORDER BY fuel_type_id, observed_at DESC, received_at DESC, o.id DESC
    `;

    const e10 = result.find((r) => r.code === 'e10');
    expect(e10?.price).toBe('1.9490');
  });

  it('Bulgaria primary currency is EUR with historical BGN', async () => {
    const db = drizzle(client, { schema });
    const bulgaria = await db.query.countries.findFirst({
      where: eq(schema.countries.iso2, 'BG'),
    });
    const mappings = await db
      .select({
        code: schema.currencies.code,
        isPrimary: schema.countryCurrencies.isPrimary,
        validTo: schema.countryCurrencies.validTo,
      })
      .from(schema.countryCurrencies)
      .innerJoin(
        schema.currencies,
        eq(schema.countryCurrencies.currencyId, schema.currencies.id),
      )
      .where(eq(schema.countryCurrencies.countryId, bulgaria!.id));

    const primary = mappings.find((m) => m.isPrimary);
    expect(primary?.code).toBe('EUR');

    const historicalBgn = mappings.find((m) => m.code === 'BGN');
    expect(historicalBgn?.validTo).not.toBeNull();
  });
});
