/**
 * Centralized crowdsourcing policy constants.
 * See docs/crowdsourcing.md and docs/price-selection.md.
 */

/** Reputation score bounds and starting value. */
export const REPUTATION_MIN = 0;
export const REPUTATION_MAX = 100;
export const REPUTATION_INITIAL = 50;

/** Reputation point deltas (deterministic). */
export const REPUTATION_POINTS = {
  reportSubmitted: 1,
  reportConfirmed: 2,
  reportDisputed: -2,
  reportMatchedOfficial: 3,
  reportRejected: -5,
  abusePenalty: -10,
} as const;

/** Report validation bounds. */
export const REPORT_MAX_AGE_HOURS = 24;
export const REPORT_MAX_FUTURE_MINUTES = 5;
export const REPORT_MIN_PRICE = '0.0001';
export const REPORT_MAX_PRICE = '9.9999';
export const REPORT_COMMENT_MAX_LENGTH = 500;

/** Duplicate report cooldown for same user/station/fuel/price. */
export const REPORT_DUPLICATE_COOLDOWN_MINUTES = 10;

/** Near-equivalent report grouping window. */
export const CORROBORATION_WINDOW_MINUTES = 30;

/** Location distance thresholds (meters). */
export const DISTANCE_NEAR_METERS = 500;
export const DISTANCE_PLAUSIBLE_METERS = 2000;

/** Price anomaly detection vs recent trusted observations. */
export const ANOMALY_DEVIATION_RATIO = 0.5;

/** Initial confidence threshold for auto-acceptance. */
export const AUTO_ACCEPT_CONFIDENCE_THRESHOLD = 0.5;

/** Vote contribution cap (effective confirmations/disputes). */
export const MAX_EFFECTIVE_VOTE_CONTRIBUTION = 5;

/** Throttle limits for crowdsourcing endpoints. */
export const REPORT_THROTTLE = {
  name: 'report',
  ttl: 60_000,
  limit: 10,
} as const;

export const VOTE_THROTTLE = {
  name: 'vote',
  ttl: 60_000,
  limit: 30,
} as const;

/** Official price reconciliation tolerance (exact equality for EUR-scale fuels). */
export const OFFICIAL_MATCH_TOLERANCE = '0.005';

/** Crowdsourced data source display name. */
export const CROWDSOURCED_DISPLAY_NAME = 'FuelMap community';
