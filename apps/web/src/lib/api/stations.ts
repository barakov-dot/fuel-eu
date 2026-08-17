import { apiFetch, buildQuery } from '@/lib/api/client';
import type {
  BboxQuery,
  BboxStationsResponse,
  LatestStationPrice,
  NearbyQuery,
  NearbyStationsResponse,
  PriceHistoryEntry,
  PriceHistoryQuery,
  StationDetail,
} from '@/lib/api/types';

export function fetchNearbyStations(
  query: NearbyQuery,
  signal?: AbortSignal,
): Promise<NearbyStationsResponse> {
  return apiFetch<NearbyStationsResponse>(
    `/stations/nearby${buildQuery({
      lat: query.lat,
      lon: query.lon,
      radiusKm: query.radiusKm,
      limit: query.limit,
      sort: query.sort,
      fuelTypeId: query.fuelTypeId,
      currency: query.currency,
      onlyWithPrice: query.onlyWithPrice,
    })}`,
    { signal },
  );
}

export function fetchBboxStations(
  query: BboxQuery,
  signal?: AbortSignal,
): Promise<BboxStationsResponse> {
  return apiFetch<BboxStationsResponse>(
    `/stations/bbox${buildQuery({
      west: query.west,
      south: query.south,
      east: query.east,
      north: query.north,
      limit: query.limit,
      fuelTypeId: query.fuelTypeId,
      onlyWithPrice: query.onlyWithPrice,
    })}`,
    { signal },
  );
}

export function fetchStation(
  id: string,
  signal?: AbortSignal,
): Promise<StationDetail> {
  return apiFetch<StationDetail>(`/stations/${id}`, { signal });
}

export function fetchStationLatestPrices(
  stationId: string,
  signal?: AbortSignal,
): Promise<LatestStationPrice[]> {
  return apiFetch<LatestStationPrice[]>(
    `/stations/${stationId}/prices/latest`,
    { signal },
  );
}

export function fetchStationPriceHistory(
  stationId: string,
  query: PriceHistoryQuery,
  signal?: AbortSignal,
): Promise<PriceHistoryEntry[]> {
  return apiFetch<PriceHistoryEntry[]>(
    `/stations/${stationId}/prices/history${buildQuery({
      fuelTypeId: query.fuelTypeId,
      from: query.from,
      to: query.to,
      limit: query.limit,
    })}`,
    { signal },
  );
}
