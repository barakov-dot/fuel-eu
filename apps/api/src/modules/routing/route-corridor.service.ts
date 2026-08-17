import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DATABASE_CLIENT } from '../../database/database.constants';
import * as schema from '../../database/schema';
import { PriceCandidateQueryService } from '../prices/price-candidate-query.service';
import { PriceSelectionService } from '../prices/price-selection.service';
import type { GeoJsonLineString } from './routing-provider.interface';
import { CORRIDOR_CANDIDATE_POOL } from './routing.constants';

export type CorridorCandidateRow = {
  id: string;
  name: string | null;
  brand: string | null;
  address_line: string | null;
  postal_code: string | null;
  city: string | null;
  country_iso2: string;
  country_name_en: string;
  lat: number;
  lon: number;
  distance_to_route_meters: number;
  route_progress: number;
  price: string;
  currency_code: string;
  observed_at: Date;
  fuel_type_id: string;
  fuel_code: string;
  fuel_name_en: string;
};

export type CorridorSearchParams = {
  routeGeometry: GeoJsonLineString;
  fuelTypeId: string;
  currency: string;
  corridorMeters: number;
  maxPrice?: number;
  onlyWithPrice?: boolean;
  maxPriceAgeHours?: number;
  candidatePoolSize?: number;
};

@Injectable()
export class RouteCorridorService {
  constructor(
    @Inject(DATABASE_CLIENT)
    private readonly db: PostgresJsDatabase<typeof schema>,
    private readonly priceCandidateQuery: PriceCandidateQueryService,
    private readonly priceSelection: PriceSelectionService,
  ) {}

  async findCandidates(
    params: CorridorSearchParams,
  ): Promise<CorridorCandidateRow[]> {
    const poolSize = params.candidatePoolSize ?? CORRIDOR_CANDIDATE_POOL;
    const routeGeoJson = JSON.stringify(params.routeGeometry);
    const onlyWithPrice = params.onlyWithPrice ?? true;

    const stationRows = await this.db.execute<{
      id: string;
      name: string | null;
      brand: string | null;
      address_line: string | null;
      postal_code: string | null;
      city: string | null;
      country_iso2: string;
      country_name_en: string;
      lat: number;
      lon: number;
      distance_to_route_meters: number;
      route_progress: number;
    }>(sql`
      WITH route_line AS (
        SELECT ST_SetSRID(ST_GeomFromGeoJSON(${routeGeoJson}), 4326) AS geom
      ),
      corridor_stations AS (
        SELECT
          s.id,
          s.name,
          s.brand,
          s.address_line,
          s.postal_code,
          s.city,
          c.iso2 AS country_iso2,
          c.name_en AS country_name_en,
          ST_Y(s.location) AS lat,
          ST_X(s.location) AS lon,
          ST_Distance(
            s.location::geography,
            rl.geom::geography
          ) AS distance_to_route_meters,
          ST_LineLocatePoint(
            rl.geom,
            ST_ClosestPoint(rl.geom, s.location)
          ) AS route_progress
        FROM ${schema.stations} s
        INNER JOIN ${schema.countries} c ON c.id = s.country_id
        CROSS JOIN route_line rl
        WHERE s.is_active = true
          AND ST_DWithin(
            s.location::geography,
            rl.geom::geography,
            ${params.corridorMeters}
          )
      )
      SELECT *
      FROM corridor_stations
      ORDER BY distance_to_route_meters ASC, id ASC
      LIMIT ${poolSize * 3}
    `);

    const stationIds = stationRows.map((row) => row.id);
    const candidates =
      await this.priceCandidateQuery.fetchCandidatesForStations(
        stationIds,
        params.fuelTypeId,
        params.currency,
      );
    const selected = this.priceSelection.selectBestByStationAndFuel(candidates);
    const now = Date.now();

    const results: CorridorCandidateRow[] = [];

    for (const station of stationRows) {
      const key = `${station.id}:${params.fuelTypeId}`;
      const price = selected.get(key);
      if (!price) {
        if (onlyWithPrice) {
          continue;
        }
        continue;
      }

      if (
        params.maxPrice !== undefined &&
        Number(price.price) > params.maxPrice
      ) {
        continue;
      }

      if (params.maxPriceAgeHours !== undefined) {
        const observedAtDate =
          price.observedAt instanceof Date
            ? price.observedAt
            : new Date(price.observedAt);
        const ageHours = (now - observedAtDate.getTime()) / (1000 * 60 * 60);
        if (ageHours > params.maxPriceAgeHours) {
          continue;
        }
      }

      results.push({
        id: station.id,
        name: station.name,
        brand: station.brand,
        address_line: station.address_line,
        postal_code: station.postal_code,
        city: station.city,
        country_iso2: station.country_iso2,
        country_name_en: station.country_name_en,
        lat: station.lat,
        lon: station.lon,
        distance_to_route_meters: station.distance_to_route_meters,
        route_progress: station.route_progress,
        price: price.price,
        currency_code: price.currencyCode,
        observed_at: price.observedAt,
        fuel_type_id: price.fuelTypeId,
        fuel_code: price.fuelCode,
        fuel_name_en: price.fuelNameEn,
      });

      if (results.length >= poolSize) {
        break;
      }
    }

    results.sort(
      (a, b) =>
        a.distance_to_route_meters - b.distance_to_route_meters ||
        Number(a.price) - Number(b.price) ||
        a.id.localeCompare(b.id),
    );

    return results.slice(0, poolSize);
  }
}
