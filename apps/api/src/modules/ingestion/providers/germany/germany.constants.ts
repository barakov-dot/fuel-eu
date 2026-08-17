export const GERMANY_PROVIDER_CODE = 'DE_TANKERKOENIG_MTSK';

export const GERMANY_DEFAULT_BASE_URL =
  'https://creativecommons.tankerkoenig.de/json';

export const GERMANY_LIST_ENDPOINT = 'list.php';
export const GERMANY_PRICES_ENDPOINT = 'prices.php';

/** Official free-tier limit documented at creativecommons.tankerkoenig.de */
export const GERMANY_MAX_RADIUS_KM = 25;
export const GERMANY_MAX_IDS_PER_PRICE_REQUEST = 10;
export const GERMANY_MIN_REQUEST_INTERVAL_MS = 60_000;

/** Nationwide discovery grid (WGS84). Step sizes target ~35 km spacing for 25 km radius overlap. */
export const GERMANY_BOUNDS = {
  minLat: 47.27,
  maxLat: 55.06,
  minLng: 5.87,
  maxLng: 15.04,
} as const;

export const GERMANY_GRID_STEP_LAT = 0.32;
export const GERMANY_GRID_STEP_LNG = 0.48;

export const GERMANY_FUEL_ALIASES = [
  { externalName: 'e5', fuelCode: 'e5' },
  { externalName: 'e10', fuelCode: 'e10' },
  { externalName: 'diesel', fuelCode: 'diesel' },
] as const;

export const GERMANY_FUEL_FIELDS = ['e5', 'e10', 'diesel'] as const;
