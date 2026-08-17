import {
  extractCroatiaCoordinates,
  formatCroatiaPrice,
  getCroatiaStationPrices,
  parseCroatiaStation,
  type CroatiaRawStation,
} from './croatia.parser';
import type {
  ProviderNormalizeContext,
  ProviderNormalizeResult,
  ProviderRecordError,
} from '../fuel-price-provider.interface';
import type {
  NormalizedFuelPrice,
  NormalizedStationRecord,
} from '../../types/ingestion.types';

function optionalString(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeFuelPrices(
  record: CroatiaRawStation,
  context: ProviderNormalizeContext,
  errors: ProviderRecordError[],
  externalId: string,
  observedAt: Date,
  gorivoToVrstaName: Map<number, string>,
): NormalizedFuelPrice[] {
  const prices: NormalizedFuelPrice[] = [];

  for (const fuel of getCroatiaStationPrices(record, gorivoToVrstaName)) {
    const fuelTypeId = context.fuelAliasMap.get(fuel.externalName);
    if (!fuelTypeId) {
      continue;
    }

    prices.push({
      externalFuelName: fuel.externalName,
      fuelTypeId,
      price: formatCroatiaPrice(fuel.rawValue),
      observedAt,
    });
  }

  return prices;
}

export function normalizeCroatiaRecords(
  rawRecords: unknown[],
  context: ProviderNormalizeContext,
  fetchedAt: Date,
  gorivoToVrstaName: Map<number, string>,
  brandMap: Map<number, string>,
): ProviderNormalizeResult {
  const stations: NormalizedStationRecord[] = [];
  const errors: ProviderRecordError[] = [];
  let skipped = 0;

  for (const raw of rawRecords) {
    const parsed = parseCroatiaStation(raw);
    if (!parsed.ok) {
      skipped++;
      errors.push({
        errorCode: 'VALIDATION_FAILED',
        message: parsed.message,
        rawPayload:
          typeof raw === 'object' && raw !== null
            ? (raw as Record<string, unknown>)
            : { value: raw },
      });
      continue;
    }

    const record = parsed.record;
    const externalStationId = String(record.id);
    const coords = extractCroatiaCoordinates(record);

    if (!coords) {
      skipped++;
      errors.push({
        externalRecordId: externalStationId,
        errorCode: 'INVALID_COORDINATES',
        message:
          'Invalid or out-of-bounds coordinates (note: lat/long fields are swapped in source)',
      });
      continue;
    }

    const fuelPrices = normalizeFuelPrices(
      record,
      context,
      errors,
      externalStationId,
      fetchedAt,
      gorivoToVrstaName,
    );

    if (fuelPrices.length === 0) {
      skipped++;
      errors.push({
        externalRecordId: externalStationId,
        errorCode: 'NO_PRICES',
        message: 'No valid road fuel prices in record',
      });
      continue;
    }

    const brand =
      record.obveznik_id != null ? brandMap.get(record.obveznik_id) : undefined;

    stations.push({
      externalStationId,
      lon: coords.lon,
      lat: coords.lat,
      addressLine: optionalString(record.adresa),
      city: optionalString(record.mjesto),
      brand: optionalString(brand),
      name: optionalString(record.naziv)?.slice(0, 200),
      rawMetadata: {
        obveznik_id: record.obveznik_id ?? undefined,
      },
      fuelPrices,
    });
  }

  return { stations, skipped, errors };
}
