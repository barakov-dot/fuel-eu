import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DATABASE_CLIENT } from '../../database/database.constants';
import * as schema from '../../database/schema';
import { PriceCandidateQueryService } from '../prices/price-candidate-query.service';
import { PriceSelectionService } from '../prices/price-selection.service';
import { AustriaOnDemandEnrichmentService } from '../ingestion/providers/austria/austria-on-demand.service';
import { CoverageService } from '../coverage/coverage.service';
import { mapSelectedPriceToApi } from '../prices/selected-price.mapper';
import { BboxStationsQueryDto } from './dto/bbox-stations-query.dto';
import { NearbyStationsQueryDto } from './dto/nearby-stations-query.dto';
import { NEARBY_SORT_DISTANCE, NEARBY_SORT_PRICE } from './stations.constants';

type NearbyStationRow = {
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
  distance_meters: number;
};

type BboxStationRow = {
  id: string;
  name: string | null;
  brand: string | null;
  lat: number;
  lon: number;
};

@Injectable()
export class StationsQueryService {
  private readonly logger = new Logger(StationsQueryService.name);

  constructor(
    @Inject(DATABASE_CLIENT)
    private readonly db: PostgresJsDatabase<typeof schema>,
    private readonly priceCandidateQuery: PriceCandidateQueryService,
    private readonly priceSelection: PriceSelectionService,
    private readonly austriaEnrichment: AustriaOnDemandEnrichmentService,
    private readonly coverageService: CoverageService,
  ) {}

  async findNearby(query: NearbyStationsQueryDto) {
    this.validateNearbyBusinessRules(query);

    if (this.austriaEnrichment.isInAustria(query.lat, query.lon)) {
      try {
        await this.austriaEnrichment.refreshNearLocation({
          lat: query.lat,
          lon: query.lon,
          fuelTypeId: query.fuelTypeId,
        });
      } catch (error) {
        this.logger.warn(
          `Austria on-demand enrichment failed: ${error instanceof Error ? error.message : error}`,
        );
      }
    }

    const radiusKm = query.radiusKm ?? 10;
    const limit = query.limit ?? 50;
    const sort = query.sort ?? NEARBY_SORT_DISTANCE;
    const onlyWithPrice = query.onlyWithPrice ?? false;
    const radiusMeters = radiusKm * 1000;

    const stationRows = await this.fetchNearbyStations(
      query.lat,
      query.lon,
      radiusMeters,
    );

    const priceRows = await this.priceCandidateQuery.fetchCandidatesForStations(
      stationRows.map((row) => row.id),
      query.fuelTypeId,
      query.currency,
    );

    const selectedPrices =
      this.priceSelection.selectBestByStationAndFuel(priceRows);
    const nowMs = Date.now();

    let items = stationRows.map((station) => {
      const prices = Array.from(selectedPrices.entries())
        .filter(([key]) => key.startsWith(`${station.id}:`))
        .map(([, price]) => mapSelectedPriceToApi(price, new Date(nowMs)));

      return {
        station,
        prices,
      };
    });

    if (query.fuelTypeId) {
      items = items.filter((item) =>
        item.prices.some((price) => price.fuelType.id === query.fuelTypeId),
      );
    }

    if (onlyWithPrice) {
      items = items.filter((item) => item.prices.length > 0);
    }

    if (query.maxPrice !== undefined && query.fuelTypeId) {
      items = items.filter((item) => {
        const fuelPrice = item.prices.find(
          (price) => price.fuelType.id === query.fuelTypeId,
        );
        if (!fuelPrice) {
          return false;
        }
        return Number(fuelPrice.price) <= query.maxPrice!;
      });
    }

    if (sort === NEARBY_SORT_PRICE && query.fuelTypeId) {
      const currencies = new Set(
        items
          .map(
            (item) =>
              item.prices.find(
                (price) => price.fuelType.id === query.fuelTypeId,
              )?.currency,
          )
          .filter((currency): currency is string => currency !== undefined),
      );

      if (currencies.size > 1 && !query.currency) {
        throw new BadRequestException(
          'Price sorting requires a single currency. Provide the currency query parameter or narrow the search area.',
        );
      }

      items.sort((a, b) => {
        const priceA = a.prices.find(
          (price) => price.fuelType.id === query.fuelTypeId,
        );
        const priceB = b.prices.find(
          (price) => price.fuelType.id === query.fuelTypeId,
        );

        if (!priceA || !priceB) {
          return 0;
        }

        const priceCompare = Number(priceA.price) - Number(priceB.price);
        if (priceCompare !== 0) {
          return priceCompare;
        }

        const distanceCompare =
          a.station.distance_meters - b.station.distance_meters;
        if (distanceCompare !== 0) {
          return distanceCompare;
        }

        return a.station.id.localeCompare(b.station.id);
      });
    } else {
      items.sort(
        (a, b) =>
          a.station.distance_meters - b.station.distance_meters ||
          a.station.id.localeCompare(b.station.id),
      );
    }

    const limitedItems = items.slice(0, limit).map(({ station, prices }) => ({
      id: station.id,
      name: station.name,
      brand: station.brand,
      country: {
        iso2: station.country_iso2,
        name: station.country_name_en,
      },
      address: {
        addressLine: station.address_line,
        postalCode: station.postal_code,
        city: station.city,
      },
      location: {
        lat: station.lat,
        lon: station.lon,
      },
      distanceMeters: Math.round(station.distance_meters),
      prices,
    }));

    const coverageNotice = await this.coverageService.getCoverageNoticeForPoint(
      query.lat,
      query.lon,
    );

    return {
      items: limitedItems,
      meta: {
        lat: query.lat,
        lon: query.lon,
        radiusKm,
        count: limitedItems.length,
        ...(coverageNotice
          ? {
              coverageNotice: {
                coverageType: coverageNotice.coverageType,
                limitations: coverageNotice.limitations,
              },
            }
          : {}),
        ...(this.austriaEnrichment.isInAustria(query.lat, query.lon)
          ? {
              austriaDataScope:
                'official-cheapest-subset-only-not-all-area-stations',
            }
          : {}),
      },
    };
  }

  async findInBbox(query: BboxStationsQueryDto) {
    this.validateBbox(query);

    const limit = query.limit ?? 500;
    const onlyWithPrice = query.onlyWithPrice ?? false;

    const stationRows = await this.fetchBboxStations(
      query.west,
      query.south,
      query.east,
      query.north,
      limit + 1,
    );

    const truncated = stationRows.length > limit;
    const limitedRows = truncated ? stationRows.slice(0, limit) : stationRows;

    const priceRows = await this.priceCandidateQuery.fetchCandidatesForStations(
      limitedRows.map((row) => row.id),
      query.fuelTypeId,
    );

    const selectedPrices =
      this.priceSelection.selectBestByStationAndFuel(priceRows);
    const nowMs = Date.now();

    let items = limitedRows.map((station) => ({
      id: station.id,
      name: station.name,
      brand: station.brand,
      lat: station.lat,
      lon: station.lon,
      prices: Array.from(selectedPrices.entries())
        .filter(([key]) => key.startsWith(`${station.id}:`))
        .map(([, price]) => mapSelectedPriceToApi(price, new Date(nowMs))),
    }));

    if (query.fuelTypeId) {
      items = items.filter((item) =>
        item.prices.some((price) => price.fuelType.id === query.fuelTypeId),
      );
    }

    if (onlyWithPrice) {
      items = items.filter((item) => item.prices.length > 0);
    }

    return {
      items,
      meta: {
        count: items.length,
        limit,
        truncated,
      },
    };
  }

  private validateNearbyBusinessRules(query: NearbyStationsQueryDto) {
    if (query.sort === NEARBY_SORT_PRICE && !query.fuelTypeId) {
      throw new BadRequestException('fuelTypeId is required when sort=price');
    }

    if (query.maxPrice !== undefined) {
      if (!query.fuelTypeId) {
        throw new BadRequestException(
          'fuelTypeId is required when maxPrice is provided',
        );
      }
      if (!query.currency) {
        throw new BadRequestException(
          'currency is required when maxPrice is provided',
        );
      }
    }
  }

  private validateBbox(query: BboxStationsQueryDto) {
    if (query.south >= query.north) {
      throw new BadRequestException('south must be less than north');
    }

    if (query.west >= query.east) {
      throw new BadRequestException(
        'Bounding boxes crossing the antimeridian are not supported. west must be less than east.',
      );
    }
  }

  private async fetchNearbyStations(
    lat: number,
    lon: number,
    radiusMeters: number,
  ): Promise<NearbyStationRow[]> {
    const userPoint = sql`ST_SetSRID(ST_MakePoint(${lon}, ${lat}), 4326)`;
    const stationLocation = sql`s.location`;
    const distanceExpr = sql<number>`ST_Distance(${stationLocation}::geography, ${userPoint}::geography)`;

    return this.db.execute<NearbyStationRow>(sql`
      SELECT
        s.id,
        s.name,
        s.brand,
        s.address_line,
        s.postal_code,
        s.city,
        c.iso2 AS country_iso2,
        c.name_en AS country_name_en,
        ST_Y(${stationLocation}) AS lat,
        ST_X(${stationLocation}) AS lon,
        ${distanceExpr} AS distance_meters
      FROM ${schema.stations} s
      INNER JOIN ${schema.countries} c ON c.id = s.country_id
      WHERE s.is_active = true
        AND ST_DWithin(
          ${stationLocation}::geography,
          ${userPoint}::geography,
          ${radiusMeters}
        )
      ORDER BY distance_meters ASC, s.id ASC
    `);
  }

  private async fetchBboxStations(
    west: number,
    south: number,
    east: number,
    north: number,
    limit: number,
  ): Promise<BboxStationRow[]> {
    const envelope = sql`ST_MakeEnvelope(${west}, ${south}, ${east}, ${north}, 4326)`;
    const stationLocation = sql`s.location`;

    return this.db.execute<BboxStationRow>(sql`
      SELECT
        s.id,
        s.name,
        s.brand,
        ST_Y(${stationLocation}) AS lat,
        ST_X(${stationLocation}) AS lon
      FROM ${schema.stations} s
      WHERE s.is_active = true
        AND ST_Intersects(${stationLocation}, ${envelope})
      ORDER BY s.id ASC
      LIMIT ${limit}
    `);
  }
}
