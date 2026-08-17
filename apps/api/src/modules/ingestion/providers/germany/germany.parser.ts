import { z } from 'zod';
import { formatPriceDecimal } from '../../utils/locale-decimal';
import { GERMANY_FUEL_FIELDS } from './germany.constants';

const uuidSchema = z.string().uuid();

export const germanyListStationSchema = z
  .object({
    id: uuidSchema,
    name: z.string().max(300).optional(),
    brand: z.string().max(200).optional(),
    street: z.string().max(300).optional(),
    houseNumber: z.union([z.string(), z.number()]).optional(),
    place: z.string().max(200).optional(),
    postCode: z.union([z.string(), z.number()]).optional(),
    lat: z.number().finite(),
    lng: z.number().finite(),
    dist: z.number().optional(),
    diesel: z.union([z.number(), z.boolean()]).optional(),
    e5: z.union([z.number(), z.boolean()]).optional(),
    e10: z.union([z.number(), z.boolean()]).optional(),
    isOpen: z.boolean().optional(),
  })
  .passthrough();

export type GermanyListStation = z.infer<typeof germanyListStationSchema>;

export const germanyListResponseSchema = z.object({
  ok: z.literal(true),
  license: z.string().optional(),
  data: z.string().optional(),
  status: z.string().optional(),
  stations: z.array(z.unknown()),
});

export const germanyPriceEntrySchema = z
  .object({
    status: z.enum(['open', 'closed', 'no prices']),
    diesel: z.union([z.number(), z.boolean()]).optional(),
    e5: z.union([z.number(), z.boolean()]).optional(),
    e10: z.union([z.number(), z.boolean()]).optional(),
  })
  .passthrough();

export type GermanyPriceEntry = z.infer<typeof germanyPriceEntrySchema>;

export const germanyPricesResponseSchema = z.object({
  ok: z.literal(true),
  license: z.string().optional(),
  data: z.string().optional(),
  prices: z.record(z.string(), z.unknown()),
});

export const germanyFixtureSchema = z.object({
  syncMode: z.enum(['full', 'prices']).default('full'),
  fetchedAt: z.string().datetime(),
  license: z.string().optional(),
  data: z.string().optional(),
  stations: z.array(z.unknown()).optional(),
  priceEntries: z
    .array(
      z.object({
        id: uuidSchema,
        status: z.enum(['open', 'closed', 'no prices']),
        diesel: z.union([z.number(), z.boolean()]).optional(),
        e5: z.union([z.number(), z.boolean()]).optional(),
        e10: z.union([z.number(), z.boolean()]).optional(),
      }),
    )
    .optional(),
});

export type GermanyFixture = z.infer<typeof germanyFixtureSchema>;

export function parseGermanyListResponse(
  raw: unknown,
): { ok: true; stations: unknown[] } | { ok: false; message: string } {
  const parsed = germanyListResponseSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues.map((i) => i.message).join('; '),
    };
  }
  return { ok: true, stations: parsed.data.stations };
}

export function parseGermanyPricesResponse(
  raw: unknown,
):
  | { ok: true; prices: Record<string, unknown> }
  | { ok: false; message: string } {
  const parsed = germanyPricesResponseSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues.map((i) => i.message).join('; '),
    };
  }
  return { ok: true, prices: parsed.data.prices };
}

export function parseGermanyListStation(
  raw: unknown,
): { ok: true; station: GermanyListStation } | { ok: false; message: string } {
  const parsed = germanyListStationSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues.map((i) => i.message).join('; '),
    };
  }
  return { ok: true, station: parsed.data };
}

export function parseGermanyPriceValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (value <= 0 || value > 20) {
      return null;
    }
    return value;
  }
  return null;
}

export function formatGermanyPrice(value: number): string {
  return formatPriceDecimal(value, 4);
}

export function getGermanyFuelFields(
  record: Pick<GermanyListStation, 'e5' | 'e10' | 'diesel'>,
): Array<{ externalName: string; rawValue: unknown }> {
  return GERMANY_FUEL_FIELDS.map((field) => ({
    externalName: field,
    rawValue: record[field],
  }));
}

export function buildGermanyAddressLine(
  street?: string,
  houseNumber?: string | number,
): string | undefined {
  const streetPart = street?.trim();
  const housePart =
    houseNumber === undefined || houseNumber === null
      ? undefined
      : String(houseNumber).trim();

  if (streetPart && housePart) {
    return `${streetPart} ${housePart}`.slice(0, 500);
  }
  return streetPart?.slice(0, 500);
}
