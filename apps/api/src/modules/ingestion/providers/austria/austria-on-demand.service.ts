import { ConfigService } from '@nestjs/config';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import { DATABASE_CLIENT } from '../../../../database/database.constants';
import * as schema from '../../../../database/schema';
import { RedisConnection } from '../../../../redis/redis.connection';
import { IngestionWriterService } from '../../ingestion-writer.service';
import {
  AUSTRIA_BOUNDS,
  AUSTRIA_DEFAULT_CACHE_TTL_SECONDS,
  AUSTRIA_MIN_REQUEST_INTERVAL_MS,
  AUSTRIA_PROVIDER_CODE,
  type AustriaApiFuel,
} from './austria.constants';
import { AustriaFuelPriceProvider } from './austria.provider';

export interface AustriaRefreshOptions {
  lat: number;
  lon: number;
  fuelTypeId?: string;
}

@Injectable()
export class AustriaOnDemandEnrichmentService {
  private readonly logger = new Logger(AustriaOnDemandEnrichmentService.name);
  private lastRequestAt = 0;

  constructor(
    @Inject(DATABASE_CLIENT)
    private readonly db: PostgresJsDatabase<typeof schema>,
    private readonly configService: ConfigService,
    private readonly redisConnection: RedisConnection,
    private readonly writerService: IngestionWriterService,
    private readonly austriaProvider: AustriaFuelPriceProvider,
  ) {}

  isInAustria(lat: number, lon: number): boolean {
    return (
      lat >= AUSTRIA_BOUNDS.minLat &&
      lat <= AUSTRIA_BOUNDS.maxLat &&
      lon >= AUSTRIA_BOUNDS.minLon &&
      lon <= AUSTRIA_BOUNDS.maxLon
    );
  }

  async refreshNearLocation(options: AustriaRefreshOptions): Promise<void> {
    if (!this.isInAustria(options.lat, options.lon)) {
      return;
    }

    const cacheKey = this.buildCacheKey(options);
    const ttlSeconds = this.getCacheTtlSeconds();

    try {
      const cached = await this.redisConnection.client.get(cacheKey);
      if (cached) {
        return;
      }
    } catch (error) {
      this.logger.warn(
        `Austria cache lookup failed, continuing without cache: ${error instanceof Error ? error.message : error}`,
      );
    }

    await this.enforceRateLimit();

    const dataSource = await this.writerService.loadDataSource(
      AUSTRIA_PROVIDER_CODE,
    );
    if (!dataSource?.countryId || !dataSource.country) {
      this.logger.warn(
        'Austria data source is not seeded; skipping enrichment',
      );
      return;
    }

    const currency = await this.writerService.loadPrimaryCurrency(
      dataSource.countryId,
    );
    if (!currency) {
      this.logger.warn('Austria primary currency not configured; skipping');
      return;
    }

    const fuelAliasMap = await this.writerService.loadFuelAliasMap(
      dataSource.id,
      dataSource.countryId,
    );

    const apiFuels = await this.resolveApiFuels(
      options.fuelTypeId,
      fuelAliasMap,
    );

    const fetchResult = await this.austriaProvider.fetch({
      location: { lat: options.lat, lon: options.lon },
      austriaFuelTypes: apiFuels,
    });

    const normalized = this.austriaProvider.normalize(fetchResult.records, {
      dataSourceId: dataSource.id,
      countryId: dataSource.countryId,
      currencyId: currency.currencyId,
      fuelAliasMap,
      providerMetadata: fetchResult.metadata,
    });

    if (normalized.stations.length === 0) {
      return;
    }

    await this.writerService.importStations(normalized.stations, {
      dataSourceId: dataSource.id,
      countryId: dataSource.countryId,
      currencyId: currency.currencyId,
      fuelAliasMap,
      providerMetadata: fetchResult.metadata,
      dryRun: false,
      runId: 'austria-on-demand',
      observationDedupStrategy: 'price-change-only',
    });

    try {
      await this.redisConnection.client.setex(cacheKey, ttlSeconds, '1');
    } catch (error) {
      this.logger.warn(
        `Austria cache write failed: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  private async resolveApiFuels(
    fuelTypeId: string | undefined,
    fuelAliasMap: Map<string, string>,
  ): Promise<AustriaApiFuel[] | undefined> {
    if (!fuelTypeId) {
      return undefined;
    }

    const fuelType = await this.db.query.fuelTypes.findFirst({
      where: eq(schema.fuelTypes.id, fuelTypeId),
    });
    if (!fuelType) {
      return undefined;
    }

    const apiFuels: AustriaApiFuel[] = [];
    for (const [externalName, mappedFuelTypeId] of fuelAliasMap.entries()) {
      if (
        mappedFuelTypeId === fuelTypeId &&
        (externalName === 'DIE' || externalName === 'SUP')
      ) {
        apiFuels.push(externalName);
      }
    }

    return apiFuels.length > 0 ? apiFuels : undefined;
  }

  private buildCacheKey(options: AustriaRefreshOptions): string {
    const roundedLat = options.lat.toFixed(2);
    const roundedLon = options.lon.toFixed(2);
    const fuelKey = options.fuelTypeId ?? 'all';
    return `austria:econtrol:v1:${roundedLat}:${roundedLon}:${fuelKey}`;
  }

  private getCacheTtlSeconds(): number {
    const configured = this.configService.get<string>(
      'AUSTRIA_CACHE_TTL_SECONDS',
    );
    const parsed = configured ? Number.parseInt(configured, 10) : NaN;
    return Number.isFinite(parsed) && parsed > 0
      ? parsed
      : AUSTRIA_DEFAULT_CACHE_TTL_SECONDS;
  }

  private async enforceRateLimit(): Promise<void> {
    const minInterval = AUSTRIA_MIN_REQUEST_INTERVAL_MS;
    const elapsed = Date.now() - this.lastRequestAt;
    if (elapsed < minInterval) {
      await new Promise((resolve) =>
        setTimeout(resolve, minInterval - elapsed),
      );
    }
    this.lastRequestAt = Date.now();
  }
}
