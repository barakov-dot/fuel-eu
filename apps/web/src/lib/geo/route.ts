import type { RoutePoint } from '@/lib/api/types';

const COORD_PAIR = /^(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)$/;

export function parseCoordinatePair(value: string | null): RoutePoint | null {
  if (!value) {
    return null;
  }

  const match = value.trim().match(COORD_PAIR);
  if (!match) {
    return null;
  }

  const lat = Number(match[1]);
  const lon = Number(match[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return null;
  }
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return null;
  }

  return { lat, lon };
}

export function formatCoordinatePair(point: RoutePoint): string {
  return `${point.lat.toFixed(6)},${point.lon.toFixed(6)}`;
}

export function formatRoutePointLabel(point: RoutePoint): string {
  return point.label ?? formatCoordinatePair(point);
}

const MAX_URL_LABEL_LENGTH = 80;

export function encodeRouteLabel(label: string | undefined): string | null {
  if (!label) {
    return null;
  }
  const trimmed = label.trim();
  if (!trimmed || trimmed.length > MAX_URL_LABEL_LENGTH) {
    return null;
  }
  return trimmed;
}

export function parseRouteLabel(value: string | null): string | undefined {
  if (!value) {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

export function parseLatLonParams(
  latValue: string | null,
  lonValue: string | null,
): RoutePoint | null {
  if (!latValue || !lonValue) {
    return null;
  }

  const lat = Number(latValue);
  const lon = Number(lonValue);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return null;
  }
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return null;
  }

  return { lat, lon };
}

export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  if (hours <= 0) {
    return `${minutes} min`;
  }
  return `${hours} h ${minutes} min`;
}
