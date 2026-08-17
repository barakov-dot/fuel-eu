import type { FuelType } from '@/lib/api/types';
import { PROMINENT_FUEL_CODES } from '@/lib/i18n/config';

export function splitFuelTypes(fuelTypes: FuelType[]) {
  const prominent: FuelType[] = [];
  const other: FuelType[] = [];

  for (const fuel of fuelTypes) {
    if (PROMINENT_FUEL_CODES.includes(fuel.code as (typeof PROMINENT_FUEL_CODES)[number])) {
      prominent.push(fuel);
    } else {
      other.push(fuel);
    }
  }

  prominent.sort(
    (a, b) =>
      PROMINENT_FUEL_CODES.indexOf(a.code as (typeof PROMINENT_FUEL_CODES)[number]) -
      PROMINENT_FUEL_CODES.indexOf(b.code as (typeof PROMINENT_FUEL_CODES)[number]),
  );

  other.sort((a, b) => a.code.localeCompare(b.code));

  return { prominent, other };
}

export function fuelLabel(fuel: FuelType, locale: string): string {
  if (locale === 'ru' && fuel.nameRu) {
    return fuel.nameRu;
  }
  return fuel.code.toUpperCase();
}

export function findFuelByCode(
  fuelTypes: FuelType[],
  code: string | null | undefined,
): FuelType | undefined {
  if (!code) {
    return undefined;
  }
  return fuelTypes.find((fuel) => fuel.code === code.toLowerCase());
}

export function findPriceForFuel<T extends { fuelType: { id: string } }>(
  prices: T[],
  fuelTypeId?: string,
): T | undefined {
  if (!fuelTypeId) {
    return undefined;
  }
  return prices.find((price) => price.fuelType.id === fuelTypeId);
}

export type MapStation = {
  id: string;
  lat: number;
  lon: number;
  name: string | null;
  brand: string | null;
  priceLabel?: string;
};

export function mergeMapStations(
  nearby: MapStation[],
  bbox: MapStation[],
): MapStation[] {
  const byId = new Map<string, MapStation>();
  for (const station of nearby) {
    byId.set(station.id, station);
  }
  for (const station of bbox) {
    if (!byId.has(station.id)) {
      byId.set(station.id, station);
    }
  }
  return Array.from(byId.values());
}
