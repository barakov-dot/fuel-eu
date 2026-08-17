export const CROATIA_PROVIDER_CODE = 'HR_MZOE_FUEL_PRICES';

export const CROATIA_DATA_URL = 'https://mzoe-gor.hr/data.json';
export const CROATIA_OPEN_DATA_PAGE = 'https://mzoe-gor.hr/';

export const CROATIA_DEFAULT_INGEST_CRON = '0 */4 * * *';

/** vrsta_goriva names mapped to canonical fuels (road fuels only). */
export const CROATIA_FUEL_ALIASES: Array<{
  externalName: string;
  fuelCode: string;
}> = [
  { externalName: 'Eurosuper 95 sa aditivima', fuelCode: 'sp95' },
  { externalName: 'Eurosuper 95 bez aditiva', fuelCode: 'sp95' },
  { externalName: 'Eurosuper 100 sa aditivima', fuelCode: 'sp98' },
  { externalName: 'Eurosuper 100 bez aditiva', fuelCode: 'sp98' },
  { externalName: 'Eurodizel sa aditivima', fuelCode: 'diesel' },
  { externalName: 'Eurodizel bez aditiva', fuelCode: 'diesel' },
  { externalName: 'UNP (autoplin)', fuelCode: 'lpg' },
];

/** Non-road products intentionally excluded — documented in docs/providers/croatia.md */
export const CROATIA_UNSUPPORTED_VRSTA_GORIVA = [
  'Plinsko ulje LU EL (lož ulje)',
  'Plinsko ulje obojano plavom bojom (plavi dizel)',
  'Bioetanol',
] as const;

export function isInCroatiaBounds(lat: number, lon: number): boolean {
  return lat >= 42.3 && lat <= 46.6 && lon >= 13.4 && lon <= 19.5;
}
