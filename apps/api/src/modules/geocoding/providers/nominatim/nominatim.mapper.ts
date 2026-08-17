import type {
  GeocodingAddress,
  GeocodingBoundingBox,
  GeocodingLocation,
  GeocodingResult,
  ReverseGeocodingResult,
} from '../../geocoding-provider.interface';
import type {
  NominatimAddress,
  NominatimReverseResult,
  NominatimSearchResult,
} from './nominatim.types';

function parseCoordinate(value: string | number): number | null {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function pickCity(address?: NominatimAddress): string | null {
  if (!address) {
    return null;
  }
  return (
    address.city ??
    address.town ??
    address.village ??
    address.municipality ??
    address.suburb ??
    null
  );
}

function normalizeAddress(address?: NominatimAddress): GeocodingAddress {
  return {
    country: address?.country ?? null,
    countryCode: address?.country_code?.toLowerCase() ?? null,
    city: pickCity(address),
    postcode: address?.postcode ?? null,
    road: address?.road ?? null,
  };
}

function normalizeBoundingBox(
  boundingbox?: [string, string, string, string],
): GeocodingBoundingBox | null {
  if (!boundingbox) {
    return null;
  }

  const south = Number(boundingbox[0]);
  const north = Number(boundingbox[1]);
  const west = Number(boundingbox[2]);
  const east = Number(boundingbox[3]);

  if (
    !Number.isFinite(south) ||
    !Number.isFinite(north) ||
    !Number.isFinite(west) ||
    !Number.isFinite(east)
  ) {
    return null;
  }

  return { south, north, west, east };
}

function buildFallbackName(
  item: NominatimSearchResult | NominatimReverseResult,
): string {
  if (item.name) {
    return item.name;
  }

  const address = item.address;
  if (address?.road && address.house_number) {
    return `${address.road} ${address.house_number}`;
  }
  if (address?.road) {
    return address.road;
  }

  const city = pickCity(address);
  if (city) {
    return city;
  }

  return item.display_name.split(',')[0]?.trim() || item.display_name;
}

function buildProviderId(item: NominatimSearchResult): string {
  return `nominatim:${item.osm_type}:${item.osm_id}`;
}

function normalizeLocation(
  lat: string | number,
  lon: string | number,
): GeocodingLocation | null {
  const parsedLat = parseCoordinate(lat);
  const parsedLon = parseCoordinate(lon);
  if (parsedLat === null || parsedLon === null) {
    return null;
  }
  return { lat: parsedLat, lon: parsedLon };
}

export function normalizeNominatimSearchResult(
  item: NominatimSearchResult,
): GeocodingResult | null {
  const location = normalizeLocation(item.lat, item.lon);
  if (!location) {
    return null;
  }

  return {
    id: buildProviderId(item),
    name: buildFallbackName(item),
    displayName: item.display_name,
    location,
    type: item.type ?? item.addresstype ?? null,
    category: item.category ?? null,
    address: normalizeAddress(item.address),
    boundingBox: normalizeBoundingBox(item.boundingbox),
  };
}

export function normalizeNominatimReverseResult(
  item: NominatimReverseResult,
): ReverseGeocodingResult | null {
  const location = normalizeLocation(item.lat, item.lon);
  if (!location) {
    return null;
  }

  return {
    name: buildFallbackName(item),
    displayName: item.display_name,
    location,
    address: normalizeAddress(item.address),
  };
}

export function buildViewbox(location: GeocodingLocation, delta = 0.5): string {
  const west = location.lon - delta;
  const east = location.lon + delta;
  const south = location.lat - delta;
  const north = location.lat + delta;
  return `${west},${north},${east},${south}`;
}

export function buildUserAgent(contactEmail?: string): string {
  const base = 'FuelMapEurope/1.0 (+https://github.com/fuelmap-europe)';
  if (contactEmail?.trim()) {
    return `${base} (${contactEmail.trim()})`;
  }
  return base;
}

export function isAllowedBaseUrl(baseUrl: string): boolean {
  try {
    const parsed = new URL(baseUrl);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}
