import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DATABASE_CLIENT } from '../../database/database.constants';
import * as schema from '../../database/schema';
import type { UserPreferencesResponse } from '../auth/auth.constants';
import { PatchPreferencesDto } from './dto/patch-preferences.dto';

const MIN_REFUEL_LITERS = 0;
const MAX_REFUEL_LITERS = 200;
const MIN_CONSUMPTION = 0;
const MAX_CONSUMPTION = 50;

@Injectable()
export class PreferencesService {
  constructor(
    @Inject(DATABASE_CLIENT)
    private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  async getPreferences(userId: string): Promise<UserPreferencesResponse> {
    const [prefs] = await this.db
      .select({
        preferredFuelTypeId: schema.userPreferences.preferredFuelTypeId,
        preferredCurrencyCode: schema.currencies.code,
        defaultRefuelLiters: schema.userPreferences.defaultRefuelLiters,
        vehicleConsumptionLPer100Km:
          schema.userPreferences.vehicleConsumptionLPer100Km,
        locale: schema.userPreferences.locale,
      })
      .from(schema.userPreferences)
      .leftJoin(
        schema.currencies,
        eq(schema.userPreferences.preferredCurrencyId, schema.currencies.id),
      )
      .where(eq(schema.userPreferences.userId, userId))
      .limit(1);

    if (!prefs) {
      throw new NotFoundException('Preferences not found');
    }

    return {
      preferredFuelTypeId: prefs.preferredFuelTypeId,
      preferredCurrency: prefs.preferredCurrencyCode,
      defaultRefuelLiters: prefs.defaultRefuelLiters,
      vehicleConsumptionLPer100Km: prefs.vehicleConsumptionLPer100Km,
      locale: prefs.locale,
    };
  }

  async patchPreferences(
    userId: string,
    dto: PatchPreferencesDto,
  ): Promise<UserPreferencesResponse> {
    const updates: Partial<typeof schema.userPreferences.$inferInsert> = {};

    if (dto.preferredFuelTypeId !== undefined) {
      if (dto.preferredFuelTypeId === null) {
        updates.preferredFuelTypeId = null;
      } else {
        const [fuel] = await this.db
          .select({ id: schema.fuelTypes.id })
          .from(schema.fuelTypes)
          .where(eq(schema.fuelTypes.id, dto.preferredFuelTypeId))
          .limit(1);
        if (!fuel) {
          throw new BadRequestException('Invalid fuel type');
        }
        updates.preferredFuelTypeId = dto.preferredFuelTypeId;
      }
    }

    if (dto.preferredCurrency !== undefined) {
      if (dto.preferredCurrency === null) {
        updates.preferredCurrencyId = null;
      } else {
        const [currency] = await this.db
          .select({ id: schema.currencies.id })
          .from(schema.currencies)
          .where(eq(schema.currencies.code, dto.preferredCurrency))
          .limit(1);
        if (!currency) {
          throw new BadRequestException('Invalid currency');
        }
        updates.preferredCurrencyId = currency.id;
      }
    }

    if (dto.defaultRefuelLiters !== undefined) {
      if (dto.defaultRefuelLiters === null) {
        updates.defaultRefuelLiters = null;
      } else {
        this.assertRefuelRange(dto.defaultRefuelLiters);
        updates.defaultRefuelLiters = dto.defaultRefuelLiters;
      }
    }

    if (dto.vehicleConsumptionLPer100Km !== undefined) {
      if (dto.vehicleConsumptionLPer100Km === null) {
        updates.vehicleConsumptionLPer100Km = null;
      } else {
        this.assertConsumptionRange(dto.vehicleConsumptionLPer100Km);
        updates.vehicleConsumptionLPer100Km = dto.vehicleConsumptionLPer100Km;
      }
    }

    if (dto.locale !== undefined) {
      updates.locale = dto.locale;
      await this.db
        .update(schema.users)
        .set({ preferredLocale: dto.locale })
        .where(eq(schema.users.id, userId));
    }

    if (Object.keys(updates).length > 0) {
      await this.db
        .update(schema.userPreferences)
        .set(updates)
        .where(eq(schema.userPreferences.userId, userId));
    }

    return this.getPreferences(userId);
  }

  private assertRefuelRange(value: string): void {
    const numeric = Number(value);
    if (
      Number.isNaN(numeric) ||
      numeric <= MIN_REFUEL_LITERS ||
      numeric > MAX_REFUEL_LITERS
    ) {
      throw new BadRequestException(
        `defaultRefuelLiters must be > ${MIN_REFUEL_LITERS} and <= ${MAX_REFUEL_LITERS}`,
      );
    }
  }

  private assertConsumptionRange(value: string): void {
    const numeric = Number(value);
    if (
      Number.isNaN(numeric) ||
      numeric <= MIN_CONSUMPTION ||
      numeric > MAX_CONSUMPTION
    ) {
      throw new BadRequestException(
        `vehicleConsumptionLPer100Km must be > ${MIN_CONSUMPTION} and <= ${MAX_CONSUMPTION}`,
      );
    }
  }
}
