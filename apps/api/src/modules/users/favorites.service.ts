import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DATABASE_CLIENT } from '../../database/database.constants';
import * as schema from '../../database/schema';
import { PriceCandidateQueryService } from '../prices/price-candidate-query.service';
import { PriceSelectionService } from '../prices/price-selection.service';
import { StationsService } from '../stations/stations.service';

@Injectable()
export class FavoritesService {
  constructor(
    @Inject(DATABASE_CLIENT)
    private readonly db: PostgresJsDatabase<typeof schema>,
    private readonly stationsService: StationsService,
    private readonly priceCandidateQuery: PriceCandidateQueryService,
    private readonly priceSelection: PriceSelectionService,
  ) {}

  async listFavorites(userId: string, preferredFuelTypeId?: string) {
    const favorites = await this.db
      .select({
        stationId: schema.userFavorites.stationId,
        createdAt: schema.userFavorites.createdAt,
        id: schema.stations.id,
        name: schema.stations.name,
        brand: schema.stations.brand,
        addressLine: schema.stations.addressLine,
        postalCode: schema.stations.postalCode,
        city: schema.stations.city,
        countryIso2: schema.countries.iso2,
        countryNameEn: schema.countries.nameEn,
        latitude: sql<number>`ST_Y(${schema.stations.location})`.as('latitude'),
        longitude: sql<number>`ST_X(${schema.stations.location})`.as(
          'longitude',
        ),
      })
      .from(schema.userFavorites)
      .innerJoin(
        schema.stations,
        eq(schema.userFavorites.stationId, schema.stations.id),
      )
      .innerJoin(
        schema.countries,
        eq(schema.stations.countryId, schema.countries.id),
      )
      .where(eq(schema.userFavorites.userId, userId))
      .orderBy(schema.userFavorites.createdAt);

    if (favorites.length === 0) {
      return { items: [] };
    }

    const stationIds = favorites.map((f) => f.stationId);
    const candidates =
      await this.priceCandidateQuery.fetchCandidatesForStations(
        stationIds,
        preferredFuelTypeId,
      );
    const selected = this.priceSelection.selectBestByStationAndFuel(candidates);

    return {
      items: favorites.map((favorite) => {
        const key = preferredFuelTypeId
          ? `${favorite.stationId}:${preferredFuelTypeId}`
          : Array.from(selected.keys()).find((k) =>
              k.startsWith(`${favorite.stationId}:`),
            );
        const price = key ? selected.get(key) : undefined;

        return {
          id: favorite.id,
          name: favorite.name,
          brand: favorite.brand,
          country: {
            iso2: favorite.countryIso2,
            name: favorite.countryNameEn,
          },
          address: {
            addressLine: favorite.addressLine,
            postalCode: favorite.postalCode,
            city: favorite.city,
          },
          location: {
            lat: favorite.latitude,
            lon: favorite.longitude,
          },
          favoritedAt: favorite.createdAt.toISOString(),
          price: price
            ? {
                fuelTypeId: price.fuelTypeId,
                fuelCode: price.fuelCode,
                fuelName: price.fuelNameEn,
                price: price.price,
                currency: price.currencyCode,
                observedAt: price.observedAt.toISOString(),
                source: {
                  type: price.dataSourceType,
                  name: price.dataSourceName,
                },
                confidence: price.confidence,
                ...(price.verification
                  ? { verification: price.verification }
                  : {}),
              }
            : null,
        };
      }),
    };
  }

  async addFavorite(userId: string, stationId: string): Promise<void> {
    const exists = await this.stationsService.exists(stationId);
    if (!exists) {
      throw new NotFoundException(`Station ${stationId} not found`);
    }

    await this.db
      .insert(schema.userFavorites)
      .values({ userId, stationId })
      .onConflictDoNothing({
        target: [schema.userFavorites.userId, schema.userFavorites.stationId],
      });
  }

  async removeFavorite(userId: string, stationId: string): Promise<void> {
    await this.db
      .delete(schema.userFavorites)
      .where(
        and(
          eq(schema.userFavorites.userId, userId),
          eq(schema.userFavorites.stationId, stationId),
        ),
      );
  }
}
