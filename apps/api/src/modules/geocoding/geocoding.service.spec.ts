import { ConfigService } from '@nestjs/config';
import { GeocodingRequestThrottle } from './geocoding.throttle';
import { GeocodingCacheService, GeocodingService } from './geocoding.service';
import type {
  GeocodingProvider,
  GeocodingResult,
  ReverseGeocodingResult,
} from './geocoding-provider.interface';

describe('GeocodingService', () => {
  const searchResult: GeocodingResult = {
    id: 'mock:1',
    name: 'Paris',
    displayName: 'Paris, France',
    location: { lat: 48.8566, lon: 2.3522 },
    type: 'city',
    category: 'place',
    address: {
      country: 'France',
      countryCode: 'fr',
      city: 'Paris',
      postcode: null,
      road: null,
    },
    boundingBox: null,
  };

  const reverseResult: ReverseGeocodingResult = {
    name: 'Paris',
    displayName: 'Paris, France',
    location: { lat: 48.8566, lon: 2.3522 },
    address: {
      country: 'France',
      countryCode: 'fr',
      city: 'Paris',
      postcode: null,
      road: null,
    },
  };

  function createService(options?: {
    provider?: Partial<GeocodingProvider>;
    redis?: Partial<{
      get: jest.Mock;
      set: jest.Mock;
    }>;
    throttle?: GeocodingRequestThrottle;
  }) {
    const searchMock = jest.fn().mockResolvedValue([searchResult]);
    const reverseMock = jest.fn().mockResolvedValue(reverseResult);

    const provider: GeocodingProvider = {
      name: 'mock',
      search: searchMock,
      reverse: reverseMock,
      ...options?.provider,
    };

    const redisGet = options?.redis?.get ?? jest.fn().mockResolvedValue(null);
    const redisSet = options?.redis?.set ?? jest.fn().mockResolvedValue('OK');

    const redis = {
      get: redisGet,
      set: redisSet,
    };

    const configService = {
      get: (key: string) => {
        if (key === 'GEOCODING_CACHE_TTL_SECONDS') {
          return '86400';
        }
        if (key === 'NOMINATIM_MIN_INTERVAL_MS') {
          return '1000';
        }
        return undefined;
      },
    } as ConfigService;

    const cacheService = new GeocodingCacheService(redis as never);
    const service = new GeocodingService(provider, cacheService, configService);
    if (options?.throttle) {
      service.setThrottleForTests(options.throttle);
    }

    return { service, provider, searchMock, reverseMock, redisGet, redisSet };
  }

  it('returns cached search results without calling provider', async () => {
    const { service, searchMock, redisSet } = createService({
      redis: {
        get: jest.fn().mockResolvedValue(JSON.stringify([searchResult])),
        set: jest.fn(),
      },
    });

    const results = await service.search({ query: 'Paris' });
    expect(results).toEqual([searchResult]);
    expect(searchMock).not.toHaveBeenCalled();
    expect(redisSet).not.toHaveBeenCalled();
  });

  it('stores search results in cache after provider call', async () => {
    const { service, searchMock, redisSet } = createService();
    await service.search({ query: 'Paris' });
    expect(searchMock).toHaveBeenCalledTimes(1);
    expect(redisSet).toHaveBeenCalled();
  });

  it('continues when cache read fails', async () => {
    const { service, searchMock } = createService({
      redis: {
        get: jest.fn().mockRejectedValue(new Error('redis down')),
        set: jest.fn().mockRejectedValue(new Error('redis down')),
      },
    });

    await expect(service.search({ query: 'Paris' })).resolves.toEqual([
      searchResult,
    ]);
    expect(searchMock).toHaveBeenCalledTimes(1);
  });

  it('throttles uncached provider calls', async () => {
    const now = jest
      .fn()
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(100)
      .mockReturnValueOnce(100)
      .mockReturnValueOnce(100)
      .mockReturnValueOnce(100);
    const sleep = jest.fn().mockResolvedValue(undefined);
    const throttle = new GeocodingRequestThrottle(1000, now, sleep);
    const { service } = createService({ throttle });

    await service.search({ query: 'Paris' }, { useCache: false });
    await service.search({ query: 'Rennes' }, { useCache: false });

    expect(sleep).toHaveBeenCalledWith(900);
  });

  it('does not throttle cached search calls', async () => {
    const sleep = jest.fn().mockResolvedValue(undefined);
    const throttle = new GeocodingRequestThrottle(1000, () => 0, sleep);
    const { service } = createService({
      throttle,
      redis: {
        get: jest.fn().mockResolvedValue(JSON.stringify([searchResult])),
        set: jest.fn(),
      },
    });

    await service.search({ query: 'Paris' });
    await service.search({ query: 'Paris' });
    expect(sleep).not.toHaveBeenCalled();
  });

  it('returns cached reverse null marker', async () => {
    const { service, reverseMock } = createService({
      redis: {
        get: jest.fn().mockResolvedValue('null'),
        set: jest.fn(),
      },
    });

    await expect(service.reverse({ lat: 0, lon: 0 })).resolves.toBeNull();
    expect(reverseMock).not.toHaveBeenCalled();
  });
});
