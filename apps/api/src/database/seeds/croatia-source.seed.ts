import { drizzle } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import postgres from 'postgres';
import * as schema from '../schema/index';
import {
  CROATIA_FUEL_ALIASES,
  CROATIA_OPEN_DATA_PAGE,
  CROATIA_PROVIDER_CODE,
} from '../../modules/ingestion/providers/croatia/croatia.constants';

export async function seedCroatiaSource(connectionString: string) {
  const client = postgres(connectionString, { max: 1 });
  const db = drizzle(client, { schema });

  try {
    const croatia = await db.query.countries.findFirst({
      where: eq(schema.countries.iso2, 'HR'),
    });
    if (!croatia) {
      throw new Error('Croatia not found. Run reference seed first.');
    }

    const [source] = await db
      .insert(schema.dataSources)
      .values({
        code: CROATIA_PROVIDER_CODE,
        name: 'Ministry of Economy fuel price monitoring (Mzoe-gor)',
        type: 'official',
        countryId: croatia.id,
        baseUrl: CROATIA_OPEN_DATA_PAGE,
        isActive: true,
        trustWeight: 90,
      })
      .onConflictDoUpdate({
        target: schema.dataSources.code,
        set: {
          name: 'Ministry of Economy fuel price monitoring (Mzoe-gor)',
          baseUrl: CROATIA_OPEN_DATA_PAGE,
          isActive: true,
          trustWeight: 90,
          updatedAt: new Date(),
        },
      })
      .returning();

    const fuelTypes = await db.select().from(schema.fuelTypes);
    const fuelByCode = new Map(fuelTypes.map((f) => [f.code, f.id]));

    for (const alias of CROATIA_FUEL_ALIASES) {
      const fuelTypeId = fuelByCode.get(alias.fuelCode);
      if (!fuelTypeId) {
        throw new Error(`Fuel type not found: ${alias.fuelCode}`);
      }

      const existing = await db.query.fuelAliases.findFirst({
        where: eq(schema.fuelAliases.externalName, alias.externalName),
      });

      if (existing && existing.dataSourceId === source.id) {
        continue;
      }

      await db.insert(schema.fuelAliases).values({
        dataSourceId: source.id,
        countryId: croatia.id,
        externalName: alias.externalName,
        fuelTypeId,
      });
    }

    console.log(
      `Croatia source seed complete: ${CROATIA_PROVIDER_CODE}, ${CROATIA_FUEL_ALIASES.length} fuel aliases`,
    );
  } finally {
    await client.end();
  }
}
