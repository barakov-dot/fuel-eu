# Price selection policy

Current displayed prices are chosen by `PriceSelectionService`, not simply `ORDER BY observed_at DESC`.

## Candidates

For each station + fuel, all observations from the last **168 hours** are candidates, including official, commercial, and crowdsourced sources.

## Score formula

```
selectionScore =
  sourceTrust × 0.40 +
  freshness × 0.35 +
  confidence × 0.25
```

All components are normalized to 0.0–1.0.

### Source trust

`data_sources.trust_weight / 100` (official ≈ 80–90, crowdsourced = 30).

### Freshness

| Source type | Fresh | Aging | Stale |
|-------------|-------|-------|-------|
| official | ≤ 6 h | ≤ 24 h | > 24 h |
| commercial / fuel_chain | ≤ 12 h | ≤ 48 h | > 48 h |
| crowdsourced | ≤ 2 h | ≤ 8 h | > 8 h |

Weights: fresh = 1.0, aging = 0.6, stale = 0.2.

### Confidence

- Official/commercial: uses source trust weight.
- Crowdsourced: observation `confidence` plus confirmation bonus (up to +0.15), minus dispute penalty.
- Crowdsourced candidates below **0.5** effective confidence are excluded.

## Examples

**Scenario A:** Official €1.80 (10 min ago) vs community €1.70 (1 report, 5 min ago) → **official wins**.

**Scenario B:** Official €1.80 (3 days old) vs community €1.72 (3 confirmations, 10 min ago, confidence 0.82) → **community may win**.

**Scenario C:** Official €1.80 (recent) vs community €5.00 (low confidence) → **official wins**.

## Performance

Hot endpoints batch-fetch candidates in one SQL query plus vote aggregates, then select in memory per station/fuel. No per-station N+1.

## Service mode (M14)

`fuel_price_observations.service_mode` distinguishes dispensing mode where upstream data provides it:

- `self` — self-service
- `served` — attended/service
- `unknown` — default for FR/ES/DE/AT and legacy rows

Dedup index includes `service_mode` so self and served prices at the same timestamp remain distinct.

Italy MIMIT provides `isSelf` (1/0). Selection prefers **self → unknown → served** before scoring candidates. See [price-selection.md](price-selection.md).

## Limitations

- Scores are application heuristics, not calibrated probabilities.
- No FX conversion between currencies.
- Policy constants live in `price-selection.constants.ts`.
