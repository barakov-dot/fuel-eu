export const AUSTRIA_PROVIDER_CODE = 'AT_ECONTROL_SPRITPREIS';

export const AUSTRIA_DEFAULT_BASE_URL = 'https://api.e-control.at/sprit/1.0';

export const AUSTRIA_SEARCH_BY_ADDRESS_PATH = '/search/gas-stations/by-address';

/** Official fuel codes in the E-Control Sprit API. */
export const AUSTRIA_API_FUELS = ['DIE', 'SUP'] as const;

export type AustriaApiFuel = (typeof AUSTRIA_API_FUELS)[number];

export const AUSTRIA_FUEL_ALIASES = [
  { externalName: 'DIE', fuelCode: 'diesel' },
  /** Statutory product is Super-95; mapped to canonical sp95, not e10. */
  { externalName: 'SUP', fuelCode: 'sp95' },
] as const;

/** Approximate Austria bounding box (WGS84) for on-demand enrichment triggers. */
export const AUSTRIA_BOUNDS = {
  minLat: 46.35,
  maxLat: 49.05,
  minLon: 9.45,
  maxLon: 17.25,
} as const;

/** Default Redis/cache TTL — prices must be <=30 min old per statute. */
export const AUSTRIA_DEFAULT_CACHE_TTL_SECONDS = 900;

export const AUSTRIA_MIN_REQUEST_INTERVAL_MS = 1000;
