import { apiFetch, buildQuery } from '@/lib/api/client';
import type {
  GeocodingSearchQuery,
  GeocodingSearchResponse,
  ReverseGeocodingQuery,
  ReverseGeocodingResponse,
} from '@/lib/api/types';

export async function searchPlaces(
  query: GeocodingSearchQuery,
  signal?: AbortSignal,
): Promise<GeocodingSearchResponse> {
  return apiFetch<GeocodingSearchResponse>(
    `/geocoding/search${buildQuery({
      q: query.q,
      limit: query.limit,
      lat: query.lat,
      lon: query.lon,
      countryCodes: query.countryCodes,
      language: query.language,
    })}`,
    { signal },
  );
}

export async function reverseGeocode(
  query: ReverseGeocodingQuery,
  signal?: AbortSignal,
): Promise<ReverseGeocodingResponse> {
  return apiFetch<ReverseGeocodingResponse>(
    `/geocoding/reverse${buildQuery({
      lat: query.lat,
      lon: query.lon,
      language: query.language,
    })}`,
    { signal },
  );
}
