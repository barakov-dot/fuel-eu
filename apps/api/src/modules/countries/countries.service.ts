import { Inject, Injectable } from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DATABASE_CLIENT } from '../../database/database.constants';
import * as schema from '../../database/schema';

@Injectable()
export class CountriesService {
  constructor(
    @Inject(DATABASE_CLIENT)
    private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  findAll() {
    return this.db
      .select({
        id: schema.countries.id,
        iso2: schema.countries.iso2,
        iso3: schema.countries.iso3,
        nameEn: schema.countries.nameEn,
        nameRu: schema.countries.nameRu,
        isEuMember: schema.countries.isEuMember,
      })
      .from(schema.countries)
      .orderBy(asc(schema.countries.nameEn));
  }

  async findOne(id: string) {
    const [country] = await this.db
      .select({
        id: schema.countries.id,
        iso2: schema.countries.iso2,
        iso3: schema.countries.iso3,
        nameEn: schema.countries.nameEn,
        nameRu: schema.countries.nameRu,
        isEuMember: schema.countries.isEuMember,
      })
      .from(schema.countries)
      .where(eq(schema.countries.id, id))
      .limit(1);

    return country ?? null;
  }
}
