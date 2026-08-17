import {
  extractSpainCoordinates,
  formatSpainPrice,
  getSpainPriceFields,
  parseSpainPrice,
  parseSpainStation,
  type SpainRawStation,
} from './spain.parser';
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

function buildStationName(record: SpainRawStation): string | undefined {
  const rotulo = optionalString(record.Rótulo);
  if (rotulo) {
    return rotulo.slice(0, 200);
  }
  const address = optionalString(record.Dirección);
  if (address) {
    return address.slice(0, 200);
  }
  return undefined;
}

function normalizeFuelPrices(
  record: SpainRawStation,
  context: ProviderNormalizeContext,
  errors: ProviderRecordError[],
  externalId: string,
  observedAt: Date,
): NormalizedFuelPrice[] {
  const prices: NormalizedFuelPrice[] = [];

  for (const fuel of getSpainPriceFields(record)) {
    const priceValue = parseSpainPrice(fuel.rawValue);
    if (priceValue === null) {
      errors.push({
        externalRecordId: externalId,
        errorCode: 'INVALID_PRICE',
        message: `Invalid price for ${fuel.externalName}: ${fuel.rawValue}`,
      });
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
      price: formatSpainPrice(priceValue),
      observedAt,
    });
  }

  return prices;
}

export function normalizeSpainRecords(
  rawRecords: unknown[],
  context: ProviderNormalizeContext,
  feedObservedAt: Date,
): ProviderNormalizeResult {
  const stations: NormalizedStationRecord[] = [];
  const errors: ProviderRecordError[] = [];
  let skipped = 0;

  for (const raw of rawRecords) {
    const parsed = parseSpainStation(raw);
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
    const externalStationId = String(record.IDEESS);
    const coords = extractSpainCoordinates(record);

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
      feedObservedAt,
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
      addressLine: optionalString(record.Dirección),
      postalCode: optionalString(record['C.P.']),
      city: optionalString(record.Municipio ?? record.Localidad),
      brand: optionalString(record.Rótulo),
      name: buildStationName(record),
      rawMetadata: {
        localidad: record.Localidad ?? undefined,
        provincia: record.Provincia ?? undefined,
        horario: record.Horario ?? undefined,
        tipo_venta: record['Tipo Venta'] ?? undefined,
        margen: record.Margen ?? undefined,
        remision: record.Remisión ?? undefined,
        id_municipio: record.IDMunicipio ?? undefined,
        id_provincia: record.IDProvincia ?? undefined,
        id_ccaa: record.IDCCAA ?? undefined,
      },
      fuelPrices,
    });
  }

  return { stations, skipped, errors };
}
