import { drizzle } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import postgres from 'postgres';
import * as schema from '../schema/index';
import {
  SPAIN_FUEL_ALIASES,
  SPAIN_DEFAULT_API_URL,
  SPAIN_PROVIDER_CODE,
} from '../../modules/ingestion/providers/spain/spain.constants';

export async function seedSpainSource(connectionString: string) {
  const client = postgres(connectionString, { max: 1 });
  const db = drizzle(client, { schema });

  try {
    const spain = await db.query.countries.findFirst({
      where: eq(schema.countries.iso2, 'ES'),
    });
    if (!spain) {
      throw new Error('Spain not found. Run reference seed first.');
    }

    const [source] = await db
      .insert(schema.dataSources)
      .values({
        code: SPAIN_PROVIDER_CODE,
        name: 'Spain Official Fuel Prices (MITECO ServiciosRESTCarburantes)',
        type: 'official',
        countryId: spain.id,
        baseUrl: SPAIN_DEFAULT_API_URL,
        isActive: true,
        trustWeight: 90,
      })
      .onConflictDoUpdate({
        target: schema.dataSources.code,
        set: {
          name: 'Spain Official Fuel Prices (MITECO ServiciosRESTCarburantes)',
          baseUrl: SPAIN_DEFAULT_API_URL,
          isActive: true,
          trustWeight: 90,
          updatedAt: new Date(),
        },
      })
      .returning();

    const fuelTypes = await db.select().from(schema.fuelTypes);
    const fuelByCode = new Map(fuelTypes.map((f) => [f.code, f.id]));

    for (const alias of SPAIN_FUEL_ALIASES) {
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
        countryId: spain.id,
        externalName: alias.externalName,
        fuelTypeId,
      });
    }

    console.log(
      `Spain source seed complete: ${SPAIN_PROVIDER_CODE}, ${SPAIN_FUEL_ALIASES.length} fuel aliases`,
    );
  } finally {
    await client.end();
  }
}
