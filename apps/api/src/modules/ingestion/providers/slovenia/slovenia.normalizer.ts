import {
  extractSloveniaCoordinates,
  formatSloveniaPrice,
  getSloveniaPriceFields,
  parseSloveniaStation,
  type SloveniaRawStation,
} from './slovenia.parser';
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

function resolveBrand(
  record: SloveniaRawStation,
  franchises: Map<number, string>,
): string | undefined {
  if (record.franchise == null) {
    return undefined;
  }
  return franchises.get(record.franchise);
}

function normalizeFuelPrices(
  record: SloveniaRawStation,
  context: ProviderNormalizeContext,
  errors: ProviderRecordError[],
  externalId: string,
  observedAt: Date,
): NormalizedFuelPrice[] {
  const prices: NormalizedFuelPrice[] = [];

  for (const fuel of getSloveniaPriceFields(record)) {
    const fuelTypeId = context.fuelAliasMap.get(fuel.externalName);
    if (!fuelTypeId) {
      errors.push({
        externalRecordId: externalId,
        errorCode: 'UNKNOWN_FUEL',
        message: `Unknown fuel label: ${fuel.externalName}`,
      });
      continue;
    }

    prices.push({
      externalFuelName: fuel.externalName,
      fuelTypeId,
      price: formatSloveniaPrice(fuel.rawValue),
      observedAt,
    });
  }

  return prices;
}

export function normalizeSloveniaRecords(
  rawRecords: unknown[],
  context: ProviderNormalizeContext,
  fetchedAt: Date,
  franchises: Map<number, string>,
): ProviderNormalizeResult {
  const stations: NormalizedStationRecord[] = [];
  const errors: ProviderRecordError[] = [];
  let skipped = 0;

  for (const raw of rawRecords) {
    const parsed = parseSloveniaStation(raw);
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
    const externalStationId = String(record.pk);
    const coords = extractSloveniaCoordinates(record);

    if (!coords) {
      skipped++;
      errors.push({
        externalRecordId: externalStationId,
        errorCode: 'INVALID_COORDINATES',
        message: 'Invalid or out-of-bounds coordinates',
      });
      continue;
    }

    const fuelPrices = normalizeFuelPrices(
      record,
      context,
      errors,
      externalStationId,
      fetchedAt,
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

    stations.push({
      externalStationId,
      lon: coords.lon,
      lat: coords.lat,
      addressLine: optionalString(record.address),
      postalCode: optionalString(record.zip_code),
      brand: resolveBrand(record, franchises),
      name: optionalString(record.name)?.slice(0, 200),
      rawMetadata: {
        franchise_id: record.franchise ?? undefined,
        open_hours: record.open_hours ?? undefined,
      },
      fuelPrices,
    });
  }

  return { stations, skipped, errors };
}
