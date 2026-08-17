import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import {
  buildGermanyAddressLine,
  formatGermanyPrice,
  parseGermanyListResponse,
  parseGermanyListStation,
  parseGermanyPriceValue,
  parseGermanyPricesResponse,
} from './germany.parser';
import { normalizeGermanyRecords } from './germany.normalizer';
import { generateGermanyDiscoveryGrid } from './germany.grid';
import { GermanyRateLimiter } from './germany.rate-limiter';

describe('Germany grid', () => {
  it('generates a nationwide discovery grid', () => {
    const grid = generateGermanyDiscoveryGrid();
    expect(grid.length).toBeGreaterThan(100);
    expect(grid[0]).toHaveProperty('lat');
    expect(grid[0]).toHaveProperty('lng');
  });
});

describe('Germany parser', () => {
  const fixturePath = resolve(
    __dirname,
    '../../../../../test/fixtures/germany/stations-small.json',
  );

  it('parses list response stations from fixture wrapper', () => {
    const fixture = JSON.parse(readFileSync(fixturePath, 'utf-8')) as {
      stations: unknown[];
    };
    const parsed = parseGermanyListResponse({
      ok: true,
      stations: fixture.stations,
    });
    expect(parsed.ok).toBe(true);
  });

  it('rejects malformed top-level list response', () => {
    expect(parseGermanyListResponse({ ok: false }).ok).toBe(false);
    expect(parseGermanyListResponse({ invalid: true }).ok).toBe(false);
  });

  it('parses prices.php response shape', () => {
    const parsed = parseGermanyPricesResponse({
      ok: true,
      prices: {
        '474e5046-deaf-4f9b-9a32-9797b778f047': {
          status: 'open',
          e5: 1.799,
          e10: 1.779,
          diesel: 1.559,
        },
      },
    });
    expect(parsed.ok).toBe(true);
  });

  it('normalizes exact price precision to four decimals', () => {
    expect(formatGermanyPrice(1.789)).toBe('1.7890');
    expect(parseGermanyPriceValue(1.789)).toBe(1.789);
  });

  it('treats false/null/unavailable prices as absent', () => {
    expect(parseGermanyPriceValue(false)).toBeNull();
    expect(parseGermanyPriceValue(0)).toBeNull();
    expect(parseGermanyPriceValue(null)).toBeNull();
  });

  it('combines street and house number', () => {
    expect(buildGermanyAddressLine('MAIN ST', '12')).toBe('MAIN ST 12');
  });

  it('isolates malformed station rows', () => {
    const fixture = JSON.parse(readFileSync(fixturePath, 'utf-8')) as {
      stations: unknown[];
      fetchedAt: string;
    };
    const observedAt = new Date(fixture.fetchedAt);
    const result = normalizeGermanyRecords(
      fixture.stations,
      {
        dataSourceId: 'source-id',
        countryId: 'country-id',
        currencyId: 'eur-id',
        fuelAliasMap: new Map([
          ['e5', 'e5-id'],
          ['e10', 'e10-id'],
          ['diesel', 'diesel-id'],
        ]),
      },
      observedAt,
      'full',
    );

    expect(result.stations.length).toBeGreaterThan(0);
    expect(result.skipped).toBeGreaterThanOrEqual(2);
    expect(
      result.stations.some((s) => s.externalStationId.includes('474e5046')),
    ).toBe(true);
  });

  it('maps E5, E10 and Diesel from list station', () => {
    const parsed = parseGermanyListStation({
      id: '474e5046-deaf-4f9b-9a32-9797b778f047',
      lat: 52.53,
      lng: 13.44,
      e5: 1.799,
      e10: 1.779,
      diesel: 1.559,
    });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      const normalized = normalizeGermanyRecords(
        [parsed.station],
        {
          dataSourceId: 'source-id',
          countryId: 'country-id',
          currencyId: 'eur-id',
          fuelAliasMap: new Map([
            ['e5', 'e5-id'],
            ['e10', 'e10-id'],
            ['diesel', 'diesel-id'],
          ]),
        },
        new Date('2026-08-17T10:00:00.000Z'),
      );
      expect(normalized.stations[0]?.fuelPrices).toHaveLength(3);
      expect(
        normalized.stations[0]?.fuelPrices.map((p) => p.externalFuelName),
      ).toEqual(expect.arrayContaining(['e5', 'e10', 'diesel']));
    }
  });

  it('rate limiter enforces minimum spacing', async () => {
    const limiter = new GermanyRateLimiter(50);
    const first = await limiter.waitForSlot();
    const second = await limiter.waitForSlot();
    expect(first).toBe(0);
    expect(second).toBeGreaterThanOrEqual(40);
  });
});
