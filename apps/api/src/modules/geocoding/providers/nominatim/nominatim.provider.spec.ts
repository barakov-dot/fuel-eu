import { ConfigService } from '@nestjs/config';
import { NominatimGeocodingProvider } from './nominatim.provider';
import {
  GeocodingProviderException,
  GeocodingRateLimitedException,
  GeocodingTimeoutException,
  GeocodingUnavailableException,
} from '../../geocoding.errors';

const cityFixture = [
  {
    place_id: 12345,
    osm_type: 'R',
    osm_id: 7444,
    lat: '48.8566',
    lon: '2.3522',
    display_name: 'Paris, Île-de-France, France',
    name: 'Paris',
    type: 'city',
    category: 'place',
    address: {
      city: 'Paris',
      country: 'France',
      country_code: 'fr',
    },
  },
];

const reverseFixture = {
  place_id: 1,
  lat: '48.8566',
  lon: '2.3522',
  display_name: 'Paris, Île-de-France, France',
  name: 'Paris',
  address: {
    city: 'Paris',
    country: 'France',
    country_code: 'fr',
  },
};

describe('NominatimGeocodingProvider', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  function createProvider(baseUrl?: string, timeoutMs = '5000') {
    const configService = {
      get: (key: string) => {
        if (key === 'NOMINATIM_BASE_URL') {
          return baseUrl;
        }
        if (key === 'NOMINATIM_TIMEOUT_MS') {
          return timeoutMs;
        }
        if (key === 'NOMINATIM_CONTACT_EMAIL') {
          return 'dev@example.com';
        }
        return undefined;
      },
    } as ConfigService;

    return new NominatimGeocodingProvider(configService);
  }

  function mockFetch(body: unknown, status = 200) {
    global.fetch = jest.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      headers: { get: () => null },
      arrayBuffer: () =>
        Promise.resolve(Buffer.from(JSON.stringify(body), 'utf-8')),
    }) as typeof fetch;
  }

  it('throws when base URL is invalid', async () => {
    const provider = createProvider('not-a-url');
    await expect(provider.search({ query: 'Paris' })).rejects.toBeInstanceOf(
      GeocodingUnavailableException,
    );
  });

  it('normalizes search results', async () => {
    mockFetch(cityFixture);
    const provider = createProvider('https://nominatim.example');
    const results = await provider.search({ query: 'Paris', limit: 5 });

    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('nominatim:R:7444');
    expect(results[0].location).toEqual({ lat: 48.8566, lon: 2.3522 });
  });

  it('returns empty array for empty provider response', async () => {
    mockFetch([]);
    const provider = createProvider('https://nominatim.example');
    await expect(provider.search({ query: 'zzzz' })).resolves.toEqual([]);
  });

  it('throws on malformed search response', async () => {
    mockFetch({ invalid: true });
    const provider = createProvider('https://nominatim.example');
    await expect(provider.search({ query: 'Paris' })).rejects.toBeInstanceOf(
      GeocodingProviderException,
    );
  });

  it('handles reverse no-result payload', async () => {
    mockFetch({ error: 'Unable to geocode' });
    const provider = createProvider('https://nominatim.example');
    await expect(provider.reverse({ lat: 0, lon: 0 })).resolves.toBeNull();
  });

  it('normalizes reverse result', async () => {
    mockFetch(reverseFixture);
    const provider = createProvider('https://nominatim.example');
    const result = await provider.reverse({ lat: 48.8566, lon: 2.3522 });
    expect(result?.name).toBe('Paris');
  });

  it('maps timeout to GeocodingTimeoutException', async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValue(
        Object.assign(new Error('aborted'), { name: 'AbortError' }),
      ) as typeof fetch;

    const provider = createProvider('https://nominatim.example', '1');
    await expect(provider.search({ query: 'Paris' })).rejects.toBeInstanceOf(
      GeocodingTimeoutException,
    );
  });

  it('maps HTTP 429 to rate limit exception', async () => {
    mockFetch({ error: 'rate limit' }, 429);
    const provider = createProvider('https://nominatim.example');
    await expect(provider.search({ query: 'Paris' })).rejects.toBeInstanceOf(
      GeocodingRateLimitedException,
    );
  });
});
