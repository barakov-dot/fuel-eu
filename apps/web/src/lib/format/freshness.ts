import type { Dictionary } from '@/lib/i18n/dictionaries';
import { t } from '@/lib/i18n/dictionaries';

export function formatFreshness(
  ageSeconds: number,
  dict: Dictionary,
): string {
  if (ageSeconds < 60) {
    return dict.freshness.justNow;
  }

  const minutes = Math.floor(ageSeconds / 60);
  if (minutes < 60) {
    return t(dict.freshness.minutes, { count: minutes });
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return t(dict.freshness.hours, { count: hours });
  }

  const days = Math.floor(hours / 24);
  if (days === 1) {
    return dict.freshness.yesterday;
  }

  if (days < 7) {
    return t(dict.freshness.days, { count: days });
  }

  return t(dict.freshness.days, { count: days });
}
