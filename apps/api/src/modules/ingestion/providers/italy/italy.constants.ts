export const ITALY_PROVIDER_CODE = 'IT_MIMIT_FUEL_PRICES';

/** Stable official CSV endpoints (MIMIT open-data section). */
export const ITALY_STATIONS_URL =
  'https://www.mimit.gov.it/images/exportCSV/anagrafica_impianti_attivi.csv';

export const ITALY_PRICES_URL =
  'https://www.mimit.gov.it/images/exportCSV/prezzo_alle_8.csv';

export const ITALY_OPEN_DATA_PAGE =
  'https://www.mimit.gov.it/it/open-data/elenco-dataset/carburanti-prezzi-praticati-e-anagrafica-degli-impianti';

/** WGS84 bounding box for coordinate validation. */
export const ITALY_BOUNDS = {
  minLat: 35.0,
  maxLat: 48.0,
  minLon: 6.0,
  maxLon: 19.0,
} as const;

export const ITALY_CSV_DELIMITER = '|';

/** Default daily cron: 08:00 UTC (09:00 CET / 10:00 CEST — after MIMIT publication). */
export const ITALY_DEFAULT_INGEST_CRON = '0 8 * * *';

/** Canonical fuel aliases for standard MIMIT product names. */
export const ITALY_FUEL_ALIASES: Array<{
  externalName: string;
  fuelCode: string;
}> = [
  { externalName: 'Benzina', fuelCode: 'petrol' },
  { externalName: 'Gasolio', fuelCode: 'diesel' },
  { externalName: 'GPL', fuelCode: 'lpg' },
  { externalName: 'Metano', fuelCode: 'cng' },
  { externalName: 'GNL', fuelCode: 'lng' },
  { externalName: 'Benzina speciale', fuelCode: 'sp95' },
  { externalName: 'Benzina Plus 98', fuelCode: 'sp98' },
  { externalName: 'Benzina 100 ottani', fuelCode: 'sp98' },
  { externalName: 'Benzina 102 Ottani', fuelCode: 'sp98' },
  { externalName: 'Benzina Energy 98 ottani', fuelCode: 'sp98' },
  { externalName: 'Benzina Speciale 98 Ottani', fuelCode: 'sp98' },
  { externalName: 'Gasolio Premium', fuelCode: 'premium_diesel' },
  { externalName: 'Gasolio Plus', fuelCode: 'premium_diesel' },
  { externalName: 'Gasolio Prestazionale', fuelCode: 'premium_diesel' },
  { externalName: 'Diesel HVO', fuelCode: 'hvo' },
  { externalName: 'Gasolio HVO', fuelCode: 'hvo' },
  { externalName: 'GASOLIO HVO', fuelCode: 'hvo' },
];

/** Brand-specific premium labels intentionally not aliased — documented in docs/providers/italy.md */
export const ITALY_UNSUPPORTED_FUEL_LABELS = [
  'Benzina Shell V Power',
  'Blue Super',
  'Blue Diesel',
  'Excellium Diesel',
  'Excellium diesel',
  'F-101',
  'F101',
  'BCHVO',
  'E-DIESEL',
  'GP DIESEL',
  'DieselMax',
  'Blu Diesel Alpino',
  'Gasolio Alpino',
  'Gasolio Artico',
  'Gasolio Gelo',
  'Gasolio artico',
  'Gasolio Artico Igloo',
  'Gasolio Ecoplus',
  'Gasolio Energy D',
  'Gasolio Bio HVO',
  'Gasolio Oro Diesel',
  'Diesel HVO Energy',
  'Diesel Shell V Power',
  'Benzina WR 100',
] as const;
