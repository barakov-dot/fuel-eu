export interface CountrySeed {
  iso2: string;
  iso3: string;
  nameEn: string;
  nameRu?: string;
}

export const EU27_COUNTRIES: CountrySeed[] = [
  { iso2: 'AT', iso3: 'AUT', nameEn: 'Austria', nameRu: 'Австрия' },
  { iso2: 'BE', iso3: 'BEL', nameEn: 'Belgium', nameRu: 'Бельгия' },
  { iso2: 'BG', iso3: 'BGR', nameEn: 'Bulgaria', nameRu: 'Болгария' },
  { iso2: 'HR', iso3: 'HRV', nameEn: 'Croatia', nameRu: 'Хорватия' },
  { iso2: 'CY', iso3: 'CYP', nameEn: 'Cyprus', nameRu: 'Кипр' },
  { iso2: 'CZ', iso3: 'CZE', nameEn: 'Czechia', nameRu: 'Чехия' },
  { iso2: 'DK', iso3: 'DNK', nameEn: 'Denmark', nameRu: 'Дания' },
  { iso2: 'EE', iso3: 'EST', nameEn: 'Estonia', nameRu: 'Эстония' },
  { iso2: 'FI', iso3: 'FIN', nameEn: 'Finland', nameRu: 'Финляндия' },
  { iso2: 'FR', iso3: 'FRA', nameEn: 'France', nameRu: 'Франция' },
  { iso2: 'DE', iso3: 'DEU', nameEn: 'Germany', nameRu: 'Германия' },
  { iso2: 'GR', iso3: 'GRC', nameEn: 'Greece', nameRu: 'Греция' },
  { iso2: 'HU', iso3: 'HUN', nameEn: 'Hungary', nameRu: 'Венгрия' },
  { iso2: 'IE', iso3: 'IRL', nameEn: 'Ireland', nameRu: 'Ирландия' },
  { iso2: 'IT', iso3: 'ITA', nameEn: 'Italy', nameRu: 'Италия' },
  { iso2: 'LV', iso3: 'LVA', nameEn: 'Latvia', nameRu: 'Латвия' },
  { iso2: 'LT', iso3: 'LTU', nameEn: 'Lithuania', nameRu: 'Литва' },
  { iso2: 'LU', iso3: 'LUX', nameEn: 'Luxembourg', nameRu: 'Люксембург' },
  { iso2: 'MT', iso3: 'MLT', nameEn: 'Malta', nameRu: 'Мальта' },
  { iso2: 'NL', iso3: 'NLD', nameEn: 'Netherlands', nameRu: 'Нидерланды' },
  { iso2: 'PL', iso3: 'POL', nameEn: 'Poland', nameRu: 'Польша' },
  { iso2: 'PT', iso3: 'PRT', nameEn: 'Portugal', nameRu: 'Португалия' },
  { iso2: 'RO', iso3: 'ROU', nameEn: 'Romania', nameRu: 'Румыния' },
  { iso2: 'SK', iso3: 'SVK', nameEn: 'Slovakia', nameRu: 'Словакия' },
  { iso2: 'SI', iso3: 'SVN', nameEn: 'Slovenia', nameRu: 'Словения' },
  { iso2: 'ES', iso3: 'ESP', nameEn: 'Spain', nameRu: 'Испания' },
  { iso2: 'SE', iso3: 'SWE', nameEn: 'Sweden', nameRu: 'Швеция' },
];

export interface CurrencySeed {
  code: string;
  name: string;
  symbol: string;
  decimalDigits: number;
}

export const EU_CURRENCIES: CurrencySeed[] = [
  { code: 'EUR', name: 'Euro', symbol: '€', decimalDigits: 2 },
  {
    code: 'BGN',
    name: 'Bulgarian Lev',
    symbol: 'лв',
    decimalDigits: 2,
  },
  { code: 'CZK', name: 'Czech Koruna', symbol: 'Kč', decimalDigits: 2 },
  { code: 'DKK', name: 'Danish Krone', symbol: 'kr', decimalDigits: 2 },
  { code: 'HUF', name: 'Hungarian Forint', symbol: 'Ft', decimalDigits: 0 },
  { code: 'PLN', name: 'Polish Zloty', symbol: 'zł', decimalDigits: 2 },
  { code: 'RON', name: 'Romanian Leu', symbol: 'lei', decimalDigits: 2 },
  { code: 'SEK', name: 'Swedish Krona', symbol: 'kr', decimalDigits: 2 },
];

/** Primary currency per EU country ISO2 as of August 2026. Bulgaria adopted EUR on 2026-01-01. */
export const COUNTRY_PRIMARY_CURRENCY: Record<string, string> = {
  AT: 'EUR',
  BE: 'EUR',
  BG: 'EUR',
  HR: 'EUR',
  CY: 'EUR',
  CZ: 'CZK',
  DK: 'DKK',
  EE: 'EUR',
  FI: 'EUR',
  FR: 'EUR',
  DE: 'EUR',
  GR: 'EUR',
  HU: 'HUF',
  IE: 'EUR',
  IT: 'EUR',
  LV: 'EUR',
  LT: 'EUR',
  LU: 'EUR',
  MT: 'EUR',
  NL: 'EUR',
  PL: 'PLN',
  PT: 'EUR',
  RO: 'RON',
  SK: 'EUR',
  SI: 'EUR',
  ES: 'EUR',
  SE: 'SEK',
};

/** Historical currency mappings (valid_to set for superseded currencies). */
export const COUNTRY_HISTORICAL_CURRENCIES: Array<{
  iso2: string;
  currencyCode: string;
  validFrom?: string;
  validTo: string;
}> = [
  {
    iso2: 'BG',
    currencyCode: 'BGN',
    validTo: '2025-12-31',
  },
];

export interface FuelTypeSeed {
  code: string;
  nameEn: string;
  nameRu?: string;
  category: 'gasoline' | 'diesel' | 'gas' | 'hydrogen' | 'electric' | 'other';
  octaneRating?: number;
  biofuelPercentage?: number;
  unit: 'liter' | 'kilogram' | 'kwh';
}

export const CANONICAL_FUEL_TYPES: FuelTypeSeed[] = [
  {
    code: 'petrol',
    nameEn: 'Unleaded petrol (generic)',
    nameRu: 'Бензин',
    category: 'gasoline',
    unit: 'liter',
  },
  {
    code: 'e5',
    nameEn: 'E5 (95 octane, max 5% ethanol)',
    nameRu: 'E5',
    category: 'gasoline',
    octaneRating: 95,
    biofuelPercentage: 5,
    unit: 'liter',
  },
  {
    code: 'e10',
    nameEn: 'E10 (95 octane, max 10% ethanol)',
    nameRu: 'E10',
    category: 'gasoline',
    octaneRating: 95,
    biofuelPercentage: 10,
    unit: 'liter',
  },
  {
    code: 'sp95',
    nameEn: 'SP95 (95 octane gasoline)',
    nameRu: 'АИ-95',
    category: 'gasoline',
    octaneRating: 95,
    unit: 'liter',
  },
  {
    code: 'sp98',
    nameEn: 'SP98 (98 octane gasoline)',
    nameRu: 'АИ-98',
    category: 'gasoline',
    octaneRating: 98,
    unit: 'liter',
  },
  {
    code: 'diesel',
    nameEn: 'Diesel (B7)',
    nameRu: 'Дизель',
    category: 'diesel',
    biofuelPercentage: 7,
    unit: 'liter',
  },
  {
    code: 'premium_diesel',
    nameEn: 'Premium Diesel',
    nameRu: 'Премиум дизель',
    category: 'diesel',
    unit: 'liter',
  },
  {
    code: 'e85',
    nameEn: 'E85',
    category: 'gasoline',
    biofuelPercentage: 85,
    unit: 'liter',
  },
  {
    code: 'lpg',
    nameEn: 'LPG (Autogas)',
    nameRu: 'СУГ',
    category: 'gas',
    unit: 'liter',
  },
  {
    code: 'cng',
    nameEn: 'CNG (Compressed Natural Gas)',
    category: 'gas',
    unit: 'kilogram',
  },
  {
    code: 'lng',
    nameEn: 'LNG (Liquefied Natural Gas)',
    category: 'gas',
    unit: 'kilogram',
  },
  {
    code: 'hvo',
    nameEn: 'HVO (Hydrotreated Vegetable Oil)',
    category: 'diesel',
    unit: 'liter',
  },
  {
    code: 'hydrogen',
    nameEn: 'Hydrogen',
    nameRu: 'Водород',
    category: 'hydrogen',
    unit: 'kilogram',
  },
];
