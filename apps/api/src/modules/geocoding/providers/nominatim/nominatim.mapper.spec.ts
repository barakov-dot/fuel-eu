import {
  normalizeNominatimReverseResult,
  normalizeNominatimSearchResult,
} from './nominatim.mapper';
import type {
  NominatimReverseResult,
  NominatimSearchResult,
} from './nominatim.types';

describe('nominatim.mapper', () => {
  it('normalizes a city search result', () => {
    const item: NominatimSearchResult = {
      place_id: 12345,
      osm_type: 'R',
      osm_id: 7444,
      lat: '48.8566',
      lon: '2.3522',
      display_name: 'Paris, Île-de-France, France',
      name: 'Paris',
      type: 'city',
      category: 'place',
      address: {
        city: 'Paris',
        country: 'France',
        country_code: 'fr',
        postcode: '75000',
      },
      boundingbox: ['48.815', '48.902', '2.224', '2.469'],
    };

    const result = normalizeNominatimSearchResult(item);
    expect(result).toEqual({
      id: 'nominatim:R:7444',
      name: 'Paris',
      displayName: 'Paris, Île-de-France, France',
      location: { lat: 48.8566, lon: 2.3522 },
      type: 'city',
      category: 'place',
      address: {
        country: 'France',
        countryCode: 'fr',
        city: 'Paris',
        postcode: '75000',
        road: null,
      },
      boundingBox: {
        south: 48.815,
        north: 48.902,
        west: 2.224,
        east: 2.469,
      },
    });
  });

  it('normalizes a street address with missing optional fields', () => {
    const item: NominatimSearchResult = {
      place_id: 99,
      osm_type: 'W',
      osm_id: 1,
      lat: '60.2',
      lon: '24.9',
      display_name: 'Mannerheimintie 10, Helsinki, Finland',
      type: 'house',
      address: {
        road: 'Mannerheimintie',
        house_number: '10',
        country: 'Finland',
        country_code: 'fi',
      },
    };

    const result = normalizeNominatimSearchResult(item);
    expect(result?.name).toBe('Mannerheimintie 10');
    expect(result?.address.city).toBeNull();
    expect(result?.address.postcode).toBeNull();
    expect(result?.boundingBox).toBeNull();
  });

  it('returns null for invalid coordinates', () => {
    const item: NominatimSearchResult = {
      place_id: 1,
      osm_type: 'N',
      osm_id: 1,
      lat: 'invalid',
      lon: '2.3522',
      display_name: 'Bad',
    };

    expect(normalizeNominatimSearchResult(item)).toBeNull();
  });

  it('normalizes reverse geocoding result', () => {
    const item: NominatimReverseResult = {
      place_id: 1,
      lat: '48.8566',
      lon: '2.3522',
      display_name: 'Paris, Île-de-France, France',
      name: 'Paris',
      address: {
        city: 'Paris',
        country: 'France',
        country_code: 'fr',
      },
    };

    expect(normalizeNominatimReverseResult(item)?.displayName).toBe(
      'Paris, Île-de-France, France',
    );
  });
});
