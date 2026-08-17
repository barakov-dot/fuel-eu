import { z } from 'zod';
import { formatPriceDecimal } from '../../utils/locale-decimal';
import { isInCroatiaBounds } from './croatia.constants';

const cjenikSchema = z.object({
  id: z.number().int().positive(),
  gorivo_id: z.number().int().positive(),
  cijena: z.number().positive().max(20),
});

export const croatiaStationSchema = z.object({
  id: z.number().int().positive(),
  naziv: z.string().max(300),
  adresa: z.string().max(500).optional(),
  mjesto: z.string().max(200).optional(),
  obveznik_id: z.number().int().positive().optional(),
  lat: z.union([z.string(), z.number()]),
  long: z.union([z.string(), z.number()]),
  cjenici: z.array(cjenikSchema).optional(),
});

export type CroatiaRawStation = z.infer<typeof croatiaStationSchema>;

export const croatiaGorivoSchema = z.object({
  id: z.number().int().positive(),
  vrsta_goriva_id: z.number().int().positive().nullable().optional(),
});

export const croatiaVrstaGorivaSchema = z.object({
  id: z.number().int().positive(),
  vrsta_goriva: z.string().max(200),
  tip_goriva_id: z.number().int().positive().optional(),
});

export const croatiaObveznikSchema = z.object({
  id: z.number().int().positive(),
  naziv: z.string().max(200),
});

export const croatiaFeedSchema = z.object({
  postajas: z.array(z.unknown()),
  gorivos: z.array(z.unknown()).optional(),
  vrsta_gorivas: z.array(z.unknown()).optional(),
  obvezniks: z.array(z.unknown()).optional(),
});

export type CroatiaParsedFeed = {
  stations: CroatiaRawStation[];
  gorivoToVrstaName: Map<number, string>;
  brandMap: Map<number, string>;
};

export function parseCroatiaFeed(raw: unknown):
  | {
      ok: true;
      feed: CroatiaParsedFeed;
    }
  | { ok: false; message: string } {
  const parsed = croatiaFeedSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues.map((i) => i.message).join('; '),
    };
  }

  const vrstaById = new Map<number, string>();
  for (const item of parsed.data.vrsta_gorivas ?? []) {
    const v = croatiaVrstaGorivaSchema.safeParse(item);
    if (v.success) {
      vrstaById.set(v.data.id, v.data.vrsta_goriva.trim());
    }
  }

  const gorivoToVrstaName = new Map<number, string>();
  for (const item of parsed.data.gorivos ?? []) {
    const g = croatiaGorivoSchema.safeParse(item);
    if (g.success && g.data.vrsta_goriva_id != null) {
      const name = vrstaById.get(g.data.vrsta_goriva_id);
      if (name) {
        gorivoToVrstaName.set(g.data.id, name);
      }
    }
  }

  const brandMap = new Map<number, string>();
  for (const item of parsed.data.obvezniks ?? []) {
    const b = croatiaObveznikSchema.safeParse(item);
    if (b.success) {
      brandMap.set(b.data.id, b.data.naziv.trim());
    }
  }

  const stations: CroatiaRawStation[] = [];
  for (const item of parsed.data.postajas) {
    const s = croatiaStationSchema.safeParse(item);
    if (s.success) {
      stations.push(s.data);
    }
  }

  return {
    ok: true,
    feed: { stations, gorivoToVrstaName, brandMap },
  };
}

export function parseCroatiaStation(
  raw: unknown,
): { ok: true; record: CroatiaRawStation } | { ok: false; message: string } {
  const parsed = croatiaStationSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues.map((i) => i.message).join('; '),
    };
  }
  return { ok: true, record: parsed.data };
}

/**
 * MZOE API stores coordinates with swapped field names:
 * "lat" contains longitude, "long" contains latitude.
 */
export function extractCroatiaCoordinates(
  record: CroatiaRawStation,
): { lat: number; lon: number } | null {
  const lon = Number.parseFloat(String(record.lat));
  const lat = Number.parseFloat(String(record.long));

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return null;
  }
  if (lat === 0 && lon === 0) {
    return null;
  }
  if (!isInCroatiaBounds(lat, lon)) {
    return null;
  }
  return { lat, lon };
}

export function formatCroatiaPrice(value: number): string {
  return formatPriceDecimal(value, 4);
}

export function getCroatiaStationPrices(
  record: CroatiaRawStation,
  gorivoToVrstaName: Map<number, string>,
): Array<{ externalName: string; rawValue: number }> {
  const prices: Array<{ externalName: string; rawValue: number }> = [];

  for (const c of record.cjenici ?? []) {
    const externalName = gorivoToVrstaName.get(c.gorivo_id);
    if (!externalName) {
      continue;
    }
    if (c.cijena > 0) {
      prices.push({ externalName, rawValue: c.cijena });
    }
  }

  return prices;
}
