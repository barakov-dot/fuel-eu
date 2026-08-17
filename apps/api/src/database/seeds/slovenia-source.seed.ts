import { drizzle } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import postgres from 'postgres';
import * as schema from '../schema/index';
import {
  SLOVENIA_FUEL_ALIASES,
  SLOVENIA_OPEN_DATA_PAGE,
  SLOVENIA_PROVIDER_CODE,
} from '../../modules/ingestion/providers/slovenia/slovenia.constants';

export async function seedSloveniaSource(connectionString: string) {
  const client = postgres(connectionString, { max: 1 });
  const db = drizzle(client, { schema });

  try {
    const slovenia = await db.query.countries.findFirst({
      where: eq(schema.countries.iso2, 'SI'),
    });
    if (!slovenia) {
      throw new Error('Slovenia not found. Run reference seed first.');
    }

    const [source] = await db
      .insert(schema.dataSources)
      .values({
        code: SLOVENIA_PROVIDER_CODE,
        name: 'goriva.si / official Slovenian fuel prices',
        type: 'official',
        countryId: slovenia.id,
        baseUrl: SLOVENIA_OPEN_DATA_PAGE,
        isActive: true,
        trustWeight: 90,
      })
      .onConflictDoUpdate({
        target: schema.dataSources.code,
        set: {
          name: 'goriva.si / official Slovenian fuel prices',
          baseUrl: SLOVENIA_OPEN_DATA_PAGE,
          isActive: true,
          trustWeight: 90,
          updatedAt: new Date(),
        },
      })
      .returning();

    const fuelTypes = await db.select().from(schema.fuelTypes);
    const fuelByCode = new Map(fuelTypes.map((f) => [f.code, f.id]));

    for (const alias of SLOVENIA_FUEL_ALIASES) {
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
        countryId: slovenia.id,
        externalName: alias.externalName,
        fuelTypeId,
      });
    }

    console.log(
      `Slovenia source seed complete: ${SLOVENIA_PROVIDER_CODE}, ${SLOVENIA_FUEL_ALIASES.length} fuel aliases`,
    );
  } finally {
    await client.end();
  }
}
