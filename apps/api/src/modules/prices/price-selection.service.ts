import { Injectable } from '@nestjs/common';
import {
  CONFIRMATION_BONUS_PER_VOTE,
  FRESHNESS_POLICY,
  FRESHNESS_WEIGHT,
  MAX_CONFIRMATION_BONUS,
  MIN_CROWDSOURCED_SELECTION_CONFIDENCE,
  SELECTION_WEIGHTS,
  SERVICE_MODE_PRIORITY,
} from './price-selection.constants';

export type PriceServiceMode = 'self' | 'served' | 'unknown';

export type PriceCandidate = {
  observationId: string;
  stationId: string;
  fuelTypeId: string;
  price: string;
  currencyCode: string;
  observedAt: Date;
  receivedAt: Date;
  dataSourceId: string;
  dataSourceCode: string;
  dataSourceName: string;
  dataSourceType: string;
  sourceTrustWeight: number;
  observationConfidence: number | null;
  fuelCode: string;
  fuelNameEn: string;
  serviceMode: PriceServiceMode;
  confirmationCount?: number;
  disputeCount?: number;
};

export type SelectedPrice = PriceCandidate & {
  ageSeconds: number;
  selectionScore: number;
  confidence: string;
  verification?: {
    confirmations: number;
    disputes: number;
  };
};

@Injectable()
export class PriceSelectionService {
  computeFreshnessWeight(
    sourceType: string,
    observedAt: Date | string,
    now = new Date(),
  ): number {
    const policy = FRESHNESS_POLICY[sourceType] ?? FRESHNESS_POLICY.manual;
    const observedAtDate =
      observedAt instanceof Date ? observedAt : new Date(observedAt);
    const ageHours =
      (now.getTime() - observedAtDate.getTime()) / (1000 * 60 * 60);

    if (ageHours <= policy.freshHours) {
      return FRESHNESS_WEIGHT.fresh;
    }
    if (ageHours <= policy.agingHours) {
      return FRESHNESS_WEIGHT.aging;
    }
    return FRESHNESS_WEIGHT.stale;
  }

  computeConfidenceWeight(candidate: PriceCandidate): number {
    if (candidate.dataSourceType === 'crowdsourced') {
      const base = candidate.observationConfidence ?? 0;
      const confirmBonus = Math.min(
        MAX_CONFIRMATION_BONUS,
        (candidate.confirmationCount ?? 0) * CONFIRMATION_BONUS_PER_VOTE,
      );
      const disputePenalty = Math.min(
        0.2,
        (candidate.disputeCount ?? 0) * 0.05,
      );
      return Math.max(0, Math.min(1, base + confirmBonus - disputePenalty));
    }

    return candidate.sourceTrustWeight / 100;
  }

  computeSelectionScore(candidate: PriceCandidate, now = new Date()): number {
    const sourceTrust = candidate.sourceTrustWeight / 100;
    const freshness = this.computeFreshnessWeight(
      candidate.dataSourceType,
      candidate.observedAt,
      now,
    );
    const confidence = this.computeConfidenceWeight(candidate);

    if (
      candidate.dataSourceType === 'crowdsourced' &&
      confidence < MIN_CROWDSOURCED_SELECTION_CONFIDENCE
    ) {
      return 0;
    }

    return (
      sourceTrust * SELECTION_WEIGHTS.sourceTrust +
      freshness * SELECTION_WEIGHTS.freshness +
      confidence * SELECTION_WEIGHTS.confidence
    );
  }

  selectBestForFuel(
    candidates: PriceCandidate[],
    now = new Date(),
  ): SelectedPrice | null {
    if (candidates.length === 0) {
      return null;
    }

    const modeFiltered = this.filterByServiceModePreference(candidates);
    let best: PriceCandidate | null = null;
    let bestScore = -1;

    for (const candidate of modeFiltered) {
      const score = this.computeSelectionScore(candidate, now);
      if (score > bestScore) {
        bestScore = score;
        best = candidate;
      } else if (score === bestScore && best) {
        const candidateObserved =
          candidate.observedAt instanceof Date
            ? candidate.observedAt
            : new Date(candidate.observedAt);
        const bestObserved =
          best.observedAt instanceof Date
            ? best.observedAt
            : new Date(best.observedAt);
        const candidateReceived =
          candidate.receivedAt instanceof Date
            ? candidate.receivedAt
            : new Date(candidate.receivedAt);
        const bestReceived =
          best.receivedAt instanceof Date
            ? best.receivedAt
            : new Date(best.receivedAt);

        if (candidateObserved > bestObserved) {
          best = candidate;
        } else if (
          candidateObserved.getTime() === bestObserved.getTime() &&
          candidateReceived.getTime() > bestReceived.getTime()
        ) {
          best = candidate;
        } else if (
          candidateObserved.getTime() === bestObserved.getTime() &&
          candidateReceived.getTime() === bestReceived.getTime() &&
          candidate.observationId.localeCompare(best.observationId) > 0
        ) {
          best = candidate;
        }
      }
    }

    if (!best || bestScore <= 0) {
      return null;
    }

    return this.toSelectedPrice(best, bestScore, now);
  }

  selectBestByStationAndFuel(
    candidates: PriceCandidate[],
    now = new Date(),
  ): Map<string, SelectedPrice> {
    const grouped = new Map<string, PriceCandidate[]>();

    for (const candidate of candidates) {
      const key = `${candidate.stationId}:${candidate.fuelTypeId}`;
      const group = grouped.get(key) ?? [];
      group.push(candidate);
      grouped.set(key, group);
    }

    const result = new Map<string, SelectedPrice>();

    for (const [key, group] of grouped) {
      const selected = this.selectBestForFuel(group, now);
      if (selected) {
        result.set(key, selected);
      }
    }

    return result;
  }

  toSelectedPrice(
    candidate: PriceCandidate,
    selectionScore: number,
    now = new Date(),
  ): SelectedPrice {
    const observedAtDate =
      candidate.observedAt instanceof Date
        ? candidate.observedAt
        : new Date(candidate.observedAt);
    const ageSeconds = Math.max(
      0,
      Math.floor((now.getTime() - observedAtDate.getTime()) / 1000),
    );

    const confidenceValue = this.computeConfidenceWeight(candidate);

    const selected: SelectedPrice = {
      ...candidate,
      ageSeconds,
      selectionScore,
      confidence: confidenceValue.toFixed(4),
    };

    if (candidate.dataSourceType === 'crowdsourced') {
      selected.verification = {
        confirmations: candidate.confirmationCount ?? 0,
        disputes: candidate.disputeCount ?? 0,
      };
    }

    return selected;
  }

  private filterByServiceModePreference(
    candidates: PriceCandidate[],
  ): PriceCandidate[] {
    const maxPriority = Math.max(
      ...candidates.map(
        (candidate) =>
          SERVICE_MODE_PRIORITY[candidate.serviceMode ?? 'unknown'],
      ),
    );
    return candidates.filter(
      (candidate) =>
        SERVICE_MODE_PRIORITY[candidate.serviceMode ?? 'unknown'] ===
        maxPriority,
    );
  }
}
