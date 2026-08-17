import { Injectable } from '@nestjs/common';
import type { SelectedPrice } from './price-selection.service';

export function mapSelectedPriceToApi(
  selected: SelectedPrice,
  now = new Date(),
) {
  const observedAtDate =
    selected.observedAt instanceof Date
      ? selected.observedAt
      : new Date(selected.observedAt);
  const ageSeconds = Math.max(
    0,
    Math.floor((now.getTime() - observedAtDate.getTime()) / 1000),
  );

  return {
    fuelType: {
      id: selected.fuelTypeId,
      code: selected.fuelCode,
      name: selected.fuelNameEn,
    },
    price: selected.price,
    currency: selected.currencyCode,
    observedAt: observedAtDate.toISOString(),
    ageSeconds,
    source: {
      id: selected.dataSourceId,
      code: selected.dataSourceCode,
      name: selected.dataSourceName,
      type: selected.dataSourceType,
    },
    serviceMode: selected.serviceMode ?? 'unknown',
    confidence: selected.confidence,
    ...(selected.verification ? { verification: selected.verification } : {}),
  };
}

export function mapSelectedPriceToLatestApi(selected: SelectedPrice) {
  const observedAtDate =
    selected.observedAt instanceof Date
      ? selected.observedAt
      : new Date(selected.observedAt);

  return {
    id: selected.observationId,
    stationId: selected.stationId,
    fuelTypeId: selected.fuelTypeId,
    fuelCode: selected.fuelCode,
    fuelNameEn: selected.fuelNameEn,
    dataSourceId: selected.dataSourceId,
    dataSourceCode: selected.dataSourceCode,
    price: selected.price,
    currencyId: '',
    currencyCode: selected.currencyCode,
    observedAt: observedAtDate.toISOString(),
    receivedAt:
      selected.receivedAt instanceof Date
        ? selected.receivedAt.toISOString()
        : new Date(selected.receivedAt).toISOString(),
    source: {
      type: selected.dataSourceType,
      name: selected.dataSourceName,
    },
    serviceMode: selected.serviceMode ?? 'unknown',
    confidence: selected.confidence,
    ageSeconds: selected.ageSeconds,
    ...(selected.verification ? { verification: selected.verification } : {}),
  };
}

@Injectable()
export class SelectedPriceMapperService {
  mapForStationList = mapSelectedPriceToApi;
  mapForLatest = mapSelectedPriceToLatestApi;
}
