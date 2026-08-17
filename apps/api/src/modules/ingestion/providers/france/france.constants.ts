export const FRANCE_DATASET_SLUG =
  'prix-des-carburants-en-france-flux-instantane-v2-amelioree';

export const FRANCE_OPENDATASOFT_DATASET_ID =
  'prix-des-carburants-en-france-flux-instantane-v2';

export const FRANCE_JSON_RESOURCE_ID = 'b0561905-7b5e-4f38-be50-df05708acb80';

export const FRANCE_DATA_GOUV_API =
  'https://www.data.gouv.fr/api/1/datasets/prix-des-carburants-en-france-flux-instantane-v2-amelioree/';

export const FRANCE_RECORDS_API_BASE = `https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/${FRANCE_OPENDATASOFT_DATASET_ID}/records`;

export const FRANCE_PROVIDER_CODE = 'FR_GOV_FUEL_PRICES';

export const FRANCE_FUEL_COLUMNS = [
  { column: 'gazole', externalName: 'Gazole' },
  { column: 'sp95', externalName: 'SP95' },
  { column: 'sp98', externalName: 'SP98' },
  { column: 'e10', externalName: 'E10' },
  { column: 'e85', externalName: 'E85' },
  { column: 'gplc', externalName: 'GPLc' },
] as const;

export const FRANCE_FUEL_ALIASES: Array<{
  externalName: string;
  fuelCode: string;
}> = [
  { externalName: 'Gazole', fuelCode: 'diesel' },
  { externalName: 'SP95', fuelCode: 'sp95' },
  { externalName: 'SP98', fuelCode: 'sp98' },
  { externalName: 'E10', fuelCode: 'e10' },
  { externalName: 'E85', fuelCode: 'e85' },
  { externalName: 'GPLc', fuelCode: 'lpg' },
];

export const FRANCE_PAGE_SIZE = 100;
