export const ROUTING_PROVIDER_TOKEN = Symbol('ROUTING_PROVIDER');

export const ROUTING_PROFILE_DRIVING = 'driving' as const;
export const ROUTING_PROFILES = [ROUTING_PROFILE_DRIVING] as const;
export type RoutingProfile = (typeof ROUTING_PROFILES)[number];

export const DEFAULT_CORRIDOR_KM = 5;
export const DEFAULT_ROUTE_STATIONS_LIMIT = 20;
export const MAX_CORRIDOR_KM = 20;
export const MAX_ROUTE_STATIONS_LIMIT = 50;
export const CORRIDOR_CANDIDATE_POOL = 50;
export const DETOUR_CANDIDATE_COUNT = 12;
export const DETOUR_CONCURRENCY = 4;

export const DEFAULT_OSRM_TIMEOUT_MS = 10_000;
export const DEFAULT_ROUTING_CACHE_TTL_SECONDS = 600;

export const ROUTE_STATIONS_SORT_VALUES = [
  'effective_saving',
  'price',
  'detour',
  'distance_to_route',
] as const;
export type RouteStationsSort = (typeof ROUTE_STATIONS_SORT_VALUES)[number];

export const DEFAULT_ROUTE_STATIONS_SORT: RouteStationsSort =
  'effective_saving';

export const REFERENCE_PRICE_SOURCE_USER = 'user' as const;
export const REFERENCE_PRICE_SOURCE_ROUTE_MEDIAN = 'route_median' as const;
