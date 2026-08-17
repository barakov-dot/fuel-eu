/**
 * Deterministic tie-breaker for latest fuel price observations.
 *
 * When multiple observations share the same station and fuel type:
 * 1. observed_at DESC (most recent observation wins)
 * 2. received_at DESC (latest ingestion wins)
 * 3. id DESC (stable UUID tie-break)
 */
export const LATEST_PRICE_ORDER_BY =
  'o.observed_at DESC, o.received_at DESC, o.id DESC';
