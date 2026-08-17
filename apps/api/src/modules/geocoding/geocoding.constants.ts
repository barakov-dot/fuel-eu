export const GEOCODING_PROVIDER_TOKEN = Symbol('GEOCODING_PROVIDER');

export const DEFAULT_GEOCODING_PROVIDER = 'nominatim';
export const DEFAULT_NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org';
export const DEFAULT_NOMINATIM_TIMEOUT_MS = 5000;
export const DEFAULT_GEOCODING_CACHE_TTL_SECONDS = 86_400;
export const DEFAULT_NOMINATIM_MIN_INTERVAL_MS = 1000;

export const GEOCODING_MIN_QUERY_LENGTH = 2;
export const GEOCODING_MAX_QUERY_LENGTH = 200;
export const GEOCODING_DEFAULT_LIMIT = 5;
export const GEOCODING_MAX_LIMIT = 10;

export const SUPPORTED_GEOCODING_LANGUAGES = ['en', 'ru'] as const;
