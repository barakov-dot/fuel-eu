import type {
  ProviderNormalizeContext,
  ProviderNormalizeResult,
  ProviderRecordError,
} from '../fuel-price-provider.interface';
import type {
  NormalizedFuelPrice,
  NormalizedStationRecord,
} from '../../types/ingestion.types';
import {
  formatAustriaPrice,
  parseAustriaPriceAmount,
  type AustriaGasStation,
} from './austria.parser';

function optionalString(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function normalizeAustriaRecords(
  rawRecords: unknown[],
  context: ProviderNormalizeContext,
): ProviderNormalizeResult {
  const stations: NormalizedStationRecord[] = [];
  const errors: ProviderRecordError[] = [];
  let skipped = 0;
  const observedAt = new Date();

  for (const raw of rawRecords) {
    const record = raw as AustriaGasStation;
    const externalStationId = String(record.id);

    if (!record.location?.latitude || !record.location?.longitude) {
      errors.push({
        externalRecordId: externalStationId,
        errorCode: 'MISSING_COORDINATES',
        message: 'Station is missing coordinates',
      });
      skipped += 1;
      continue;
    }

    const fuelPrices: NormalizedFuelPrice[] = [];

    for (const priceEntry of record.prices ?? []) {
      const amount = parseAustriaPriceAmount(priceEntry.amount);
      if (amount === null) {
        continue;
      }

      const fuelTypeId = context.fuelAliasMap.get(priceEntry.fuelType);
      if (!fuelTypeId) {
        errors.push({
          externalRecordId: externalStationId,
          errorCode: 'UNKNOWN_FUEL',
          message: `Unknown fuel label: ${priceEntry.fuelType}`,
        });
        continue;
      }

      fuelPrices.push({
        externalFuelName: priceEntry.fuelType,
        fuelTypeId,
        price: formatAustriaPrice(amount),
        observedAt,
      });
    }

    if (fuelPrices.length === 0) {
      skipped += 1;
      continue;
    }

    stations.push({
      externalStationId,
      lat: record.location.latitude,
      lon: record.location.longitude,
      name: optionalString(record.name),
      addressLine: optionalString(record.location.address),
      postalCode: optionalString(record.location.postalCode),
      city: optionalString(record.location.city),
      rawMetadata: {
        open: record.open,
        distance: record.distance,
        position: record.position,
        priceObservationNote:
          'E-Control API does not expose pump change timestamps; observedAt is FuelMap fetch time.',
      },
      fuelPrices,
    });
  }

  return { stations, skipped, errors };
}
