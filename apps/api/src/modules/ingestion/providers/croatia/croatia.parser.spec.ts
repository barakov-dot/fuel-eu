import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import {
  extractCroatiaCoordinates,
  parseCroatiaFeed,
  parseCroatiaStation,
} from './croatia.parser';
import { normalizeCroatiaRecords } from './croatia.normalizer';
import { CROATIA_FUEL_ALIASES } from './croatia.constants';

describe('Croatia parser', () => {
  const fixturePath = resolve(
    __dirname,
    '../../../../../test/fixtures/croatia/data-small.json',
  );

  const fuelAliasMap = new Map(
    CROATIA_FUEL_ALIASES.map((a, i) => [a.externalName, `fuel-${i}`]),
  );

  it('parses fixture feed with lookup tables', () => {
    const fixture = JSON.parse(readFileSync(fixturePath, 'utf-8')) as unknown;
    const parsed = parseCroatiaFeed(fixture);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.feed.stations.length).toBe(4);
      expect(parsed.feed.gorivoToVrstaName.size).toBeGreaterThan(0);
    }
  });

  it('corrects swapped lat/long fields for Zagreb', () => {
    const fixture = JSON.parse(readFileSync(fixturePath, 'utf-8')) as unknown;
    const parsed = parseCroatiaFeed(fixture);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      const coords = extractCroatiaCoordinates(parsed.feed.stations[0]);
      expect(coords).not.toBeNull();
      expect(coords!.lat).toBeCloseTo(45.815, 3);
      expect(coords!.lon).toBeCloseTo(15.9819, 3);
    }
  });

  it('excludes heating oil from road fuel normalization', () => {
    const fixture = JSON.parse(readFileSync(fixturePath, 'utf-8')) as unknown;
    const parsed = parseCroatiaFeed(fixture);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      const fetchedAt = new Date('2026-08-17T12:00:00.000Z');
      const result = normalizeCroatiaRecords(
        parsed.feed.stations,
        {
          dataSourceId: 'source-id',
          countryId: 'country-id',
          currencyId: 'eur-id',
          fuelAliasMap,
        },
        fetchedAt,
        parsed.feed.gorivoToVrstaName,
        parsed.feed.brandMap,
      );
      const zagreb = result.stations.find((s) => s.externalStationId === '101');
      expect(zagreb).toBeDefined();
      expect(zagreb!.fuelPrices.length).toBe(2);
      expect(
        zagreb!.fuelPrices.some((p) =>
          p.externalFuelName.includes('Plinsko ulje'),
        ),
      ).toBe(false);
    }
  });

  it('preserves Croatian Unicode station names', () => {
    const fixture = JSON.parse(readFileSync(fixturePath, 'utf-8')) as unknown;
    const parsed = parseCroatiaFeed(fixture);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      const station = parseCroatiaStation(parsed.feed.stations[1]);
      expect(station.ok).toBe(true);
      if (station.ok) {
        expect(station.record.adresa).toContain('Jelačića');
      }
    }
  });

  it('skips stations with no road fuel prices', () => {
    const fixture = JSON.parse(readFileSync(fixturePath, 'utf-8')) as unknown;
    const parsed = parseCroatiaFeed(fixture);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      const fetchedAt = new Date('2026-08-17T12:00:00.000Z');
      const result = normalizeCroatiaRecords(
        parsed.feed.stations,
        {
          dataSourceId: 'source-id',
          countryId: 'country-id',
          currencyId: 'eur-id',
          fuelAliasMap,
        },
        fetchedAt,
        parsed.feed.gorivoToVrstaName,
        parsed.feed.brandMap,
      );
      expect(result.stations.length).toBe(2);
      expect(result.skipped).toBeGreaterThanOrEqual(2);
    }
  });

  it('uses official station id from source', () => {
    const fixture = JSON.parse(readFileSync(fixturePath, 'utf-8')) as unknown;
    const parsed = parseCroatiaFeed(fixture);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.feed.stations[0].id).toBe(101);
    }
  });
});
