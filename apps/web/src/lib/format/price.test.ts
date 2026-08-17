import { formatPrice } from '@/lib/format/price';

describe('formatPrice', () => {
  it('formats EUR prices for en locale', () => {
    expect(formatPrice('1.9490', 'EUR', 'en')).toMatch(/1\.949/);
    expect(formatPrice('1.9490', 'EUR', 'en')).toContain('€');
  });

  it('formats prices for ru locale', () => {
    const formatted = formatPrice('2.1000', 'EUR', 'ru');
    expect(formatted).toContain('2,1');
  });
});
