import { SavingsCalculatorService } from './savings-calculator.service';

describe('SavingsCalculatorService', () => {
  const calculator = new SavingsCalculatorService();

  it('calculates effective saving with detour cost', () => {
    const result = calculator.calculate({
      stationPrice: '1.7500',
      referencePrice: '1.9500',
      refuelLiters: '50',
      detourMeters: 10_000,
      vehicleConsumptionLPer100Km: '8',
    });

    expect(result.grossSaving).toBe('10.0000');
    expect(result.extraFuelLiters).toBe('0.8000');
    expect(result.extraDrivingCost).toBe('1.5600');
    expect(result.effectiveSaving).toBe('8.4400');
  });

  it('returns negative effective saving when detour cost exceeds gross saving', () => {
    const result = calculator.calculate({
      stationPrice: '1.9400',
      referencePrice: '1.9500',
      refuelLiters: '20',
      detourMeters: 50_000,
      vehicleConsumptionLPer100Km: '10',
    });

    expect(Number(result.effectiveSaving)).toBeLessThan(0);
  });

  it('handles zero detour', () => {
    const result = calculator.calculate({
      stationPrice: '1.8000',
      referencePrice: '1.9500',
      refuelLiters: '40',
      detourMeters: 0,
      vehicleConsumptionLPer100Km: '7',
    });

    expect(result.extraFuelLiters).toBe('0.0000');
    expect(result.extraDrivingCost).toBe('0.0000');
    expect(result.effectiveSaving).toBe('6.0000');
  });

  it('returns zero gross saving for equal prices', () => {
    const result = calculator.calculate({
      stationPrice: '1.9500',
      referencePrice: '1.9500',
      refuelLiters: '45',
      detourMeters: 2000,
      vehicleConsumptionLPer100Km: '7',
    });

    expect(result.grossSaving).toBe('0.0000');
    expect(Number(result.effectiveSaving)).toBeLessThan(0);
  });

  it('computes median price for odd count', () => {
    expect(calculator.medianPrice(['1.9000', '1.8000', '1.7000'])).toBe(
      '1.8000',
    );
  });

  it('computes median price for even count', () => {
    expect(
      calculator.medianPrice(['1.9000', '1.7000', '1.8000', '1.7500']),
    ).toBe('1.7750');
  });
});
