export const locales = ['en', 'ru'] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'en';

export const PROMINENT_FUEL_CODES = [
  'e10',
  'sp95',
  'sp98',
  'diesel',
  'e85',
  'lpg',
] as const;

export const PARIS_FALLBACK = {
  lat: 48.8566,
  lon: 2.3522,
  labelKey: 'location.fallbackParis' as const,
};

export const DEFAULT_RADIUS_KM = 10;
export const DEFAULT_NEARBY_LIMIT = 50;
export const DEFAULT_SORT = 'distance' as const;
export const BBOX_DEBOUNCE_MS = 400;
export const BBOX_LIMIT = 500;

export function isLocale(value: string): value is Locale {
  return locales.includes(value as Locale);
}

export function resolveLocale(value: string | undefined): Locale {
  if (value && isLocale(value)) {
    return value;
  }
  return defaultLocale;
}

export function localeFromAcceptLanguage(header: string | null): Locale {
  if (!header) {
    return defaultLocale;
  }

  const lower = header.toLowerCase();
  if (lower.includes('ru')) {
    return 'ru';
  }
  return defaultLocale;
}
