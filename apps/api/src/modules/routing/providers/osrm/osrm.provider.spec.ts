import { ConfigService } from '@nestjs/config';
import { OsrmRoutingProvider } from './osrm.provider';
import {
  RouteNotFoundException,
  RoutingProviderException,
  RoutingTimeoutException,
  RoutingUnavailableException,
} from '../../routing.errors';

const validResponse = {
  code: 'Ok',
  routes: [
    {
      distance: 350_000,
      duration: 13_000,
      geometry: {
        type: 'LineString',
        coordinates: [
          [2.3522, 48.8566],
          [2.0, 48.5],
          [-1.6778, 48.1173],
        ],
      },
    },
  ],
};

describe('OsrmRoutingProvider', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  function createProvider(baseUrl?: string, timeoutMs = '5000') {
    const configService = {
      get: (key: string) => {
        if (key === 'OSRM_BASE_URL') {
          return baseUrl;
        }
        if (key === 'OSRM_TIMEOUT_MS') {
          return timeoutMs;
        }
        return undefined;
      },
    } as ConfigService;

    return new OsrmRoutingProvider(configService);
  }

  it('throws when OSRM_BASE_URL is missing', async () => {
    const provider = createProvider(undefined);
    await expect(
      provider.route({
        origin: { lat: 48.8566, lon: 2.3522 },
        destination: { lat: 48.1173, lon: -1.6778 },
      }),
    ).rejects.toBeInstanceOf(RoutingUnavailableException);
  });

  it('normalizes a valid OSRM response', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => null },
      arrayBuffer: () =>
        Promise.resolve(Buffer.from(JSON.stringify(validResponse), 'utf-8')),
    }) as typeof fetch;

    const provider = createProvider('http://router.example');
    const result = await provider.route({
      origin: { lat: 48.8566, lon: 2.3522 },
      destination: { lat: 48.1173, lon: -1.6778 },
    });

    expect(result.distanceMeters).toBe(350_000);
    expect(result.durationSeconds).toBe(13_000);
    expect(result.geometry.type).toBe('LineString');
    expect(result.geometry.coordinates[0]).toEqual([2.3522, 48.8566]);
    expect(result.bbox).toBeDefined();
  });

  it('maps NoRoute to RouteNotFoundException', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => null },
      arrayBuffer: () =>
        Promise.resolve(
          Buffer.from(JSON.stringify({ code: 'NoRoute' }), 'utf-8'),
        ),
    }) as typeof fetch;

    const provider = createProvider('http://router.example');
    await expect(
      provider.route({
        origin: { lat: 48.8566, lon: 2.3522 },
        destination: { lat: 48.1173, lon: -1.6778 },
      }),
    ).rejects.toBeInstanceOf(RouteNotFoundException);
  });

  it('maps timeout to RoutingTimeoutException', async () => {
    global.fetch = jest.fn().mockImplementation((_url, init?: RequestInit) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          const error = new Error('Aborted');
          error.name = 'AbortError';
          reject(error);
        });
      });
    }) as typeof fetch;

    const provider = createProvider('http://router.example', '50');
    await expect(
      provider.route({
        origin: { lat: 48.8566, lon: 2.3522 },
        destination: { lat: 48.1173, lon: -1.6778 },
      }),
    ).rejects.toBeInstanceOf(RoutingTimeoutException);
  }, 10_000);

  it('rejects malformed geometry', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => null },
      arrayBuffer: () =>
        Promise.resolve(
          Buffer.from(
            JSON.stringify({
              code: 'Ok',
              routes: [
                {
                  distance: 100,
                  duration: 10,
                  geometry: { type: 'Point', coordinates: [1, 2] },
                },
              ],
            }),
            'utf-8',
          ),
        ),
    }) as typeof fetch;

    const provider = createProvider('http://router.example');
    await expect(
      provider.route({
        origin: { lat: 48.8566, lon: 2.3522 },
        destination: { lat: 48.1173, lon: -1.6778 },
      }),
    ).rejects.toBeInstanceOf(RoutingProviderException);
  });
});
