import type { NormalizedStationRecord } from '../../types/ingestion.types';
import type {
  ProviderNormalizeContext,
  ProviderNormalizeResult,
} from '../fuel-price-provider.interface';
import type { ItalyPriceRow, ItalyStationRow } from './italy.parser';
import {
  isUnsupportedItalyFuel,
  parseItalyCommunicationTimestamp,
  parseItalyCoordinates,
  parseItalyPriceValue,
  parseItalyServiceMode,
  parseItalySnapshotEffectiveAt,
} from './italy.parser';

export interface ItalyNormalizeInput {
  stations: ItalyStationRow[];
  prices: ItalyPriceRow[];
  stationsSkipped: number;
  pricesSkipped: number;
  priceExtractionDate: Date | null;
}

export function normalizeItalyRecords(
  input: ItalyNormalizeInput,
  context: ProviderNormalizeContext,
): ProviderNormalizeResult {
  const stationById = new Map<string, ItalyStationRow>();
  for (const station of input.stations) {
    stationById.set(station.idImpianto.trim(), station);
  }

  const fallbackObservedAt =
    input.priceExtractionDate !== null
      ? parseItalySnapshotEffectiveAt(input.priceExtractionDate)
      : null;

  const grouped = new Map<string, NormalizedStationRecord>();
  const errors: ProviderNormalizeResult['errors'] = [];
  let skipped = input.stationsSkipped + input.pricesSkipped;

  for (const priceRow of input.prices) {
    const externalStationId = priceRow.idImpianto.trim();
    const station = stationById.get(externalStationId);

    if (isUnsupportedItalyFuel(priceRow.descCarburante.trim())) {
      skipped++;
      continue;
    }

    const fuelTypeId = context.fuelAliasMap.get(priceRow.descCarburante.trim());
    if (!fuelTypeId) {
      skipped++;
      errors.push({
        externalRecordId: `${externalStationId}:${priceRow.descCarburante}`,
        errorCode: 'UNKNOWN_FUEL',
        message: `No fuel alias for ${priceRow.descCarburante}`,
      });
      continue;
    }

    const price = parseItalyPriceValue(priceRow.prezzo);
    if (!price) {
      skipped++;
      errors.push({
        externalRecordId: `${externalStationId}:${priceRow.descCarburante}`,
        errorCode: 'INVALID_PRICE',
        message: `Invalid price value: ${priceRow.prezzo}`,
      });
      continue;
    }

    const observedAt =
      (priceRow.dtComu
        ? parseItalyCommunicationTimestamp(priceRow.dtComu)
        : null) ?? fallbackObservedAt;

    if (!observedAt || Number.isNaN(observedAt.getTime())) {
      skipped++;
      errors.push({
        externalRecordId: `${externalStationId}:${priceRow.descCarburante}`,
        errorCode: 'INVALID_TIMESTAMP',
        message: 'Missing or invalid price timestamp',
      });
      continue;
    }

    let record = grouped.get(externalStationId);
    if (!record) {
      const coords = station
        ? parseItalyCoordinates(station.Latitudine, station.Longitudine)
        : null;

      record = {
        externalStationId,
        lat: coords?.lat,
        lon: coords?.lon,
        name: station?.['Nome Impianto']?.trim() || undefined,
        brand: station?.Bandiera?.trim() || undefined,
        addressLine: station?.Indirizzo?.trim() || undefined,
        city: station?.Comune?.trim() || undefined,
        rawMetadata: station
          ? {
              gestore: station.Gestore,
              tipoImpianto: station['Tipo Impianto'],
              provincia: station.Provincia,
            }
          : undefined,
        fuelPrices: [],
      };
      grouped.set(externalStationId, record);
    }

    record.fuelPrices.push({
      externalFuelName: priceRow.descCarburante.trim(),
      fuelTypeId,
      price,
      observedAt,
      serviceMode: parseItalyServiceMode(priceRow.isSelf),
    });
  }

  return {
    stations: [...grouped.values()],
    skipped,
    errors,
  };
}
