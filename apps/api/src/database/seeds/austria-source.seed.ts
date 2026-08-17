import { drizzle } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import postgres from 'postgres';
import * as schema from '../schema/index';
import {
  AUSTRIA_FUEL_ALIASES,
  AUSTRIA_DEFAULT_BASE_URL,
  AUSTRIA_PROVIDER_CODE,
} from '../../modules/ingestion/providers/austria/austria.constants';

export async function seedAustriaSource(connectionString: string) {
  const client = postgres(connectionString, { max: 1 });
  const db = drizzle(client, { schema });

  try {
    const austria = await db.query.countries.findFirst({
      where: eq(schema.countries.iso2, 'AT'),
    });
    if (!austria) {
      throw new Error('Austria not found. Run reference seed first.');
    }

    const [source] = await db
      .insert(schema.dataSources)
      .values({
        code: AUSTRIA_PROVIDER_CODE,
        name: 'E-Control Spritpreisrechner',
        type: 'official',
        countryId: austria.id,
        baseUrl: AUSTRIA_DEFAULT_BASE_URL,
        isActive: true,
        trustWeight: 90,
      })
      .onConflictDoUpdate({
        target: schema.dataSources.code,
        set: {
          name: 'E-Control Spritpreisrechner',
          baseUrl: AUSTRIA_DEFAULT_BASE_URL,
          isActive: true,
          trustWeight: 90,
          updatedAt: new Date(),
        },
      })
      .returning();

    const fuelTypes = await db.select().from(schema.fuelTypes);
    const fuelByCode = new Map(fuelTypes.map((f) => [f.code, f.id]));

    for (const alias of AUSTRIA_FUEL_ALIASES) {
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
        countryId: austria.id,
        externalName: alias.externalName,
        fuelTypeId,
      });
    }

    console.log(
      `Austria source seed complete: ${AUSTRIA_PROVIDER_CODE}, ${AUSTRIA_FUEL_ALIASES.length} fuel aliases`,
    );
  } finally {
    await client.end();
  }
}
