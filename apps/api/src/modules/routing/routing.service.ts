import { Inject, Injectable } from '@nestjs/common';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from '../../database/database.constants';
import type {
  RouteRequest,
  RouteResult,
  RoutingProvider,
} from './routing-provider.interface';
import { ROUTING_PROVIDER_TOKEN } from './routing.constants';

function stableCoordinate(value: number): string {
  return value.toFixed(6);
}

function buildCacheKey(request: RouteRequest, providerName: string): string {
  const profile = request.profile ?? 'driving';
  const via = (request.via ?? [])
    .map(
      (point) =>
        `${stableCoordinate(point.lat)},${stableCoordinate(point.lon)}`,
    )
    .join('|');

  return [
    'route',
    providerName,
    profile,
    `${stableCoordinate(request.origin.lat)},${stableCoordinate(request.origin.lon)}`,
    via,
    `${stableCoordinate(request.destination.lat)},${stableCoordinate(request.destination.lon)}`,
  ].join(':');
}

@Injectable()
export class RoutingCacheService {
  constructor(
    @Inject(REDIS_CLIENT)
    private readonly redis: Redis,
  ) {}

  async get(
    request: RouteRequest,
    providerName: string,
  ): Promise<RouteResult | null> {
    if (!this.redis) {
      return null;
    }

    try {
      const cached = await this.redis.get(buildCacheKey(request, providerName));
      if (!cached) {
        return null;
      }
      return JSON.parse(cached) as RouteResult;
    } catch {
      return null;
    }
  }

  async set(
    request: RouteRequest,
    providerName: string,
    result: RouteResult,
    ttlSeconds: number,
  ): Promise<void> {
    if (!this.redis) {
      return;
    }

    try {
      await this.redis.set(
        buildCacheKey(request, providerName),
        JSON.stringify(result),
        'EX',
        ttlSeconds,
      );
    } catch {
      // Cache failures must not break routing.
    }
  }
}

@Injectable()
export class RoutingService {
  constructor(
    @Inject(ROUTING_PROVIDER_TOKEN)
    private readonly provider: RoutingProvider,
    private readonly cacheService: RoutingCacheService,
  ) {}

  get providerName(): string {
    return this.provider.name;
  }

  async route(
    request: RouteRequest,
    options?: { cacheTtlSeconds?: number; useCache?: boolean },
  ): Promise<RouteResult> {
    const useCache = options?.useCache ?? true;
    const cacheTtlSeconds = options?.cacheTtlSeconds ?? 600;

    if (useCache) {
      const cached = await this.cacheService.get(request, this.provider.name);
      if (cached) {
        return cached;
      }
    }

    const result = await this.provider.route(request);
    if (useCache) {
      await this.cacheService.set(
        request,
        this.provider.name,
        result,
        cacheTtlSeconds,
      );
    }
    return result;
  }
}
