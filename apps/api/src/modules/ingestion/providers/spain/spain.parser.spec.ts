import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import {
  extractSpainCoordinates,
  formatSpainPrice,
  parseSpainFeedTimestamp,
  parseSpainPrice,
  parseSpainResponse,
  parseSpainStation,
} from './spain.parser';
import { normalizeSpainRecords } from './spain.normalizer';
import { parseLocaleDecimal } from '../../utils/locale-decimal';
import { parseSpainLocalTimestamp } from '../../utils/spain-timestamp';

describe('locale decimal', () => {
  it('parses comma decimal prices correctly', () => {
    expect(parseLocaleDecimal('1,679')).toBeCloseTo(1.679, 4);
    expect(parseLocaleDecimal('-3,7038')).toBeCloseTo(-3.7038, 4);
  });

  it('rejects invalid numbers', () => {
    expect(parseLocaleDecimal('abc')).toBeNull();
    expect(parseLocaleDecimal('1,2,3')).toBeNull();
  });
});

describe('Spain timestamp', () => {
  it('interprets summer feed timestamp as CEST (UTC+2)', () => {
    const ts = parseSpainLocalTimestamp('17/08/2026 17:08:58');
    expect(ts?.toISOString()).toBe('2026-08-17T15:08:58.000Z');
  });

  it('interprets winter feed timestamp as CET (UTC+1)', () => {
    const ts = parseSpainLocalTimestamp('17/01/2026 12:00:00');
    expect(ts?.toISOString()).toBe('2026-01-17T11:00:00.000Z');
  });
});

describe('Spain parser', () => {
  const fixturePath = resolve(
    __dirname,
    '../../../../../test/fixtures/spain/terrestrial-small.json',
  );

  it('parses current official-format fixture response', () => {
    const fixture = JSON.parse(readFileSync(fixturePath, 'utf-8')) as unknown;
    const parsed = parseSpainResponse(fixture);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.response.ListaEESSPrecio.length).toBeGreaterThan(0);
    }
  });

  it('rejects malformed top-level response', () => {
    const result = parseSpainResponse({ invalid: true });
    expect(result.ok).toBe(false);
  });

  it('isolates malformed individual station rows', () => {
    const fixture = JSON.parse(readFileSync(fixturePath, 'utf-8')) as {
      ListaEESSPrecio: unknown[];
      Fecha: string;
    };
    const feedTs = parseSpainFeedTimestamp(fixture.Fecha)!;
    const result = normalizeSpainRecords(
      fixture.ListaEESSPrecio,
      {
        dataSourceId: 'source-id',
        countryId: 'country-id',
        currencyId: 'eur-id',
        fuelAliasMap: new Map([['Gasoleo A', 'diesel-id']]),
      },
      feedTs,
    );
    expect(result.stations.length).toBeGreaterThan(0);
    expect(result.skipped).toBeGreaterThanOrEqual(1);
  });

  it('normalizes comma decimal coordinates including negative longitude', () => {
    const coords = extractSpainCoordinates({
      IDEESS: '1',
      Latitud: '40,416800',
      'Longitud (WGS84)': '-3,703800',
    });
    expect(coords).toEqual({ lat: 40.4168, lon: -3.7038 });
  });

  it('parses comma decimal prices', () => {
    expect(parseSpainPrice('1,679')).toBeCloseTo(1.679, 4);
    expect(formatSpainPrice(1.679)).toBe('1.6790');
  });

  it('rejects invalid station rows', () => {
    const result = parseSpainStation({
      IDEESS: '',
      Latitud: 'invalid',
      'Longitud (WGS84)': 'invalid',
    });
    expect(result.ok).toBe(false);
  });
});

describe('Spain normalizer', () => {
  const fuelAliasMap = new Map([
    ['Gasoleo A', 'diesel-id'],
    ['Gasolina 95 E5', 'e5-id'],
    ['Gasolina 98 E5', 'sp98-id'],
    ['Gases licuados del petróleo', 'lpg-id'],
  ]);

  const context = {
    dataSourceId: 'source-id',
    countryId: 'country-id',
    currencyId: 'eur-id',
    fuelAliasMap,
  };

  it('maps known fuel aliases and handles unknown fuels explicitly', () => {
    const fixture = JSON.parse(
      readFileSync(
        resolve(
          __dirname,
          '../../../../../test/fixtures/spain/terrestrial-small.json',
        ),
        'utf-8',
      ),
    ) as { ListaEESSPrecio: unknown[]; Fecha: string };

    const feedTs = parseSpainFeedTimestamp(fixture.Fecha)!;
    const result = normalizeSpainRecords(
      fixture.ListaEESSPrecio,
      context,
      feedTs,
    );

    const station = result.stations.find((s) => s.externalStationId !== '');
    expect(station).toBeDefined();
    expect(
      station!.fuelPrices.some((p) => p.externalFuelName === 'Gasoleo A'),
    ).toBe(true);
    expect(result.errors.some((e) => e.errorCode === 'VALIDATION_FAILED')).toBe(
      true,
    );
  });

  it('preserves metadata without erasing on blank upstream fields', () => {
    const feedTs = parseSpainFeedTimestamp('17/08/2026 17:08:58')!;
    const record = {
      IDEESS: '9999',
      Latitud: '40,416800',
      'Longitud (WGS84)': '-3,703800',
      Dirección: 'CALLE TEST 1',
      Municipio: 'Madrid',
      Provincia: 'MADRID',
      Rótulo: 'REPSOL',
      'Precio Gasoleo A': '1,679',
      'Precio Gasolina 95 E5': '1,599',
    };

    const first = normalizeSpainRecords([record], context, feedTs);
    expect(first.stations[0]?.brand).toBe('REPSOL');

    const second = normalizeSpainRecords(
      [{ ...record, Rótulo: '', Dirección: '' }],
      context,
      feedTs,
    );
    expect(second.stations[0]?.brand).toBeUndefined();
    expect(second.stations[0]?.addressLine).toBeUndefined();
  });
});
