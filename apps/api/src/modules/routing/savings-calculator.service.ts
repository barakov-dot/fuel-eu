import Decimal from 'decimal.js';
import { Injectable } from '@nestjs/common';

export type SavingsInput = {
  stationPrice: string;
  referencePrice: string;
  refuelLiters: string;
  detourMeters: number;
  vehicleConsumptionLPer100Km: string;
};

export type SavingsResult = {
  referencePrice: string;
  grossSaving: string;
  extraFuelLiters: string;
  extraDrivingCost: string;
  effectiveSaving: string;
};

const OUTPUT_SCALE = 4;

function formatDecimal(value: Decimal): string {
  return value.toFixed(OUTPUT_SCALE);
}

@Injectable()
export class SavingsCalculatorService {
  calculate(input: SavingsInput): SavingsResult {
    const stationPrice = new Decimal(input.stationPrice);
    const referencePrice = new Decimal(input.referencePrice);
    const refuelLiters = new Decimal(input.refuelLiters);
    const consumption = new Decimal(input.vehicleConsumptionLPer100Km);
    const detourKm = new Decimal(Math.max(0, input.detourMeters)).div(1000);

    const grossSaving = referencePrice.minus(stationPrice).times(refuelLiters);
    const extraFuelLiters = detourKm.div(100).times(consumption);
    const extraDrivingCost = extraFuelLiters.times(referencePrice);
    const effectiveSaving = grossSaving.minus(extraDrivingCost);

    return {
      referencePrice: formatDecimal(referencePrice),
      grossSaving: formatDecimal(grossSaving),
      extraFuelLiters: formatDecimal(extraFuelLiters),
      extraDrivingCost: formatDecimal(extraDrivingCost),
      effectiveSaving: formatDecimal(effectiveSaving),
    };
  }

  medianPrice(prices: string[]): string | undefined {
    if (prices.length === 0) {
      return undefined;
    }

    const sorted = [...prices]
      .map((price) => new Decimal(price))
      .sort((a, b) => a.comparedTo(b));

    const mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 1) {
      return formatDecimal(sorted[mid]);
    }

    return formatDecimal(sorted[mid - 1].plus(sorted[mid]).div(2));
  }
}
