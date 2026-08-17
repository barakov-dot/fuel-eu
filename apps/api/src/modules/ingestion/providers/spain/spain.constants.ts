export const SPAIN_PROVIDER_CODE = 'ES_MITECO_FUEL_PRICES';

export const SPAIN_DEFAULT_API_URL =
  'https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/EstacionesTerrestres/';

export const SPAIN_FUEL_COLUMNS = [
  { field: 'Precio Gasoleo A', externalName: 'Gasoleo A' },
  { field: 'Precio Gasoleo Premium', externalName: 'Gasoleo Premium' },
  { field: 'Precio Gasolina 95 E5', externalName: 'Gasolina 95 E5' },
  {
    field: 'Precio Gasolina 95 E5 Premium',
    externalName: 'Gasolina 95 E5 Premium',
  },
  { field: 'Precio Gasolina 95 E10', externalName: 'Gasolina 95 E10' },
  { field: 'Precio Gasolina 95 E85', externalName: 'Gasolina 95 E85' },
  { field: 'Precio Gasolina 98 E5', externalName: 'Gasolina 98 E5' },
  {
    field: 'Precio Gases licuados del petróleo',
    externalName: 'Gases licuados del petróleo',
  },
  {
    field: 'Precio Gas Natural Comprimido',
    externalName: 'Gas Natural Comprimido',
  },
  { field: 'Precio Gas Natural Licuado', externalName: 'Gas Natural Licuado' },
  { field: 'Precio Diésel Renovable', externalName: 'Diésel Renovable' },
  { field: 'Precio Hidrogeno', externalName: 'Hidrogeno' },
] as const;

/** Upstream fields intentionally not mapped — documented in docs/providers/spain.md */
export const SPAIN_UNSUPPORTED_FUEL_FIELDS = [
  'Precio Gasoleo B',
  'Precio Gasolina 95 E25',
  'Precio Gasolina 98 E10',
  'Precio Gasolina Renovable',
  'Precio Adblue',
  'Precio Amoniaco',
  'Precio Biodiesel',
  'Precio Bioetanol',
  'Precio Biogas Natural Comprimido',
  'Precio Biogas Natural Licuado',
  'Precio Metanol',
] as const;

export const SPAIN_FUEL_ALIASES: Array<{
  externalName: string;
  fuelCode: string;
}> = [
  { externalName: 'Gasoleo A', fuelCode: 'diesel' },
  { externalName: 'Gasoleo Premium', fuelCode: 'premium_diesel' },
  { externalName: 'Gasolina 95 E5', fuelCode: 'e5' },
  { externalName: 'Gasolina 95 E5 Premium', fuelCode: 'sp95' },
  { externalName: 'Gasolina 95 E10', fuelCode: 'e10' },
  { externalName: 'Gasolina 95 E85', fuelCode: 'e85' },
  { externalName: 'Gasolina 98 E5', fuelCode: 'sp98' },
  { externalName: 'Gases licuados del petróleo', fuelCode: 'lpg' },
  { externalName: 'Gas Natural Comprimido', fuelCode: 'cng' },
  { externalName: 'Gas Natural Licuado', fuelCode: 'lng' },
  { externalName: 'Diésel Renovable', fuelCode: 'hvo' },
  { externalName: 'Hidrogeno', fuelCode: 'hydrogen' },
];
