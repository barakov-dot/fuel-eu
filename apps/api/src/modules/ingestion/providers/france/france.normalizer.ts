import { FRANCE_FUEL_COLUMNS } from './france.constants';
import {
  extractFranceCoordinates,
  formatFrancePrice,
  parseFranceRecord,
  parseFranceTimestamp,
  type FranceRawRecord,
} from './france.parser';
import type {
  ProviderNormalizeContext,
  ProviderNormalizeResult,
  ProviderRecordError,
} from '../fuel-price-provider.interface';
import type {
  NormalizedFuelPrice,
  NormalizedStationRecord,
} from '../../types/ingestion.types';

function buildStationName(record: FranceRawRecord): string | undefined {
  const parts = [record.adresse, record.ville].filter(Boolean);
  if (parts.length === 0) {
    return undefined;
  }
  return parts.join(', ').slice(0, 200);
}

function normalizeFuelPrices(
  record: FranceRawRecord,
  context: ProviderNormalizeContext,
  errors: ProviderRecordError[],
  externalId: string,
): NormalizedFuelPrice[] {
  const prices: NormalizedFuelPrice[] = [];

  for (const fuel of FRANCE_FUEL_COLUMNS) {
    const priceKey = `${fuel.column}_prix` as keyof FranceRawRecord;
    const majKey = `${fuel.column}_maj` as keyof FranceRawRecord;
    const priceValue = record[priceKey];
    const majValue = record[majKey];

    if (
      priceValue === null ||
      priceValue === undefined ||
      typeof priceValue !== 'number'
    ) {
      continue;
    }

    const fuelTypeId = context.fuelAliasMap.get(fuel.externalName);
    if (!fuelTypeId) {
      errors.push({
        externalRecordId: externalId,
        errorCode: 'UNKNOWN_FUEL',
        message: `Unknown fuel label: ${fuel.externalName}`,
      });
      continue;
    }

    const observedAt = parseFranceTimestamp(
      typeof majValue === 'string' ? majValue : null,
    );
    if (!observedAt) {
      errors.push({
        externalRecordId: externalId,
        errorCode: 'INVALID_TIMESTAMP',
        message: `Missing or invalid timestamp for ${fuel.externalName}`,
      });
      continue;
    }

    prices.push({
      externalFuelName: fuel.externalName,
      fuelTypeId,
      price: formatFrancePrice(priceValue),
      observedAt,
    });
  }

  return prices;
}

export function normalizeFranceRecords(
  rawRecords: unknown[],
  context: ProviderNormalizeContext,
): ProviderNormalizeResult {
  const stations: NormalizedStationRecord[] = [];
  const errors: ProviderRecordError[] = [];
  let skipped = 0;

  for (const raw of rawRecords) {
    const parsed = parseFranceRecord(raw);
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
    const coords = extractFranceCoordinates(record);

    if (!coords) {
      skipped++;
      errors.push({
        externalRecordId: externalStationId,
        errorCode: 'INVALID_COORDINATES',
        message: 'Invalid or missing coordinates',
      });
      continue;
    }

    const fuelPrices = normalizeFuelPrices(
      record,
      context,
      errors,
      externalStationId,
    );

    if (fuelPrices.length === 0) {
      skipped++;
      errors.push({
        externalRecordId: externalStationId,
        errorCode: 'NO_PRICES',
        message: 'No valid fuel prices in record',
      });
      continue;
    }

    stations.push({
      externalStationId,
      lon: coords.lon,
      lat: coords.lat,
      addressLine: record.adresse ?? undefined,
      postalCode: record.cp ?? undefined,
      city: record.ville ?? undefined,
      name: buildStationName(record),
      rawMetadata: {
        pop: record.pop ?? undefined,
        departement: record.departement ?? undefined,
        region: record.region ?? undefined,
        services: record.services_service ?? undefined,
        carburants_disponibles: record.carburants_disponibles ?? undefined,
      },
      fuelPrices,
    });
  }

  return { stations, skipped, errors };
}
