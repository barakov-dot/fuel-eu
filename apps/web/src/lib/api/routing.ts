import { apiFetch } from '@/lib/api/client';
import type {
  RoutePoint,
  RouteResponse,
  RouteStationsQuery,
  RouteStationsResponse,
} from '@/lib/api/types';

export async function fetchRoute(
  body: {
    origin: RoutePoint;
    destination: RoutePoint;
    profile?: 'driving';
  },
  signal?: AbortSignal,
): Promise<RouteResponse> {
  return apiFetch<RouteResponse>('/routes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
}

export async function fetchRouteStations(
  body: RouteStationsQuery,
  signal?: AbortSignal,
): Promise<RouteStationsResponse> {
  return apiFetch<RouteStationsResponse>('/routes/stations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
}
