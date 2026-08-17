export const SLOVENIA_PROVIDER_CODE = 'SI_GORIVA_FUEL_PRICES';

export const SLOVENIA_SEARCH_API_URL = 'https://goriva.si/api/v1/search/';
export const SLOVENIA_FRANCHISE_API_URL = 'https://goriva.si/api/v1/franchise/';
export const SLOVENIA_OPEN_DATA_PAGE =
  'https://www.gov.si/teme/cene-naftnih-derivatov/';

/** Centre of Slovenia for nationwide radius search (~200 km covers entire country). */
export const SLOVENIA_SEARCH_CENTER = { lat: 46.15, lon: 14.99 };
export const SLOVENIA_SEARCH_RADIUS_METERS = 200_000;

export const SLOVENIA_DEFAULT_INGEST_CRON = '0 */2 * * *';

/** Road fuels mapped from goriva.si price keys. */
export const SLOVENIA_FUEL_PRICE_KEYS = [
  { key: '95', externalName: 'NMB-95' },
  { key: 'dizel', externalName: 'Dizel' },
  { key: '98', externalName: 'NMB-98' },
  { key: '100', externalName: 'NMB-100' },
  { key: 'dizel-premium', externalName: 'Dizel Premium' },
  { key: 'avtoplin-lpg', externalName: 'Avtoplin LPG' },
  { key: 'hvo', externalName: 'HVO' },
  { key: 'cng', externalName: 'CNG' },
  { key: 'lng', externalName: 'LNG' },
] as const;

/** Non-road products intentionally excluded — documented in docs/providers/slovenia.md */
export const SLOVENIA_UNSUPPORTED_FUEL_KEYS = ['KOEL'] as const;

export const SLOVENIA_FUEL_ALIASES: Array<{
  externalName: string;
  fuelCode: string;
}> = [
  { externalName: 'NMB-95', fuelCode: 'sp95' },
  { externalName: 'Dizel', fuelCode: 'diesel' },
  { externalName: 'NMB-98', fuelCode: 'sp98' },
  { externalName: 'NMB-100', fuelCode: 'sp98' },
  { externalName: 'Dizel Premium', fuelCode: 'premium_diesel' },
  { externalName: 'Avtoplin LPG', fuelCode: 'lpg' },
  { externalName: 'HVO', fuelCode: 'hvo' },
  { externalName: 'CNG', fuelCode: 'cng' },
  { externalName: 'LNG', fuelCode: 'lng' },
];

export function isInSloveniaBounds(lat: number, lon: number): boolean {
  return lat >= 45.4 && lat <= 46.9 && lon >= 13.3 && lon <= 16.7;
}
