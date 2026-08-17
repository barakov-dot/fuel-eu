import type { RoutingProfile } from './routing.constants';

export type RouteCoordinate = {
  lat: number;
  lon: number;
};

export type GeoJsonLineString = {
  type: 'LineString';
  coordinates: [number, number][];
};

export type RouteBbox = {
  west: number;
  south: number;
  east: number;
  north: number;
};

export type RouteRequest = {
  origin: RouteCoordinate;
  destination: RouteCoordinate;
  via?: RouteCoordinate[];
  profile?: RoutingProfile;
};

export type RouteResult = {
  distanceMeters: number;
  durationSeconds: number;
  geometry: GeoJsonLineString;
  bbox?: RouteBbox;
};

export interface RoutingProvider {
  readonly name: string;
  route(request: RouteRequest): Promise<RouteResult>;
}
