import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import {
  extractFranceCoordinates,
  formatFrancePrice,
  parseFranceRecord,
  parseFranceTimestamp,
  parseScaledCoordinate,
} from './france.parser';
import { normalizeFranceRecords } from './france.normalizer';

describe('France parser', () => {
  const fixturePath = resolve(
    __dirname,
    '../../../../../test/fixtures/france/instantaneous-small.json',
  );

  it('parses valid official-format fixture records', () => {
    const fixture = JSON.parse(readFileSync(fixturePath, 'utf-8')) as {
      results: unknown[];
    };
    const first = parseFranceRecord(fixture.results[0]);
    expect(first.ok).toBe(true);
    if (first.ok) {
      expect(first.record.id).toBe(75000001);
    }
  });

  it('rejects malformed input', () => {
    const result = parseFranceRecord({ id: 'invalid', gazole_prix: -1 });
    expect(result.ok).toBe(false);
  });

  it('normalizes scaled coordinates', () => {
    expect(parseScaledCoordinate('4885678')).toBeCloseTo(48.85678, 5);
    expect(parseScaledCoordinate('229456')).toBeCloseTo(2.29456, 5);
  });

  it('prefers geom over scaled lat/lon strings', () => {
    const coords = extractFranceCoordinates({
      id: 1,
      geom: { lon: 2.29456, lat: 48.85678 },
      latitude: '9999999',
      longitude: '9999999',
    });
    expect(coords).toEqual({ lon: 2.29456, lat: 48.85678 });
  });

  it('parses upstream timestamps as UTC', () => {
    const ts = parseFranceTimestamp('2026-08-15T10:30:00+00:00');
    expect(ts?.toISOString()).toBe('2026-08-15T10:30:00.000Z');
  });

  it('preserves price precision to 4 decimals', () => {
    expect(formatFrancePrice(1.899)).toBe('1.8990');
  });
});

describe('France normalizer', () => {
  const fuelAliasMap = new Map([
    ['Gazole', 'diesel-id'],
    ['SP95', 'sp95-id'],
    ['SP98', 'sp98-id'],
    ['E10', 'e10-id'],
    ['E85', 'e85-id'],
    ['GPLc', 'lpg-id'],
  ]);

  const context = {
    dataSourceId: 'source-id',
    countryId: 'country-id',
    currencyId: 'eur-id',
    fuelAliasMap,
  };

  it('maps fuel labels to canonical types via aliases', () => {
    const fixture = JSON.parse(
      readFileSync(
        resolve(
          __dirname,
          '../../../../../test/fixtures/france/instantaneous-small.json',
        ),
        'utf-8',
      ),
    ) as { results: unknown[] };

    const result = normalizeFranceRecords(fixture.results, context);
    const paris = result.stations.find(
      (s) => s.externalStationId === '75000001',
    );
    expect(paris).toBeDefined();
    expect(paris!.fuelPrices.map((p) => p.externalFuelName)).toEqual(
      expect.arrayContaining(['Gazole', 'SP95', 'SP98', 'E10']),
    );
    expect(
      paris!.fuelPrices.find((p) => p.externalFuelName === 'Gazole')
        ?.fuelTypeId,
    ).toBe('diesel-id');
    expect(
      paris!.fuelPrices.find((p) => p.externalFuelName === 'E10')?.fuelTypeId,
    ).toBe('e10-id');
  });

  it('skips invalid records while continuing', () => {
    const fixture = JSON.parse(
      readFileSync(
        resolve(
          __dirname,
          '../../../../../test/fixtures/france/instantaneous-small.json',
        ),
        'utf-8',
      ),
    ) as { results: unknown[] };
    const result = normalizeFranceRecords(fixture.results, context);
    expect(result.stations.length).toBe(3);
    expect(result.skipped).toBeGreaterThanOrEqual(1);
    expect(result.errors.some((e) => e.errorCode === 'VALIDATION_FAILED')).toBe(
      true,
    );
  });
});
