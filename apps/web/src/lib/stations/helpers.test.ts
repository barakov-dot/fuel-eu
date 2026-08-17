import { mergeMapStations, findPriceForFuel, splitFuelTypes } from '@/lib/stations/helpers';
import type { FuelType } from '@/lib/api/types';

describe('station helpers', () => {
  it('merges map stations by id without duplicates', () => {
    const nearby = [
      { id: 'a', lat: 1, lon: 2, name: 'A', brand: null },
      { id: 'b', lat: 3, lon: 4, name: 'B', brand: null },
    ];
    const bbox = [
      { id: 'b', lat: 3, lon: 4, name: 'B2', brand: null, priceLabel: '€1.80' },
      { id: 'c', lat: 5, lon: 6, name: 'C', brand: null },
    ];

    const merged = mergeMapStations(nearby, bbox);
    expect(merged).toHaveLength(3);
    expect(merged.find((item) => item.id === 'b')?.name).toBe('B');
  });

  it('finds selected fuel price', () => {
    const prices = [
      {
        fuelType: { id: 'fuel-1', code: 'e10', name: 'E10' },
        price: '1.80',
        currency: 'EUR',
        observedAt: '2026-01-01T00:00:00.000Z',
        ageSeconds: 10,
        source: { id: 's', code: 'fr', name: 'France', type: 'official' },
        confidence: 1,
      },
    ];

    expect(findPriceForFuel(prices, 'fuel-1')?.price).toBe('1.80');
    expect(findPriceForFuel(prices, 'missing')).toBeUndefined();
  });

  it('splits prominent and other fuel types', () => {
    const fuelTypes: FuelType[] = [
      {
        id: '1',
        code: 'lpg',
        nameEn: 'LPG',
        nameRu: null,
        category: 'gas',
        octaneRating: null,
        biofuelPercentage: null,
        unit: 'liter',
        isActive: true,
      },
      {
        id: '2',
        code: 'e10',
        nameEn: 'E10',
        nameRu: null,
        category: 'gasoline',
        octaneRating: 95,
        biofuelPercentage: 10,
        unit: 'liter',
        isActive: true,
      },
      {
        id: '3',
        code: 'cng',
        nameEn: 'CNG',
        nameRu: null,
        category: 'gas',
        octaneRating: null,
        biofuelPercentage: null,
        unit: 'kilogram',
        isActive: true,
      },
    ];

    const { prominent, other } = splitFuelTypes(fuelTypes);
    expect(prominent.map((fuel) => fuel.code)).toEqual(['e10', 'lpg']);
    expect(other.map((fuel) => fuel.code)).toEqual(['cng']);
  });
});
