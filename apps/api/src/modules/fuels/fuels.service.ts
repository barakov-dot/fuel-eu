import { Inject, Injectable } from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DATABASE_CLIENT } from '../../database/database.constants';
import * as schema from '../../database/schema';

@Injectable()
export class FuelsService {
  constructor(
    @Inject(DATABASE_CLIENT)
    private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  findAll() {
    return this.db
      .select({
        id: schema.fuelTypes.id,
        code: schema.fuelTypes.code,
        nameEn: schema.fuelTypes.nameEn,
        nameRu: schema.fuelTypes.nameRu,
        category: schema.fuelTypes.category,
        octaneRating: schema.fuelTypes.octaneRating,
        biofuelPercentage: schema.fuelTypes.biofuelPercentage,
        unit: schema.fuelTypes.unit,
        isActive: schema.fuelTypes.isActive,
      })
      .from(schema.fuelTypes)
      .where(eq(schema.fuelTypes.isActive, true))
      .orderBy(asc(schema.fuelTypes.code));
  }
}
