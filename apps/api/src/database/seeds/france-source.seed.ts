import { drizzle } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import postgres from 'postgres';
import * as schema from '../schema/index';
import {
  FRANCE_FUEL_ALIASES,
  FRANCE_PROVIDER_CODE,
} from '../../modules/ingestion/providers/france/france.constants';

export async function seedFranceSource(connectionString: string) {
  const client = postgres(connectionString, { max: 1 });
  const db = drizzle(client, { schema });

  try {
    const france = await db.query.countries.findFirst({
      where: eq(schema.countries.iso2, 'FR'),
    });
    if (!france) {
      throw new Error('France not found. Run reference seed first.');
    }

    const [source] = await db
      .insert(schema.dataSources)
      .values({
        code: FRANCE_PROVIDER_CODE,
        name: 'France Official Fuel Prices (prix-carburants.gouv.fr)',
        type: 'official',
        countryId: france.id,
        baseUrl:
          'https://data.economie.gouv.fr/explore/dataset/prix-des-carburants-en-france-flux-instantane-v2/',
        isActive: true,
        trustWeight: 90,
      })
      .onConflictDoUpdate({
        target: schema.dataSources.code,
        set: {
          name: 'France Official Fuel Prices (prix-carburants.gouv.fr)',
          baseUrl:
            'https://data.economie.gouv.fr/explore/dataset/prix-des-carburants-en-france-flux-instantane-v2/',
          isActive: true,
          trustWeight: 90,
          updatedAt: new Date(),
        },
      })
      .returning();

    const fuelTypes = await db.select().from(schema.fuelTypes);
    const fuelByCode = new Map(fuelTypes.map((f) => [f.code, f.id]));

    for (const alias of FRANCE_FUEL_ALIASES) {
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
        countryId: france.id,
        externalName: alias.externalName,
        fuelTypeId,
      });
    }

    console.log(
      `France source seed complete: ${FRANCE_PROVIDER_CODE}, ${FRANCE_FUEL_ALIASES.length} fuel aliases`,
    );
  } finally {
    await client.end();
  }
}
