import { drizzle } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import postgres from 'postgres';
import * as schema from '../schema/index';
import {
  GERMANY_DEFAULT_BASE_URL,
  GERMANY_FUEL_ALIASES,
  GERMANY_PROVIDER_CODE,
} from '../../modules/ingestion/providers/germany/germany.constants';

export async function seedGermanySource(connectionString: string) {
  const client = postgres(connectionString, { max: 1 });
  const db = drizzle(client, { schema });

  try {
    const germany = await db.query.countries.findFirst({
      where: eq(schema.countries.iso2, 'DE'),
    });
    if (!germany) {
      throw new Error('Germany not found. Run reference seed first.');
    }

    const [source] = await db
      .insert(schema.dataSources)
      .values({
        code: GERMANY_PROVIDER_CODE,
        name: 'Tankerkönig / MTS-K Germany',
        type: 'third_party',
        countryId: germany.id,
        baseUrl: GERMANY_DEFAULT_BASE_URL,
        isActive: true,
        trustWeight: 85,
      })
      .onConflictDoUpdate({
        target: schema.dataSources.code,
        set: {
          name: 'Tankerkönig / MTS-K Germany',
          type: 'third_party',
          baseUrl: GERMANY_DEFAULT_BASE_URL,
          isActive: true,
          trustWeight: 85,
          updatedAt: new Date(),
        },
      })
      .returning();

    const fuelTypes = await db.select().from(schema.fuelTypes);
    const fuelByCode = new Map(fuelTypes.map((f) => [f.code, f.id]));

    for (const alias of GERMANY_FUEL_ALIASES) {
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
        countryId: germany.id,
        externalName: alias.externalName,
        fuelTypeId,
      });
    }

    console.log(
      `Germany source seed complete: ${GERMANY_PROVIDER_CODE}, ${GERMANY_FUEL_ALIASES.length} fuel aliases`,
    );
  } finally {
    await client.end();
  }
}
