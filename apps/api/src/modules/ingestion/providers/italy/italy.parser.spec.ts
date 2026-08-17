import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import {
  parseItalyCommunicationTimestamp,
  parseItalyCoordinates,
  parseItalyExtractionDate,
  parseItalyPriceRow,
  parseItalyPriceValue,
  parseItalyServiceMode,
  parseItalySnapshotEffectiveAt,
  parseItalyStationLine,
  parseItalyStationRow,
} from './italy.parser';
import { normalizeItalyRecords } from './italy.normalizer';

describe('Italy parser', () => {
  const fixtureDir = resolve(__dirname, '../../../../../test/fixtures/italy');
  const stationsFixture = readFileSync(
    resolve(fixtureDir, 'stations-small.csv'),
    'utf-8',
  );
  const pricesFixture = readFileSync(
    resolve(fixtureDir, 'prices-small.csv'),
    'utf-8',
  );

  it('parses pipe-delimited station CSV with extraction header', () => {
    const parsed = parseItalyStationRow(stationsFixture);
    expect(parsed.extractionDate?.toISOString()).toBe(
      '2026-08-16T00:00:00.000Z',
    );
    expect(parsed.rows.length).toBeGreaterThanOrEqual(5);
    expect(parsed.rows[0].idImpianto).toBe('10001');
  });

  it('parses pipe-delimited price CSV with self/served flags', () => {
    const parsed = parseItalyPriceRow(pricesFixture);
    expect(parsed.rows.some((row) => row.isSelf === '1')).toBe(true);
    expect(parsed.rows.some((row) => row.isSelf === '0')).toBe(true);
  });

  it('validates Italy coordinates and rejects 0,0', () => {
    expect(parseItalyCoordinates('41.9028', '12.4964')).toEqual({
      lat: 41.9028,
      lon: 12.4964,
    });
    expect(parseItalyCoordinates('0', '0')).toBeNull();
    expect(parseItalyCoordinates('10', '10')).toBeNull();
  });

  it('parses international decimal prices', () => {
    expect(parseItalyPriceValue('1.899')).toBe('1.8990');
    expect(parseItalyPriceValue('invalid')).toBeNull();
  });

  it('maps isSelf to service mode', () => {
    expect(parseItalyServiceMode('1')).toBe('self');
    expect(parseItalyServiceMode('0')).toBe('served');
  });

  it('parses dtComu communication timestamps', () => {
    const ts = parseItalyCommunicationTimestamp('15/08/2026 07:30:00');
    expect(ts).toBeInstanceOf(Date);
    expect(Number.isNaN(ts!.getTime())).toBe(false);
  });

  it('derives snapshot effective time from extraction date', () => {
    const extraction = parseItalyExtractionDate('Estrazione del 2026-08-16');
    expect(extraction).not.toBeNull();
    const effective = parseItalySnapshotEffectiveAt(extraction!);
    expect(effective).toBeInstanceOf(Date);
  });

  it('parses station lines with embedded pipe characters in address', () => {
    const row = parseItalyStationLine(
      '999|Gest|Brand|Tipo|Nome|Via Roma | 5|Roma|RM|41.900000|12.500000',
    );
    expect(row?.Indirizzo).toBe('Via Roma | 5');
    expect(row?.idImpianto).toBe('999');
  });

  it('normalizes stations with self and served prices separately', () => {
    const stations = parseItalyStationRow(stationsFixture);
    const prices = parseItalyPriceRow(pricesFixture);
    const aliasMap = new Map([
      ['Benzina', 'petrol-id'],
      ['Gasolio', 'diesel-id'],
      ['GPL', 'lpg-id'],
    ]);

    const result = normalizeItalyRecords(
      {
        stations: stations.rows,
        prices: prices.rows,
        stationsSkipped: stations.skipped,
        pricesSkipped: prices.skipped,
        priceExtractionDate: prices.extractionDate,
      },
      {
        dataSourceId: 'source-id',
        countryId: 'country-id',
        currencyId: 'eur-id',
        fuelAliasMap: aliasMap,
      },
    );

    const roma = result.stations.find((s) => s.externalStationId === '10001');
    expect(roma).toBeDefined();
    const benzinaSelf = roma!.fuelPrices.find(
      (p) => p.externalFuelName === 'Benzina' && p.serviceMode === 'self',
    );
    const benzinaServed = roma!.fuelPrices.find(
      (p) => p.externalFuelName === 'Benzina' && p.serviceMode === 'served',
    );
    expect(benzinaSelf?.price).toBe('1.8990');
    expect(benzinaServed?.price).toBe('2.0990');
    expect(result.skipped).toBeGreaterThan(0);
  });
});
