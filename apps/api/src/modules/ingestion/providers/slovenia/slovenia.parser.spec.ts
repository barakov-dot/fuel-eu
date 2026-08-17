import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import {
  extractSloveniaCoordinates,
  getSloveniaPriceFields,
  parseSloveniaSearchResponse,
  parseSloveniaStation,
} from './slovenia.parser';
import { normalizeSloveniaRecords } from './slovenia.normalizer';
import { SLOVENIA_FUEL_ALIASES } from './slovenia.constants';

describe('Slovenia parser', () => {
  const fixturePath = resolve(
    __dirname,
    '../../../../../test/fixtures/slovenia/search-small.json',
  );

  const fuelAliasMap = new Map(
    SLOVENIA_FUEL_ALIASES.map((a, i) => [a.externalName, `fuel-${i}`]),
  );

  const franchises = new Map<number, string>([
    [1, 'Petrol d.d., Ljubljana'],
    [2, 'MOL & INA d.o.o.'],
  ]);

  it('parses fixture stations with Slovenian Unicode', () => {
    const fixture = JSON.parse(readFileSync(fixturePath, 'utf-8')) as {
      results: unknown[];
    };
    const station = parseSloveniaStation(fixture.results[1]);
    expect(station.ok).toBe(true);
    if (station.ok) {
      expect(station.record.name).toContain('ŠMARTINSKA');
    }
  });

  it('extracts Ljubljana coordinates within Slovenia bounds', () => {
    const fixture = JSON.parse(readFileSync(fixturePath, 'utf-8')) as {
      results: unknown[];
    };
    const parsed = parseSloveniaStation(fixture.results[0]);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      const coords = extractSloveniaCoordinates(parsed.record);
      expect(coords).not.toBeNull();
      expect(coords!.lat).toBeCloseTo(46.0569, 2);
      expect(coords!.lon).toBeCloseTo(14.5058, 2);
    }
  });

  it('excludes heating oil KOEL from road fuel fields', () => {
    const fixture = JSON.parse(readFileSync(fixturePath, 'utf-8')) as {
      results: unknown[];
    };
    const parsed = parseSloveniaStation(fixture.results[1]);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      const fields = getSloveniaPriceFields(parsed.record);
      expect(fields.find((f) => f.externalName === 'NMB-95')).toBeDefined();
      expect(
        fields.find((f) => f.externalName.includes('KOEL')),
      ).toBeUndefined();
    }
  });

  it('rejects 0,0 coordinates', () => {
    const fixture = JSON.parse(readFileSync(fixturePath, 'utf-8')) as {
      results: unknown[];
    };
    const parsed = parseSloveniaStation(fixture.results[3]);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(extractSloveniaCoordinates(parsed.record)).toBeNull();
    }
  });

  it('normalizes valid stations and skips closed/malformed rows', () => {
    const fixture = JSON.parse(readFileSync(fixturePath, 'utf-8')) as {
      results: unknown[];
      fetchedAt: string;
    };
    const result = normalizeSloveniaRecords(
      fixture.results,
      {
        dataSourceId: 'source-id',
        countryId: 'country-id',
        currencyId: 'eur-id',
        fuelAliasMap,
      },
      new Date(fixture.fetchedAt),
      franchises,
    );
    expect(result.stations.length).toBe(2);
    expect(result.skipped).toBeGreaterThanOrEqual(2);
  });

  it('uses stable pk as external station id', () => {
    const fixture = JSON.parse(readFileSync(fixturePath, 'utf-8')) as {
      results: unknown[];
      fetchedAt: string;
    };
    const result = normalizeSloveniaRecords(
      fixture.results,
      {
        dataSourceId: 'source-id',
        countryId: 'country-id',
        currencyId: 'eur-id',
        fuelAliasMap,
      },
      new Date(fixture.fetchedAt),
      franchises,
    );
    expect(result.stations[0].externalStationId).toBe('2048');
  });

  it('parses paginated search response schema', () => {
    const response = parseSloveniaSearchResponse({
      count: 2,
      next: null,
      previous: null,
      results: [],
    });
    expect(response.ok).toBe(true);
  });
});
