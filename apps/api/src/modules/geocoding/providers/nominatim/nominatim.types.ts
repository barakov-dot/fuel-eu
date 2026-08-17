export type NominatimAddress = {
  house_number?: string;
  road?: string;
  neighbourhood?: string;
  suburb?: string;
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  county?: string;
  state?: string;
  postcode?: string;
  country?: string;
  country_code?: string;
  [key: string]: string | undefined;
};

export type NominatimSearchResult = {
  place_id: number;
  osm_type: string;
  osm_id: number;
  lat: string | number;
  lon: string | number;
  display_name: string;
  name?: string;
  type?: string;
  category?: string;
  addresstype?: string;
  address?: NominatimAddress;
  boundingbox?: [string, string, string, string];
};

export type NominatimReverseResult = {
  place_id: number;
  lat: string | number;
  lon: string | number;
  display_name: string;
  name?: string;
  type?: string;
  category?: string;
  addresstype?: string;
  address?: NominatimAddress;
};
