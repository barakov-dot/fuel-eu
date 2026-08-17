import { Injectable } from '@nestjs/common';
import {
  ANOMALY_DEVIATION_RATIO,
  DISTANCE_NEAR_METERS,
  DISTANCE_PLAUSIBLE_METERS,
  MAX_EFFECTIVE_VOTE_CONTRIBUTION,
} from './crowdsourcing.constants';
import { PHOTO_EVIDENCE_CONFIDENCE_BOOST } from '../ocr/ocr.constants';
import { ReputationService } from './reputation.service';

export type DistanceClass = 'near' | 'plausible' | 'far' | 'unknown';

export type ConfidenceInput = {
  reputationScore: number;
  distanceMeters: number | null;
  reportedAt: Date;
  now?: Date;
  trustedReferencePrice: string | null;
  reportedPrice: string;
  confirmCount?: number;
  disputeCount?: number;
  voterReputationScores?: number[];
  /** User-confirmed photo evidence linked to the report. */
  hasPhotoEvidence?: boolean;
};

@Injectable()
export class ConfidenceService {
  constructor(private readonly reputationService: ReputationService) {}

  classifyDistance(distanceMeters: number | null): DistanceClass {
    if (distanceMeters === null) {
      return 'unknown';
    }
    if (distanceMeters <= DISTANCE_NEAR_METERS) {
      return 'near';
    }
    if (distanceMeters <= DISTANCE_PLAUSIBLE_METERS) {
      return 'plausible';
    }
    return 'far';
  }

  distanceMultiplier(distanceClass: DistanceClass): number {
    switch (distanceClass) {
      case 'near':
        return 1.0;
      case 'plausible':
        return 0.85;
      case 'far':
        return 0.6;
      default:
        return 0.75;
    }
  }

  isAnomaly(reportedPrice: string, referencePrice: string | null): boolean {
    if (!referencePrice) {
      return false;
    }
    const reported = Number(reportedPrice);
    const reference = Number(referencePrice);
    if (
      !Number.isFinite(reported) ||
      !Number.isFinite(reference) ||
      reference <= 0
    ) {
      return false;
    }
    const ratio = Math.abs(reported - reference) / reference;
    return ratio > ANOMALY_DEVIATION_RATIO;
  }

  ageMultiplier(reportedAt: Date, now = new Date()): number {
    const ageHours = (now.getTime() - reportedAt.getTime()) / (1000 * 60 * 60);
    if (ageHours <= 2) {
      return 1.0;
    }
    if (ageHours <= 8) {
      return 0.9;
    }
    if (ageHours <= 24) {
      return 0.75;
    }
    return 0.5;
  }

  computeVoteAdjustment(
    confirmCount: number,
    disputeCount: number,
    voterReputationScores: number[] = [],
  ): number {
    let effectiveConfirms = 0;
    let effectiveDisputes = 0;

    for (const score of voterReputationScores.slice(
      0,
      MAX_EFFECTIVE_VOTE_CONTRIBUTION * 2,
    )) {
      const weight =
        0.5 + (this.reputationService.clampScore(score) / 100) * 0.5;
      // Applied per-vote in caller; here we use aggregate counts with cap
      void weight;
    }

    effectiveConfirms = Math.min(confirmCount, MAX_EFFECTIVE_VOTE_CONTRIBUTION);
    effectiveDisputes = Math.min(disputeCount, MAX_EFFECTIVE_VOTE_CONTRIBUTION);

    return (effectiveConfirms - effectiveDisputes) * 0.04;
  }

  computeInitialConfidence(input: ConfidenceInput): number {
    const base = this.reputationService.reputationToBaseConfidence(
      input.reputationScore,
    );
    const distanceClass = this.classifyDistance(input.distanceMeters);
    let confidence =
      base *
      this.distanceMultiplier(distanceClass) *
      this.ageMultiplier(input.reportedAt, input.now);

    if (this.isAnomaly(input.reportedPrice, input.trustedReferencePrice)) {
      confidence *= 0.5;
    }

    if (input.hasPhotoEvidence) {
      confidence += PHOTO_EVIDENCE_CONFIDENCE_BOOST;
    }

    confidence += this.computeVoteAdjustment(
      input.confirmCount ?? 0,
      input.disputeCount ?? 0,
      input.voterReputationScores,
    );

    return this.clampConfidence(confidence);
  }

  clampConfidence(value: number): number {
    return Math.max(0, Math.min(1, Number(value.toFixed(4))));
  }

  formatConfidence(value: number): string {
    return this.clampConfidence(value).toFixed(4);
  }
}
