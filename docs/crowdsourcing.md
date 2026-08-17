# Crowdsourcing

FuelMap crowdsourced prices are **evidence**, not automatically trusted official data.

## Report lifecycle

1. Authenticated user submits `POST /stations/:stationId/reports`.
2. Backend validates station, fuel, currency, price bounds, optional `reportedAt` (max 24h old).
3. Optional browser location is used once to compute `distance_from_station_meters` server-side via PostGIS. **Exact coordinates are not stored.**
4. Initial confidence is computed from reputation, distance, age, anomaly checks, and votes.
5. Reports with confidence ≥ 0.55 are auto-**accepted**; suspicious reports stay **pending**.
6. Accepted reports create a canonical `fuel_price_observations` row with `data_source = FUELMAP_CROWDSOURCED` and link via `user_price_reports.source_observation_id`.
7. Other users may **confirm** or **dispute** via `PUT /reports/:reportId/vote`.
8. Votes recompute confidence; pending reports may become accepted and then create observations.

## Status semantics

| Status | Meaning |
|--------|---------|
| `pending` | Valid but low confidence; no observation yet |
| `accepted` | Trusted enough to display; observation linked |
| `disputed` | More disputes than confirmations |
| `rejected` | Moderation/fraud rejection |
| `superseded` | Replaced by newer report |

## Location / privacy

- Frontend may send `{ lat, lon }` once per submission.
- Backend computes distance and stores **only** `distance_from_station_meters`.
- Thresholds: near ≤ 500 m, plausible ≤ 2 km, far > 2 km.
- Distance affects confidence; far reports are not auto-rejected.

## Reputation

- Initial score: **50** (range 0–100).
- Events: report submitted (+1), confirmed (+2 to reporter), disputed (−2), matched official (+3), rejected (−5).
- Users cannot vote on their own reports.
- Reputation is private (account page only).

## Anti-spam

- Auth required for submit/vote.
- Throttle: 10 reports/min, 30 votes/min per IP.
- Duplicate cooldown: same user + station + fuel + exact price within 10 minutes → 409.
- Near-equivalent reports (same station/fuel/currency/price within 30 min) corroborate without duplicate observations.

## GDPR account deletion

- `user_price_reports.user_id` → `ON DELETE SET NULL` (reports remain as anonymous evidence).
- User votes and reputation rows are deleted with the account.
- Observations and price history remain.

## Photo evidence (Milestone 11)

Optional photo-assisted reporting is available on station detail pages. OCR suggests fuel/price pairs; the user must confirm or edit values before submit. Linked photo evidence adds a **bounded +0.05** confidence boost but does not bypass anomaly or reputation checks. Images remain private (owner-only); public UI shows **Photo verified** when linked.

See [photo-reporting.md](./photo-reporting.md).

## Future

- Notifications (deferred)
