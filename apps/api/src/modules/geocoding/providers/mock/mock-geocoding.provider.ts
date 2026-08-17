import type {
  GeocodingProvider,
  GeocodingResult,
  GeocodingSearchRequest,
  ReverseGeocodingRequest,
  ReverseGeocodingResult,
} from '../../geocoding-provider.interface';

const MOCK_RESULTS: GeocodingResult[] = [
  {
    id: 'mock:city:paris',
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
  },
  {
    id: 'mock:city:rennes',
    name: 'Rennes',
    displayName: 'Rennes, Brittany, France',
    location: { lat: 48.1173, lon: -1.6778 },
    type: 'city',
    category: 'place',
    address: {
      country: 'France',
      countryCode: 'fr',
      city: 'Rennes',
      postcode: '35000',
      road: null,
    },
    boundingBox: null,
  },
  {
    id: 'mock:city:madrid',
    name: 'Madrid',
    displayName: 'Madrid, Community of Madrid, Spain',
    location: { lat: 40.4168, lon: -3.7038 },
    type: 'city',
    category: 'place',
    address: {
      country: 'Spain',
      countryCode: 'es',
      city: 'Madrid',
      postcode: '28001',
      road: null,
    },
    boundingBox: null,
  },
  {
    id: 'mock:city:toledo',
    name: 'Toledo',
    displayName: 'Toledo, Castile-La Mancha, Spain',
    location: { lat: 39.8628, lon: -4.0273 },
    type: 'city',
    category: 'place',
    address: {
      country: 'Spain',
      countryCode: 'es',
      city: 'Toledo',
      postcode: '45001',
      road: null,
    },
    boundingBox: null,
  },
  {
    id: 'mock:aerodrome:hel',
    name: 'Helsinki Airport',
    displayName: 'Helsinki Airport, Vantaa, Finland',
    location: { lat: 60.3172, lon: 24.9633 },
    type: 'aerodrome',
    category: 'aeroway',
    address: {
      country: 'Finland',
      countryCode: 'fi',
      city: 'Vantaa',
      postcode: '01530',
      road: null,
    },
    boundingBox: null,
  },
];

/** Deterministic geocoding provider for automated tests — never calls live Nominatim. */
export class MockGeocodingProvider implements GeocodingProvider {
  readonly name = 'mock';

  search(request: GeocodingSearchRequest): Promise<GeocodingResult[]> {
    const query = request.query.trim().toLowerCase();
    const limit = request.limit ?? 5;
    const matches = MOCK_RESULTS.filter(
      (item) =>
        item.name.toLowerCase().includes(query) ||
        item.displayName.toLowerCase().includes(query),
    ).slice(0, limit);

    return Promise.resolve(matches);
  }

  reverse(
    request: ReverseGeocodingRequest,
  ): Promise<ReverseGeocodingResult | null> {
    const nearest = MOCK_RESULTS.reduce<{
      item: GeocodingResult;
      distance: number;
    } | null>((best, item) => {
      const distance =
        Math.abs(item.location.lat - request.lat) +
        Math.abs(item.location.lon - request.lon);
      if (!best || distance < best.distance) {
        return { item, distance };
      }
      return best;
    }, null);

    if (!nearest || nearest.distance > 1) {
      return Promise.resolve(null);
    }

    return Promise.resolve({
      name: nearest.item.name,
      displayName: nearest.item.displayName,
      location: nearest.item.location,
      address: nearest.item.address,
    });
  }
}
