/**
 * Price selection policy constants.
 * See docs/price-selection.md.
 */

export type SourceFreshnessPolicy = {
  freshHours: number;
  agingHours: number;
};

/** Source-type freshness thresholds (hours). */
export const FRESHNESS_POLICY: Record<string, SourceFreshnessPolicy> = {
  official: { freshHours: 6, agingHours: 24 },
  commercial: { freshHours: 12, agingHours: 48 },
  fuel_chain: { freshHours: 12, agingHours: 48 },
  third_party: { freshHours: 12, agingHours: 48 },
  crowdsourced: { freshHours: 2, agingHours: 8 },
  manual: { freshHours: 24, agingHours: 72 },
};

/** Freshness weight tiers. */
export const FRESHNESS_WEIGHT = {
  fresh: 1.0,
  aging: 0.6,
  stale: 0.2,
} as const;

/** Selection score component weights (must sum to 1.0). */
export const SELECTION_WEIGHTS = {
  sourceTrust: 0.4,
  freshness: 0.35,
  confidence: 0.25,
} as const;

/** Max age (hours) for candidate observations in selection queries. */
export const CANDIDATE_MAX_AGE_HOURS = 168;

/** Minimum crowdsourced confidence to compete with stale official data. */
export const MIN_CROWDSOURCED_SELECTION_CONFIDENCE = 0.5;

/** Default service mode preference for car fuel (higher = preferred). */
export const SERVICE_MODE_PRIORITY: Record<
  'self' | 'served' | 'unknown',
  number
> = {
  self: 3,
  unknown: 2,
  served: 1,
};

/** Bonus multiplier when multiple independent confirmations exist. */
export const CONFIRMATION_BONUS_PER_VOTE = 0.03;
export const MAX_CONFIRMATION_BONUS = 0.15;
