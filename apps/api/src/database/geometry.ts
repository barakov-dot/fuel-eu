import { sql, type SQL } from 'drizzle-orm';

/** WGS84 point with SRID 4326 — use for all station location inserts/updates. */
export function wgs84Point(lon: number, lat: number): SQL {
  return sql`ST_SetSRID(ST_MakePoint(${lon}, ${lat}), 4326)`;
}
