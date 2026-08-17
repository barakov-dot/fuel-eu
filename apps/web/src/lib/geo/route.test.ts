import {
  encodeRouteLabel,
  formatRoutePointLabel,
  parseRouteLabel,
} from '@/lib/geo/route';

describe('route geo helpers', () => {
  it('formats route point label with fallback coordinates', () => {
    expect(
      formatRoutePointLabel({ lat: 48.8566, lon: 2.3522, label: 'Paris' }),
    ).toBe('Paris');
    expect(formatRoutePointLabel({ lat: 48.8566, lon: 2.3522 })).toBe(
      '48.856600,2.352200',
    );
  });

  it('encodes short labels for URL usage', () => {
    expect(encodeRouteLabel('Paris')).toBe('Paris');
    expect(encodeRouteLabel(undefined)).toBeNull();
    expect(encodeRouteLabel('x'.repeat(81))).toBeNull();
  });

  it('parses route labels from URL params', () => {
    expect(parseRouteLabel('Paris')).toBe('Paris');
    expect(parseRouteLabel(null)).toBeUndefined();
  });
});
