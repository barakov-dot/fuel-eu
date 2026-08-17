import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  austriaGasStationListSchema,
  formatAustriaPrice,
  parseAustriaPriceAmount,
} from './austria.parser';
import { normalizeAustriaRecords } from './austria.normalizer';

describe('Austria parser', () => {
  it('validates fixture shape', () => {
    const fixturePath = resolve(
      __dirname,
      '../../../../../test/fixtures/austria/vienna-diesel-small.json',
    );
    const parsed = austriaGasStationListSchema.parse(
      JSON.parse(readFileSync(fixturePath, 'utf-8')),
    );
    expect(parsed.length).toBeGreaterThan(0);
    expect(parsed.some((s) => s.prices.length > 0)).toBe(true);
  });

  it('formats and parses prices', () => {
    expect(formatAustriaPrice(1.979)).toBe('1.979');
    expect(parseAustriaPriceAmount(1.979)).toBe(1.979);
    expect(parseAustriaPriceAmount('1.979')).toBeNull();
    expect(parseAustriaPriceAmount(-1)).toBeNull();
  });
});

describe('Austria normalizer', () => {
  const context = {
    dataSourceId: 'source-id',
    countryId: 'country-id',
    currencyId: 'currency-id',
    fuelAliasMap: new Map([
      ['DIE', 'diesel-id'],
      ['SUP', 'sp95-id'],
    ]),
  };

  it('maps stations with diesel prices and skips empty price rows', () => {
    const fixturePath = resolve(
      __dirname,
      '../../../../../test/fixtures/austria/vienna-diesel-small.json',
    );
    const records = austriaGasStationListSchema.parse(
      JSON.parse(readFileSync(fixturePath, 'utf-8')),
    );

    const result = normalizeAustriaRecords(records, context);
    expect(result.stations).toHaveLength(3);
    expect(result.stations.every((s) => s.fuelPrices.length === 1)).toBe(true);
    expect(result.stations[0]?.externalStationId).toBe('1494440');
    expect(result.stations[0]?.fuelPrices[0]?.price).toBe('1.979');
    expect(result.skipped).toBe(1);
  });

  it('is idempotent for unchanged prices on second normalize pass shape', () => {
    const record = austriaGasStationListSchema.parse([
      {
        id: 123,
        name: 'Test',
        location: {
          latitude: 48.2,
          longitude: 16.3,
          address: 'Test 1',
          postalCode: '1010',
          city: 'Wien',
        },
        prices: [{ fuelType: 'DIE', amount: 1.999, label: 'Diesel' }],
      },
    ]);

    const first = normalizeAustriaRecords(record, context);
    const second = normalizeAustriaRecords(record, context);
    expect(first.stations[0]?.fuelPrices[0]?.price).toBe(
      second.stations[0]?.fuelPrices[0]?.price,
    );
  });
});
