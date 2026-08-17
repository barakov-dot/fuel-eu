import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from '../../database/database.constants';
import {
  DEFAULT_GEOCODING_CACHE_TTL_SECONDS,
  DEFAULT_NOMINATIM_MIN_INTERVAL_MS,
} from './geocoding.constants';
import type {
  GeocodingProvider,
  GeocodingResult,
  GeocodingSearchRequest,
  ReverseGeocodingRequest,
  ReverseGeocodingResult,
} from './geocoding-provider.interface';
import { GEOCODING_PROVIDER_TOKEN } from './geocoding.constants';
import { GeocodingRequestThrottle } from './geocoding.throttle';

function stableCoordinate(value: number): string {
  return value.toFixed(5);
}

function normalizeQuery(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, ' ');
}

function buildSearchCacheKey(
  providerName: string,
  request: GeocodingSearchRequest,
): string {
  const countryCodes = (request.countryCodes ?? [])
    .map((code) => code.toLowerCase())
    .sort()
    .join(',');
  const bias = request.biasLocation
    ? `${stableCoordinate(request.biasLocation.lat)},${stableCoordinate(request.biasLocation.lon)}`
    : '';

  return [
    'geocode',
    'search',
    providerName,
    normalizeQuery(request.query),
    String(request.limit ?? 5),
    request.language ?? '',
    countryCodes,
    bias,
  ].join(':');
}

function buildReverseCacheKey(
  providerName: string,
  request: ReverseGeocodingRequest,
): string {
  return [
    'geocode',
    'reverse',
    providerName,
    stableCoordinate(request.lat),
    stableCoordinate(request.lon),
    request.language ?? '',
  ].join(':');
}

@Injectable()
export class GeocodingCacheService {
  constructor(
    @Inject(REDIS_CLIENT)
    private readonly redis: Redis,
  ) {}

  async getSearch(
    providerName: string,
    request: GeocodingSearchRequest,
  ): Promise<GeocodingResult[] | null> {
    if (!this.redis) {
      return null;
    }

    try {
      const cached = await this.redis.get(
        buildSearchCacheKey(providerName, request),
      );
      if (!cached) {
        return null;
      }
      return JSON.parse(cached) as GeocodingResult[];
    } catch {
      return null;
    }
  }

  async setSearch(
    providerName: string,
    request: GeocodingSearchRequest,
    results: GeocodingResult[],
    ttlSeconds: number,
  ): Promise<void> {
    if (!this.redis) {
      return;
    }

    try {
      await this.redis.set(
        buildSearchCacheKey(providerName, request),
        JSON.stringify(results),
        'EX',
        ttlSeconds,
      );
    } catch {
      // Cache failures must not break geocoding.
    }
  }

  async getReverse(
    providerName: string,
    request: ReverseGeocodingRequest,
  ): Promise<ReverseGeocodingResult | null | undefined> {
    if (!this.redis) {
      return undefined;
    }

    try {
      const cached = await this.redis.get(
        buildReverseCacheKey(providerName, request),
      );
      if (cached === null) {
        return undefined;
      }
      if (cached === 'null') {
        return null;
      }
      return JSON.parse(cached) as ReverseGeocodingResult;
    } catch {
      return undefined;
    }
  }

  async setReverse(
    providerName: string,
    request: ReverseGeocodingRequest,
    result: ReverseGeocodingResult | null,
    ttlSeconds: number,
  ): Promise<void> {
    if (!this.redis) {
      return;
    }

    try {
      await this.redis.set(
        buildReverseCacheKey(providerName, request),
        result ? JSON.stringify(result) : 'null',
        'EX',
        ttlSeconds,
      );
    } catch {
      // Cache failures must not break geocoding.
    }
  }
}

@Injectable()
export class GeocodingService {
  private throttle: GeocodingRequestThrottle;

  constructor(
    @Inject(GEOCODING_PROVIDER_TOKEN)
    private readonly provider: GeocodingProvider,
    private readonly cacheService: GeocodingCacheService,
    private readonly configService: ConfigService,
  ) {
    const minIntervalMs = Number(
      this.configService.get<string>('NOMINATIM_MIN_INTERVAL_MS') ??
        DEFAULT_NOMINATIM_MIN_INTERVAL_MS,
    );
    this.throttle = new GeocodingRequestThrottle(minIntervalMs);
  }

  get providerName(): string {
    return this.provider.name;
  }

  private get cacheTtlSeconds(): number {
    return Number(
      this.configService.get<string>('GEOCODING_CACHE_TTL_SECONDS') ??
        DEFAULT_GEOCODING_CACHE_TTL_SECONDS,
    );
  }

  async search(
    request: GeocodingSearchRequest,
    options?: { useCache?: boolean },
  ): Promise<GeocodingResult[]> {
    const useCache = options?.useCache ?? true;

    if (useCache) {
      const cached = await this.cacheService.getSearch(
        this.provider.name,
        request,
      );
      if (cached) {
        return cached;
      }
    }

    await this.throttle.waitForSlot();
    const results = await this.provider.search(request);

    if (useCache) {
      await this.cacheService.setSearch(
        this.provider.name,
        request,
        results,
        this.cacheTtlSeconds,
      );
    }

    return results;
  }

  async reverse(
    request: ReverseGeocodingRequest,
    options?: { useCache?: boolean },
  ): Promise<ReverseGeocodingResult | null> {
    const useCache = options?.useCache ?? true;

    if (useCache) {
      const cached = await this.cacheService.getReverse(
        this.provider.name,
        request,
      );
      if (cached !== undefined) {
        return cached;
      }
    }

    await this.throttle.waitForSlot();
    const result = await this.provider.reverse(request);

    if (useCache) {
      await this.cacheService.setReverse(
        this.provider.name,
        request,
        result,
        this.cacheTtlSeconds,
      );
    }

    return result;
  }

  /** Test hook for injecting a fake throttle without Nest DI. */
  setThrottleForTests(throttle: GeocodingRequestThrottle): void {
    this.throttle = throttle;
  }
}

export {
  buildReverseCacheKey,
  buildSearchCacheKey,
  normalizeQuery,
  stableCoordinate,
};
