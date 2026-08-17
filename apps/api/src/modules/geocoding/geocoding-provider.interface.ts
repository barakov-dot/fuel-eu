export type GeocodingLocation = {
  lat: number;
  lon: number;
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
  location: GeocodingLocation;
  type: string | null;
  category: string | null;
  address: GeocodingAddress;
  boundingBox: GeocodingBoundingBox | null;
};

export type ReverseGeocodingResult = {
  name: string;
  displayName: string;
  location: GeocodingLocation;
  address: GeocodingAddress;
};

export type GeocodingSearchRequest = {
  query: string;
  limit?: number;
  language?: string;
  countryCodes?: string[];
  biasLocation?: GeocodingLocation;
};

export type ReverseGeocodingRequest = {
  lat: number;
  lon: number;
  language?: string;
};

export interface GeocodingProvider {
  readonly name: string;
  search(request: GeocodingSearchRequest): Promise<GeocodingResult[]>;
  reverse(
    request: ReverseGeocodingRequest,
  ): Promise<ReverseGeocodingResult | null>;
}
