import { drizzle } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import postgres from 'postgres';
import * as schema from '../schema/index';
import {
  ITALY_FUEL_ALIASES,
  ITALY_OPEN_DATA_PAGE,
  ITALY_PROVIDER_CODE,
} from '../../modules/ingestion/providers/italy/italy.constants';

export async function seedItalySource(connectionString: string) {
  const client = postgres(connectionString, { max: 1 });
  const db = drizzle(client, { schema });

  try {
    const italy = await db.query.countries.findFirst({
      where: eq(schema.countries.iso2, 'IT'),
    });
    if (!italy) {
      throw new Error('Italy not found. Run reference seed first.');
    }

    const [source] = await db
      .insert(schema.dataSources)
      .values({
        code: ITALY_PROVIDER_CODE,
        name: 'MIMIT Fuel Prices Italy',
        type: 'official',
        countryId: italy.id,
        baseUrl: ITALY_OPEN_DATA_PAGE,
        isActive: true,
        trustWeight: 90,
      })
      .onConflictDoUpdate({
        target: schema.dataSources.code,
        set: {
          name: 'MIMIT Fuel Prices Italy',
          baseUrl: ITALY_OPEN_DATA_PAGE,
          isActive: true,
          trustWeight: 90,
          updatedAt: new Date(),
        },
      })
      .returning();

    const fuelTypes = await db.select().from(schema.fuelTypes);
    const fuelByCode = new Map(fuelTypes.map((f) => [f.code, f.id]));

    for (const alias of ITALY_FUEL_ALIASES) {
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
        countryId: italy.id,
        externalName: alias.externalName,
        fuelTypeId,
      });
    }

    console.log(
      `Italy source seed complete: ${ITALY_PROVIDER_CODE}, ${ITALY_FUEL_ALIASES.length} fuel aliases`,
    );
  } finally {
    await client.end();
  }
}
