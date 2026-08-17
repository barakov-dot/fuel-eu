import {
  buildGermanyAddressLine,
  formatGermanyPrice,
  getGermanyFuelFields,
  parseGermanyListStation,
  parseGermanyPriceValue,
  type GermanyListStation,
  type GermanyPriceEntry,
} from './germany.parser';
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

function normalizeFuelPricesFromListStation(
  record: GermanyListStation,
  context: ProviderNormalizeContext,
  errors: ProviderRecordError[],
  externalId: string,
  observedAt: Date,
): NormalizedFuelPrice[] {
  const prices: NormalizedFuelPrice[] = [];

  for (const fuel of getGermanyFuelFields(record)) {
    const priceValue = parseGermanyPriceValue(fuel.rawValue);
    if (priceValue === null) {
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

    prices.push({
      externalFuelName: fuel.externalName,
      fuelTypeId,
      price: formatGermanyPrice(priceValue),
      observedAt,
    });
  }

  return prices;
}

function normalizeFuelPricesFromPriceEntry(
  entry: GermanyPriceEntry,
  context: ProviderNormalizeContext,
  errors: ProviderRecordError[],
  externalId: string,
  observedAt: Date,
): NormalizedFuelPrice[] {
  const prices: NormalizedFuelPrice[] = [];

  for (const fuel of getGermanyFuelFields(entry)) {
    const priceValue = parseGermanyPriceValue(fuel.rawValue);
    if (priceValue === null) {
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

    prices.push({
      externalFuelName: fuel.externalName,
      fuelTypeId,
      price: formatGermanyPrice(priceValue),
      observedAt,
    });
  }

  return prices;
}

function buildStationName(record: GermanyListStation): string | undefined {
  const name = optionalString(record.name);
  if (name) {
    return name.slice(0, 200);
  }
  const brand = optionalString(record.brand);
  if (brand) {
    return brand.slice(0, 200);
  }
  return undefined;
}

export function normalizeGermanyListRecords(
  rawRecords: unknown[],
  context: ProviderNormalizeContext,
  observedAt: Date,
): ProviderNormalizeResult {
  const stations: NormalizedStationRecord[] = [];
  const errors: ProviderRecordError[] = [];
  let skipped = 0;

  for (const raw of rawRecords) {
    const parsed = parseGermanyListStation(raw);
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

    const record = parsed.station;
    const externalStationId = record.id;

    if (
      !Number.isFinite(record.lat) ||
      !Number.isFinite(record.lng) ||
      record.lat < -90 ||
      record.lat > 90 ||
      record.lng < -180 ||
      record.lng > 180
    ) {
      skipped++;
      errors.push({
        externalRecordId: externalStationId,
        errorCode: 'INVALID_COORDINATES',
        message: 'Invalid or missing coordinates',
      });
      continue;
    }

    const fuelPrices = normalizeFuelPricesFromListStation(
      record,
      context,
      errors,
      externalStationId,
      observedAt,
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
      lon: record.lng,
      lat: record.lat,
      addressLine: buildGermanyAddressLine(record.street, record.houseNumber),
      postalCode:
        record.postCode !== undefined ? String(record.postCode) : undefined,
      city: optionalString(record.place),
      brand: optionalString(record.brand),
      name: buildStationName(record),
      rawMetadata: {
        isOpen: record.isOpen,
        street: record.street,
        houseNumber: record.houseNumber,
        upstreamData: 'MTS-K',
      },
      fuelPrices,
    });
  }

  return { stations, skipped, errors };
}

export function normalizeGermanyPriceRecords(
  rawRecords: unknown[],
  context: ProviderNormalizeContext,
  observedAt: Date,
): ProviderNormalizeResult {
  const stations: NormalizedStationRecord[] = [];
  const errors: ProviderRecordError[] = [];
  let skipped = 0;

  for (const raw of rawRecords) {
    if (
      typeof raw !== 'object' ||
      raw === null ||
      !('id' in raw) ||
      typeof raw.id !== 'string'
    ) {
      skipped++;
      errors.push({
        errorCode: 'VALIDATION_FAILED',
        message: 'Price record missing station id',
      });
      continue;
    }

    const record = raw as {
      id: string;
      status?: string;
      diesel?: unknown;
      e5?: unknown;
      e10?: unknown;
    };
    const externalStationId = record.id;

    const entry: GermanyPriceEntry = {
      status:
        record.status === 'closed' ||
        record.status === 'no prices' ||
        record.status === 'open'
          ? record.status
          : 'open',
      diesel: record.diesel as GermanyPriceEntry['diesel'],
      e5: record.e5 as GermanyPriceEntry['e5'],
      e10: record.e10 as GermanyPriceEntry['e10'],
    };

    const fuelPrices = normalizeFuelPricesFromPriceEntry(
      entry,
      context,
      errors,
      externalStationId,
      observedAt,
    );

    if (fuelPrices.length === 0) {
      skipped++;
      continue;
    }

    stations.push({
      externalStationId,
      priceUpdateOnly: true,
      rawMetadata: {
        status: entry.status,
        upstreamData: 'MTS-K',
      },
      fuelPrices,
    });
  }

  return { stations, skipped, errors };
}

export function normalizeGermanyRecords(
  rawRecords: unknown[],
  context: ProviderNormalizeContext,
  observedAt: Date,
  syncMode: 'full' | 'prices' = 'full',
): ProviderNormalizeResult {
  if (syncMode === 'prices') {
    return normalizeGermanyPriceRecords(rawRecords, context, observedAt);
  }
  return normalizeGermanyListRecords(rawRecords, context, observedAt);
}
