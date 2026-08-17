import { Inject, Injectable } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DATABASE_CLIENT } from '../../database/database.constants';
import * as schema from '../../database/schema';

@Injectable()
export class StationsService {
  constructor(
    @Inject(DATABASE_CLIENT)
    private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  async findOne(id: string) {
    const [row] = await this.db
      .select({
        id: schema.stations.id,
        countryId: schema.stations.countryId,
        brand: schema.stations.brand,
        name: schema.stations.name,
        addressLine: schema.stations.addressLine,
        postalCode: schema.stations.postalCode,
        city: schema.stations.city,
        phone: schema.stations.phone,
        website: schema.stations.website,
        isActive: schema.stations.isActive,
        latitude: sql<number>`ST_Y(${schema.stations.location})`.as('latitude'),
        longitude: sql<number>`ST_X(${schema.stations.location})`.as(
          'longitude',
        ),
        countryIso2: schema.countries.iso2,
        countryNameEn: schema.countries.nameEn,
      })
      .from(schema.stations)
      .innerJoin(
        schema.countries,
        eq(schema.stations.countryId, schema.countries.id),
      )
      .where(eq(schema.stations.id, id))
      .limit(1);

    return row ?? null;
  }

  async exists(id: string): Promise<boolean> {
    const [station] = await this.db
      .select({ id: schema.stations.id })
      .from(schema.stations)
      .where(eq(schema.stations.id, id))
      .limit(1);

    return station !== undefined;
  }
}
