import type {
  RouteCoordinate,
  RouteRequest,
  RouteResult,
  RoutingProvider,
} from '../../routing-provider.interface';

const ROAD_FACTOR = 1.35;
const AVERAGE_SPEED_MPS = 15;

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function haversineMeters(a: RouteCoordinate, b: RouteCoordinate): number {
  const earthRadius = 6_371_000;
  const dLat = toRadians(b.lat - a.lat);
  const dLon = toRadians(b.lon - a.lon);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;

  return 2 * earthRadius * Math.asin(Math.min(1, Math.sqrt(h)));
}

function buildGeometry(points: RouteCoordinate[]) {
  return {
    type: 'LineString' as const,
    coordinates: points.map(
      (point) => [point.lon, point.lat] as [number, number],
    ),
  };
}

function computeRoute(points: RouteCoordinate[]): RouteResult {
  let distanceMeters = 0;
  for (let i = 1; i < points.length; i += 1) {
    distanceMeters += haversineMeters(points[i - 1], points[i]) * ROAD_FACTOR;
  }

  const roundedDistance = Math.round(distanceMeters);
  const durationSeconds = Math.max(
    1,
    Math.round(roundedDistance / AVERAGE_SPEED_MPS),
  );

  const geometry = buildGeometry(points);
  const lons = geometry.coordinates.map(([lon]) => lon);
  const lats = geometry.coordinates.map(([, lat]) => lat);

  return {
    distanceMeters: roundedDistance,
    durationSeconds,
    geometry,
    bbox: {
      west: Math.min(...lons),
      south: Math.min(...lats),
      east: Math.max(...lons),
      north: Math.max(...lats),
    },
  };
}

/** Deterministic routing provider for automated tests — never calls live OSRM. */
export class MockRoutingProvider implements RoutingProvider {
  readonly name = 'mock';

  route(request: RouteRequest): Promise<RouteResult> {
    const points = [
      request.origin,
      ...(request.via ?? []),
      request.destination,
    ];
    return Promise.resolve(computeRoute(points));
  }
}
