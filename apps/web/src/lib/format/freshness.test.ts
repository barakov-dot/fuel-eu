import { formatFreshness } from '@/lib/format/freshness';
import { getDictionary } from '@/lib/i18n/dictionaries';

describe('formatFreshness', () => {
  const en = getDictionary('en');
  const ru = getDictionary('ru');

  it('formats minutes in English', () => {
    expect(formatFreshness(240, en)).toBe('4 min ago');
  });

  it('formats hours in English', () => {
    expect(formatFreshness(7200, en)).toBe('2 h ago');
  });

  it('formats minutes in Russian', () => {
    expect(formatFreshness(240, ru)).toBe('4 мин назад');
  });
});
