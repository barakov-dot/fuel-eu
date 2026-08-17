import { z } from 'zod';
import {
  formatPriceDecimal,
  parseLocaleDecimal,
} from '../../utils/locale-decimal';
import { parseSpainLocalTimestamp } from '../../utils/spain-timestamp';
import { SPAIN_FUEL_COLUMNS } from './spain.constants';

const spainPriceFieldSchema = z.string().max(32).optional();

export const spainStationSchema = z
  .object({
    IDEESS: z.union([z.string().min(1).max(32), z.number().int().positive()]),
    Latitud: z.string().max(32),
    'Longitud (WGS84)': z.string().max(32),
    Dirección: z.string().max(500).optional(),
    'C.P.': z.string().max(20).optional(),
    Localidad: z.string().max(200).optional(),
    Municipio: z.string().max(200).optional(),
    Provincia: z.string().max(200).optional(),
    Rótulo: z.string().max(200).optional(),
    Horario: z.string().max(500).optional(),
    'Tipo Venta': z.string().max(32).optional(),
    Margen: z.string().max(8).optional(),
    Remisión: z.string().max(32).optional(),
    IDMunicipio: z.string().max(16).optional(),
    IDProvincia: z.string().max(16).optional(),
    IDCCAA: z.string().max(16).optional(),
    'Precio Gasoleo A': spainPriceFieldSchema,
    'Precio Gasoleo B': spainPriceFieldSchema,
    'Precio Gasoleo Premium': spainPriceFieldSchema,
    'Precio Gasolina 95 E5': spainPriceFieldSchema,
    'Precio Gasolina 95 E5 Premium': spainPriceFieldSchema,
    'Precio Gasolina 95 E10': spainPriceFieldSchema,
    'Precio Gasolina 95 E25': spainPriceFieldSchema,
    'Precio Gasolina 95 E85': spainPriceFieldSchema,
    'Precio Gasolina 98 E5': spainPriceFieldSchema,
    'Precio Gasolina 98 E10': spainPriceFieldSchema,
    'Precio Gasolina Renovable': spainPriceFieldSchema,
    'Precio Gases licuados del petróleo': spainPriceFieldSchema,
    'Precio Gas Natural Comprimido': spainPriceFieldSchema,
    'Precio Gas Natural Licuado': spainPriceFieldSchema,
    'Precio Diésel Renovable': spainPriceFieldSchema,
    'Precio Hidrogeno': spainPriceFieldSchema,
    'Precio Adblue': spainPriceFieldSchema,
    'Precio Amoniaco': spainPriceFieldSchema,
    'Precio Biodiesel': spainPriceFieldSchema,
    'Precio Bioetanol': spainPriceFieldSchema,
    'Precio Biogas Natural Comprimido': spainPriceFieldSchema,
    'Precio Biogas Natural Licuado': spainPriceFieldSchema,
    'Precio Metanol': spainPriceFieldSchema,
  })
  .passthrough();

export type SpainRawStation = z.infer<typeof spainStationSchema>;

export const spainResponseSchema = z.object({
  Fecha: z.string().min(1).max(64),
  ListaEESSPrecio: z.array(z.unknown()),
  Nota: z.string().optional(),
  ResultadoConsulta: z.string().optional(),
});

export type SpainRawResponse = z.infer<typeof spainResponseSchema>;

export function parseSpainResponse(
  raw: unknown,
): { ok: true; response: SpainRawResponse } | { ok: false; message: string } {
  const parsed = spainResponseSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues.map((i) => i.message).join('; '),
    };
  }
  return { ok: true, response: parsed.data };
}

export function parseSpainStation(
  raw: unknown,
): { ok: true; record: SpainRawStation } | { ok: false; message: string } {
  const parsed = spainStationSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues.map((i) => i.message).join('; '),
    };
  }
  return { ok: true, record: parsed.data };
}

export function extractSpainCoordinates(record: SpainRawStation): {
  lon: number;
  lat: number;
} | null {
  const lat = parseLocaleDecimal(record.Latitud);
  const lon = parseLocaleDecimal(record['Longitud (WGS84)']);

  if (
    lat === null ||
    lon === null ||
    lat < -90 ||
    lat > 90 ||
    lon < -180 ||
    lon > 180 ||
    (lat === 0 && lon === 0)
  ) {
    return null;
  }

  return { lon, lat };
}

export function parseSpainPrice(value: string | undefined): number | null {
  if (!value || !value.trim()) {
    return null;
  }
  const parsed = parseLocaleDecimal(value);
  if (parsed === null || parsed <= 0 || parsed > 20) {
    return null;
  }
  return parsed;
}

export function formatSpainPrice(value: number): string {
  return formatPriceDecimal(value, 4);
}

export function parseSpainFeedTimestamp(fecha: string): Date | null {
  return parseSpainLocalTimestamp(fecha);
}

export function getSpainPriceFields(
  record: SpainRawStation,
): Array<{ field: string; externalName: string; rawValue: string }> {
  const prices: Array<{
    field: string;
    externalName: string;
    rawValue: string;
  }> = [];

  for (const fuel of SPAIN_FUEL_COLUMNS) {
    const rawValue = record[fuel.field as keyof SpainRawStation];
    if (typeof rawValue === 'string' && rawValue.trim()) {
      prices.push({
        field: fuel.field,
        externalName: fuel.externalName,
        rawValue,
      });
    }
  }

  return prices;
}
