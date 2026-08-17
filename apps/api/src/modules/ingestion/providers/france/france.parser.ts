import { z } from 'zod';

const franceGeomSchema = z
  .object({
    lon: z.number().finite(),
    lat: z.number().finite(),
  })
  .optional();

export const franceRecordSchema = z.object({
  id: z.union([z.number().int().positive(), z.string().min(1).max(32)]),
  geom: franceGeomSchema,
  latitude: z.union([z.string(), z.number()]).optional(),
  longitude: z.union([z.string(), z.number()]).optional(),
  adresse: z.string().max(500).optional().nullable(),
  ville: z.string().max(200).optional().nullable(),
  cp: z.string().max(20).optional().nullable(),
  pop: z.string().max(10).optional().nullable(),
  gazole_prix: z.number().finite().positive().max(20).optional().nullable(),
  gazole_maj: z.string().optional().nullable(),
  sp95_prix: z.number().finite().positive().max(20).optional().nullable(),
  sp95_maj: z.string().optional().nullable(),
  sp98_prix: z.number().finite().positive().max(20).optional().nullable(),
  sp98_maj: z.string().optional().nullable(),
  e10_prix: z.number().finite().positive().max(20).optional().nullable(),
  e10_maj: z.string().optional().nullable(),
  e85_prix: z.number().finite().positive().max(20).optional().nullable(),
  e85_maj: z.string().optional().nullable(),
  gplc_prix: z.number().finite().positive().max(20).optional().nullable(),
  gplc_maj: z.string().optional().nullable(),
  carburants_disponibles: z.array(z.string()).optional().nullable(),
  services_service: z.array(z.string()).optional().nullable(),
  departement: z.string().optional().nullable(),
  region: z.string().optional().nullable(),
});

export type FranceRawRecord = z.infer<typeof franceRecordSchema>;

export const franceRecordsResponseSchema = z.object({
  total_count: z.number().int().nonnegative(),
  results: z.array(z.unknown()),
});

export const franceFixtureSchema = z.object({
  total_count: z.number().int().nonnegative(),
  results: z.array(franceRecordSchema),
});

export function parseFranceRecord(
  raw: unknown,
): { ok: true; record: FranceRawRecord } | { ok: false; message: string } {
  const parsed = franceRecordSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues.map((i) => i.message).join('; '),
    };
  }
  return { ok: true, record: parsed.data };
}

/** Parse legacy scaled coordinate strings (e.g. "5004475" -> 50.04475). */
export function parseScaledCoordinate(
  value: string | number | undefined,
): number | null {
  if (value === undefined || value === null) {
    return null;
  }
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) {
    return null;
  }
  if (Math.abs(num) > 180) {
    return num / 100_000;
  }
  return num;
}

export function extractFranceCoordinates(record: FranceRawRecord): {
  lon: number;
  lat: number;
} | null {
  if (record.geom) {
    const { lon, lat } = record.geom;
    if (
      lon >= -180 &&
      lon <= 180 &&
      lat >= -90 &&
      lat <= 90 &&
      !(lon === 0 && lat === 0)
    ) {
      return { lon, lat };
    }
  }

  const lat = parseScaledCoordinate(record.latitude ?? undefined);
  const lon = parseScaledCoordinate(record.longitude ?? undefined);
  if (
    lat === null ||
    lon === null ||
    lat < -90 ||
    lat > 90 ||
    lon < -180 ||
    lon > 180
  ) {
    return null;
  }
  return { lon, lat };
}

export function parseFranceTimestamp(
  value: string | null | undefined,
): Date | null {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

export function formatFrancePrice(value: number): string {
  return value.toFixed(4);
}
