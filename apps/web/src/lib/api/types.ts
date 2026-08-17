export type FuelType = {
  id: string;
  code: string;
  nameEn: string;
  nameRu: string | null;
  category: string;
  octaneRating: number | null;
  biofuelPercentage: number | null;
  unit: string;
  isActive: boolean;
};

export type StationPrice = {
  fuelType: {
    id: string;
    code: string;
    name: string;
  };
  price: string;
  currency: string;
  observedAt: string;
  ageSeconds: number;
  source: {
    id: string;
    code: string;
    name: string;
    type: string;
  };
  confidence: number;
  serviceMode?: 'self' | 'served' | 'unknown';
};

export type NearbyStation = {
  id: string;
  name: string | null;
  brand: string | null;
  country: {
    iso2: string;
    name: string;
  };
  address: {
    addressLine: string | null;
    postalCode: string | null;
    city: string | null;
  };
  location: {
    lat: number;
    lon: number;
  };
  distanceMeters: number;
  prices: StationPrice[];
};

export type NearbyStationsResponse = {
  items: NearbyStation[];
  meta: {
    lat: number;
    lon: number;
    radiusKm: number;
    count: number;
    coverageNotice?: {
      coverageType: string;
      limitations: string[];
    };
    austriaDataScope?: string;
  };
};

export type BboxStation = {
  id: string;
  name: string | null;
  brand: string | null;
  lat: number;
  lon: number;
  prices: StationPrice[];
};

export type BboxStationsResponse = {
  items: BboxStation[];
  meta: {
    count: number;
    limit: number;
    truncated: boolean;
  };
};

export type StationDetail = {
  id: string;
  countryId: string;
  brand: string | null;
  name: string | null;
  addressLine: string | null;
  postalCode: string | null;
  city: string | null;
  phone: string | null;
  website: string | null;
  isActive: boolean;
  latitude: number;
  longitude: number;
  countryIso2: string;
  countryNameEn: string;
};

export type LatestStationPrice = {
  id: string;
  stationId: string;
  fuelTypeId: string;
  fuelCode: string;
  fuelNameEn: string;
  dataSourceId: string;
  dataSourceCode: string;
  price: string;
  currencyId: string;
  currencyCode: string;
  observedAt: string;
  receivedAt: string;
  source?: {
    type: string;
    name: string;
  };
  confidence?: string;
  ageSeconds?: number;
  serviceMode?: 'self' | 'served' | 'unknown';
  verification?: {
    confirmations: number;
    disputes: number;
  };
};

export type PriceHistoryEntry = {
  id: string;
  stationId: string;
  fuelTypeId: string;
  fuelCode: string;
  dataSourceId: string;
  dataSourceCode: string;
  price: string;
  currencyId: string;
  currencyCode: string;
  observedAt: string;
  receivedAt: string;
};

export type NearbySort = 'distance' | 'price';

export type NearbyQuery = {
  lat: number;
  lon: number;
  radiusKm?: number;
  limit?: number;
  sort?: NearbySort;
  fuelTypeId?: string;
  currency?: string;
  onlyWithPrice?: boolean;
};

export type BboxQuery = {
  west: number;
  south: number;
  east: number;
  north: number;
  limit?: number;
  fuelTypeId?: string;
  onlyWithPrice?: boolean;
};

export type PriceHistoryQuery = {
  fuelTypeId: string;
  from?: string;
  to?: string;
  limit?: number;
};

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export type RoutePoint = {
  lat: number;
  lon: number;
  label?: string;
};

export type RouteGeometry = {
  type: 'LineString';
  coordinates: [number, number][];
};

export type RouteResponse = {
  distanceMeters: number;
  durationSeconds: number;
  geometry: RouteGeometry;
  bbox?: {
    west: number;
    south: number;
    east: number;
    north: number;
  };
};

export type RouteStationsSort =
  | 'effective_saving'
  | 'price'
  | 'detour'
  | 'distance_to_route';

export type RouteStationsQuery = {
  origin: RoutePoint;
  destination: RoutePoint;
  fuelTypeId: string;
  currency: string;
  corridorKm?: number;
  limit?: number;
  refuelLiters: string;
  vehicleConsumptionLPer100Km: string;
  referencePrice?: string;
  maxPrice?: number;
  onlyWithPrice?: boolean;
  maxPriceAgeHours?: number;
  sort?: RouteStationsSort;
};

export type RouteStationCandidate = {
  station: {
    id: string;
    name: string | null;
    brand: string | null;
    country: { iso2: string; name: string };
    address: {
      addressLine: string | null;
      postalCode: string | null;
      city: string | null;
    };
    location: RoutePoint;
  };
  fuel: {
    fuelTypeId: string;
    fuelCode: string;
    fuelName: string;
    price: string;
    currency: string;
    observedAt: string;
    ageSeconds: number;
  };
  route: {
    distanceToRouteMeters: number;
    routeProgress: number;
    detourMeters: number | null;
    detourDurationSeconds: number | null;
    detourFailed?: boolean;
  };
  savings: {
    referencePrice: string;
    grossSaving: string;
    extraFuelLiters: string;
    extraDrivingCost: string;
    effectiveSaving: string;
  };
};

export type RouteStationsResponse = {
  route: RouteResponse;
  referencePrice: string | null;
  referencePriceSource: 'user' | 'route_median' | null;
  items: RouteStationCandidate[];
  meta: {
    corridorKm: number;
    corridorCandidateCount: number;
    exactRoutedCandidateCount: number;
    currencyFilteringApplied: boolean;
    limit: number;
    sort: RouteStationsSort;
  };
};

export type GeocodingAddress = {
  country: string | null;
  countryCode: string | null;
  city: string | null;
  postcode: string | null;
  road: string | null;
};

export type GeocodingBoundingBox = {
  south: number;
  north: number;
  west: number;
  east: number;
};

export type GeocodingResult = {
  id: string;
  name: string;
  displayName: string;
  location: RoutePoint;
  type: string | null;
  category: string | null;
  address: GeocodingAddress;
  boundingBox: GeocodingBoundingBox | null;
};

export type GeocodingSearchResponse = {
  items: GeocodingResult[];
};

export type ReverseGeocodingResponse = {
  name: string;
  displayName: string;
  location: RoutePoint;
  address: GeocodingAddress;
};

export type GeocodingSearchQuery = {
  q: string;
  limit?: number;
  lat?: number;
  lon?: number;
  countryCodes?: string;
  language?: string;
};

export type ReverseGeocodingQuery = {
  lat: number;
  lon: number;
  language?: string;
};

export type SafeUserProfile = {
  id: string;
  email: string;
  displayName: string | null;
  locale: string;
};

export type UserPreferences = {
  preferredFuelTypeId: string | null;
  preferredCurrency: string | null;
  defaultRefuelLiters: string | null;
  vehicleConsumptionLPer100Km: string | null;
  locale: string;
};

export type AuthMeResponse = {
  user: SafeUserProfile;
  preferences: UserPreferences;
};

export type FavoriteStationSummary = {
  id: string;
  name: string | null;
  brand: string | null;
  country: { iso2: string; name: string };
  address: {
    addressLine: string | null;
    postalCode: string | null;
    city: string | null;
  };
  location: { lat: number; lon: number };
  favoritedAt: string;
  price: {
    fuelTypeId: string;
    fuelCode: string;
    fuelName: string;
    price: string;
    currency: string;
    observedAt: string;
  } | null;
};

export type FavoritesResponse = {
  items: FavoriteStationSummary[];
};
