/**
 * Parse MITECO feed timestamps (DD/MM/YYYY HH:mm:ss) as Europe/Madrid civil time.
 * DST follows EU rules: last Sunday of March 02:00 → last Sunday of October 03:00 CEST.
 */
export function parseSpainLocalTimestamp(value: string): Date | null {
  const match = value.match(
    /^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/,
  );
  if (!match) {
    return null;
  }

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);

  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    hour > 23 ||
    minute > 59 ||
    second > 59
  ) {
    return null;
  }

  const offsetHours = isEuropeMadridCEST(year, month, day, hour) ? 2 : 1;
  const utcMs = Date.UTC(
    year,
    month - 1,
    day,
    hour - offsetHours,
    minute,
    second,
  );
  const parsed = new Date(utcMs);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

/** Last Sunday of a month (1-based month). */
function lastSundayOfMonth(year: number, month: number): number {
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const weekday = new Date(Date.UTC(year, month - 1, lastDay)).getUTCDay();
  return lastDay - weekday;
}

function isEuropeMadridCEST(
  year: number,
  month: number,
  day: number,
  hour: number,
): boolean {
  const marchLastSunday = lastSundayOfMonth(year, 3);
  const octoberLastSunday = lastSundayOfMonth(year, 10);

  if (month < 3 || month > 10) {
    return false;
  }
  if (month > 3 && month < 10) {
    return true;
  }
  if (month === 3) {
    if (day > marchLastSunday) return true;
    if (day < marchLastSunday) return false;
    return hour >= 2;
  }
  // October
  if (day < octoberLastSunday) return true;
  if (day > octoberLastSunday) return false;
  return hour < 3;
}
