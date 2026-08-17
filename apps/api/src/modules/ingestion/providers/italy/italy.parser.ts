import { parse } from 'csv-parse/sync';
import { z } from 'zod';
import {
  ITALY_BOUNDS,
  ITALY_CSV_DELIMITER,
  ITALY_UNSUPPORTED_FUEL_LABELS,
} from './italy.constants';
import type { PriceServiceMode } from '../../../ingestion/types/ingestion.types';

const extractionDateRe = /^Estrazione del (\d{4}-\d{2}-\d{2})$/;

const stationRowSchema = z.object({
  idImpianto: z.coerce.string().min(1),
  Gestore: z.string().optional(),
  Bandiera: z.string().optional(),
  'Tipo Impianto': z.string().optional(),
  'Nome Impianto': z.string().optional(),
  Indirizzo: z.string().optional(),
  Comune: z.string().optional(),
  Provincia: z.string().optional(),
  Latitudine: z.coerce.string().optional(),
  Longitudine: z.coerce.string().optional(),
});

const priceRowSchema = z.object({
  idImpianto: z.coerce.string().min(1),
  descCarburante: z.string().min(1),
  prezzo: z.coerce.string().min(1),
  isSelf: z.coerce.string().min(1),
  dtComu: z.string().optional(),
});

export type ItalyStationRow = z.infer<typeof stationRowSchema>;
export type ItalyPriceRow = z.infer<typeof priceRowSchema>;

export interface ItalyParsedCsv<T> {
  extractionDate: Date | null;
  rows: T[];
  skipped: number;
}

export function parseItalyExtractionDate(firstLine: string): Date | null {
  const match = extractionDateRe.exec(firstLine.trim());
  if (!match) {
    return null;
  }
  const parsed = new Date(`${match[1]}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function parseItalyCsvContent<T>(
  content: string,
  rowSchema: z.ZodType<T>,
): ItalyParsedCsv<T> {
  const lines = content.replace(/^\uFEFF/, '').split(/\r?\n/);
  const extractionDate = lines[0] ? parseItalyExtractionDate(lines[0]) : null;

  const body = lines.slice(1).join('\n');
  let rawRows: Record<string, string>[] = [];

  try {
    rawRows = parse(body, {
      columns: true,
      delimiter: ITALY_CSV_DELIMITER,
      skip_empty_lines: true,
      trim: true,
      relax_quotes: true,
      relax_column_count: true,
      skip_records_with_error: true,
    });
  } catch {
    return { extractionDate, rows: [], skipped: Math.max(0, lines.length - 2) };
  }

  const rows: T[] = [];
  let skipped = Math.max(0, lines.length - 1 - rawRows.length);

  for (const raw of rawRows) {
    const parsed = rowSchema.safeParse(raw);
    if (parsed.success) {
      rows.push(parsed.data);
    } else {
      skipped++;
    }
  }

  return { extractionDate, rows, skipped };
}

export function parseItalyStationLine(line: string): ItalyStationRow | null {
  const trimmed = line.trim();
  if (!trimmed) {
    return null;
  }

  const parts = trimmed.split('|');
  if (parts.length < 10) {
    return null;
  }

  const candidate = {
    idImpianto: parts[0]?.trim() ?? '',
    Gestore: parts[1]?.trim(),
    Bandiera: parts[2]?.trim(),
    'Tipo Impianto': parts[3]?.trim(),
    'Nome Impianto': parts[4]?.trim(),
    Indirizzo: parts
      .slice(5, parts.length - 4)
      .join('|')
      .trim(),
    Comune: parts[parts.length - 4]?.trim(),
    Provincia: parts[parts.length - 3]?.trim(),
    Latitudine: parts[parts.length - 2]?.trim(),
    Longitudine: parts[parts.length - 1]?.trim(),
  };

  const parsed = stationRowSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

export function parseItalyStationRow(
  content: string,
): ItalyParsedCsv<ItalyStationRow> {
  const lines = content.replace(/^\uFEFF/, '').split(/\r?\n/);
  const extractionDate = lines[0] ? parseItalyExtractionDate(lines[0]) : null;

  const rows: ItalyStationRow[] = [];
  let skipped = 0;

  for (let i = 2; i < lines.length; i++) {
    const parsed = parseItalyStationLine(lines[i]);
    if (parsed) {
      rows.push(parsed);
    } else if (lines[i]?.trim()) {
      skipped++;
    }
  }

  return { extractionDate, rows, skipped };
}

export function parseItalyPriceRow(
  content: string,
): ItalyParsedCsv<ItalyPriceRow> {
  return parseItalyCsvContent(content, priceRowSchema);
}

export function parseItalyCoordinates(
  latRaw: string | undefined,
  lonRaw: string | undefined,
): { lat: number; lon: number } | null {
  if (!latRaw || !lonRaw) {
    return null;
  }

  const lat = Number.parseFloat(latRaw.replace(',', '.'));
  const lon = Number.parseFloat(lonRaw.replace(',', '.'));

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return null;
  }

  if (lat === 0 && lon === 0) {
    return null;
  }

  if (
    lat < ITALY_BOUNDS.minLat ||
    lat > ITALY_BOUNDS.maxLat ||
    lon < ITALY_BOUNDS.minLon ||
    lon > ITALY_BOUNDS.maxLon
  ) {
    return null;
  }

  return { lat, lon };
}

export function parseItalyPriceValue(raw: string): string | null {
  const normalized = raw.trim().replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    return null;
  }
  const value = Number.parseFloat(normalized);
  if (!Number.isFinite(value) || value <= 0 || value > 20) {
    return null;
  }
  return value.toFixed(4);
}

export function parseItalyServiceMode(isSelfRaw: string): PriceServiceMode {
  const value = isSelfRaw.trim();
  if (value === '1') {
    return 'self';
  }
  if (value === '0') {
    return 'served';
  }
  return 'unknown';
}

/** Parse MIMIT dtComu timestamp (GG/MM/AAAA hh:mm:ss, Europe/Rome). */
export function parseItalyCommunicationTimestamp(raw: string): Date | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/.exec(
    raw.trim(),
  );
  if (!match) {
    return null;
  }

  const [, day, month, year, hour, minute, second] = match;
  const localIso = `${year}-${month}-${day}T${hour}:${minute}:${second}`;

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Rome',
    timeZoneName: 'shortOffset',
  });
  const parts = formatter.formatToParts(new Date(`${localIso}Z`));
  const offsetPart = parts.find((part) => part.type === 'timeZoneName')?.value;
  const offsetMatch = offsetPart?.match(/GMT([+-]\d+)/);
  const offsetHours = offsetMatch ? Number.parseInt(offsetMatch[1], 10) : 1;
  const utcMs =
    Date.UTC(
      Number.parseInt(year, 10),
      Number.parseInt(month, 10) - 1,
      Number.parseInt(day, 10),
      Number.parseInt(hour, 10),
      Number.parseInt(minute, 10),
      Number.parseInt(second, 10),
    ) -
    offsetHours * 60 * 60 * 1000;

  const parsed = new Date(utcMs);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Prices in force at 08:00 Europe/Rome on the extraction date's previous day. */
export function parseItalySnapshotEffectiveAt(extractionDate: Date): Date {
  const previousDay = new Date(extractionDate);
  previousDay.setUTCDate(previousDay.getUTCDate() - 1);

  const year = previousDay.getUTCFullYear();
  const month = String(previousDay.getUTCMonth() + 1).padStart(2, '0');
  const day = String(previousDay.getUTCDate()).padStart(2, '0');
  const localIso = `${year}-${month}-${day}T08:00:00`;

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Rome',
    timeZoneName: 'shortOffset',
  });
  const parts = formatter.formatToParts(new Date(`${localIso}Z`));
  const offsetPart = parts.find((part) => part.type === 'timeZoneName')?.value;
  const offsetMatch = offsetPart?.match(/GMT([+-]\d+)/);
  const offsetHours = offsetMatch ? Number.parseInt(offsetMatch[1], 10) : 1;

  return new Date(
    Date.UTC(
      year,
      Number.parseInt(month, 10) - 1,
      Number.parseInt(day, 10),
      8,
      0,
      0,
    ) -
      offsetHours * 60 * 60 * 1000,
  );
}

export function isUnsupportedItalyFuel(label: string): boolean {
  return (ITALY_UNSUPPORTED_FUEL_LABELS as readonly string[]).includes(label);
}
