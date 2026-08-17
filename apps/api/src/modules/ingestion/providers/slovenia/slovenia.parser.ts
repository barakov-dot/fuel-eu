import { z } from 'zod';
import { formatPriceDecimal } from '../../utils/locale-decimal';
import {
  SLOVENIA_FUEL_PRICE_KEYS,
  isInSloveniaBounds,
} from './slovenia.constants';

const priceSchema = z.number().positive().max(20).nullable();

export const sloveniaPricesSchema = z
  .object({
    '95': priceSchema.optional(),
    dizel: priceSchema.optional(),
    '98': priceSchema.optional(),
    '100': priceSchema.optional(),
    'dizel-premium': priceSchema.optional(),
    'avtoplin-lpg': priceSchema.optional(),
    KOEL: priceSchema.optional(),
    hvo: priceSchema.optional(),
    cng: priceSchema.optional(),
    lng: priceSchema.optional(),
  })
  .passthrough();

export const sloveniaStationSchema = z.object({
  pk: z.number().int().positive(),
  franchise: z.number().int().positive().nullable().optional(),
  name: z.string().max(300),
  address: z.string().max(500).optional(),
  lat: z.number().finite(),
  lng: z.number().finite(),
  prices: sloveniaPricesSchema,
  zip_code: z.string().max(16).optional(),
  open_hours: z.string().max(1000).optional(),
});

export type SloveniaRawStation = z.infer<typeof sloveniaStationSchema>;

export const sloveniaSearchResponseSchema = z.object({
  count: z.number().int().nonnegative(),
  next: z.string().nullable(),
  previous: z.string().nullable(),
  results: z.array(z.unknown()),
});

export const sloveniaFranchiseSchema = z.object({
  pk: z.number().int().positive(),
  name: z.string().max(200),
});

export type SloveniaFranchise = z.infer<typeof sloveniaFranchiseSchema>;

export function parseSloveniaStation(
  raw: unknown,
): { ok: true; record: SloveniaRawStation } | { ok: false; message: string } {
  const parsed = sloveniaStationSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues.map((i) => i.message).join('; '),
    };
  }
  return { ok: true, record: parsed.data };
}

export function parseSloveniaSearchResponse(raw: unknown):
  | {
      ok: true;
      response: z.infer<typeof sloveniaSearchResponseSchema>;
    }
  | { ok: false; message: string } {
  const parsed = sloveniaSearchResponseSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues.map((i) => i.message).join('; '),
    };
  }
  return { ok: true, response: parsed.data };
}

export function parseSloveniaFranchises(raw: unknown): Map<number, string> {
  const map = new Map<number, string>();
  if (!Array.isArray(raw)) {
    return map;
  }
  for (const item of raw) {
    const parsed = sloveniaFranchiseSchema.safeParse(item);
    if (parsed.success) {
      map.set(parsed.data.pk, parsed.data.name.trim());
    }
  }
  return map;
}

export function extractSloveniaCoordinates(
  record: SloveniaRawStation,
): { lat: number; lon: number } | null {
  const { lat, lng: lon } = record;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return null;
  }
  if (lat === 0 && lon === 0) {
    return null;
  }
  if (!isInSloveniaBounds(lat, lon)) {
    return null;
  }
  return { lat, lon };
}

export function getSloveniaPriceFields(record: SloveniaRawStation): Array<{
  externalName: string;
  rawValue: number;
}> {
  const fields: Array<{ externalName: string; rawValue: number }> = [];
  const prices = record.prices;

  for (const fuel of SLOVENIA_FUEL_PRICE_KEYS) {
    const value = prices[fuel.key as keyof typeof prices];
    if (typeof value === 'number' && value > 0) {
      fields.push({ externalName: fuel.externalName, rawValue: value });
    }
  }

  return fields;
}

export function formatSloveniaPrice(value: number): string {
  return formatPriceDecimal(value, 4);
}
