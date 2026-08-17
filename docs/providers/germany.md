# Germany fuel provider (Tankerkönig / MTS-K)

Verification date: **2026-08-17**

## Roles

| Actor | Role |
| --- | --- |
| **MTS-K** (Markttransparenzstelle für Kraftstoffe, Bundeskartellamt) | Government transparency unit. All ~14,000+ German stations report Super E5, Super E10 and Diesel prices. Direct data access is restricted to licensed **Verbraucher-Informationsdienste (VID)** via the Mobilithek platform after Bundeskartellamt approval. |
| **Tankerkönig** | Third-party intermediary operating a consumer-facing website/app and a **free JSON API** (`creativecommons.tankerkoenig.de`) that republishes MTS-K-derived live data under **CC BY 4.0**. Tankerkönig is **not** the government authority. |
| **FuelMap** | Consumer fuel-price map. Uses Tankerkönig as the initial Germany access path, stores normalized observations with provenance, and displays prices to end users (consumer information purpose). |

## Why Tankerkönig (not direct MTS-K)

Direct MTS-K access requires VID registration with the Bundeskartellamt, operational compliance with MTSKraftV, and use of the Mobilithek technical platform. That path is appropriate for a production VID operator but is a separate legal/operational process.

Tankerkönig’s documented free API is intended for apps and websites providing **consumer fuel price information**, which aligns with FuelMap’s purpose, subject to their AGB and CC BY 4.0 terms.

## Legal / licence summary

- **API licence:** CC BY 4.0 (attribution required — link to https://www.tankerkoenig.de or https://creativecommons.tankerkoenig.de).
- **Tankerkönig AGB:** Prohibits **redistribution of raw datasets** obtained via the API to third parties; prohibits supply to mineral-oil companies/stations/IT vendors serving that industry. Does **not** prohibit displaying current prices to consumers in an app/map.
- **MTS-K (Feb 2025 guidance):** MTS-K data must be used exclusively for **consumer information** via a nationwide, non-restricted service. FuelMap’s use case matches this leitbild when operated as a public consumer map.
- **Commercial reuse:** CC BY 4.0 allows commercial use with attribution. Tankerkönig offers a separate **commercial/dedicated** tier for mass mirroring, higher rate limits, and bulk hosting — required for aggressive nationwide polling at scale.

**Conclusion:** Consumer display via FuelMap using the free Tankerkönig API is permitted in principle, with attribution. Nationwide bulk polling must respect Tankerkönig rate limits; production-scale mirroring may require their commercial service.

## API (current, verified 2026-08-17)

There is **no Swagger/OpenAPI** published. The authoritative interface is the HTML documentation at https://creativecommons.tankerkoenig.de/

| Item | Value |
| --- | --- |
| Base URL | `https://creativecommons.tankerkoenig.de/json/` |
| Auth | Personal API key (UUID) on every request |
| Rate limit | **1 request/minute** (free tier); mass polling blocked |
| Licence in response | `CC BY 4.0 - https://creativecommons.tankerkoenig.de` |
| Data tag | `"data": "MTS-K"` |

### Endpoints used by FuelMap

1. **`list.php`** — radius search (max **25 km**), returns station metadata + current E5/E10/Diesel prices. Used for **weekly nationwide station discovery** via a fixed WGS84 grid with deduplication by station UUID.
2. **`prices.php`** — up to **10 station UUIDs** per request. Used for **daily price refresh** of known mapped stations.

`detail.php` (opening hours) is not imported in Milestone 12.

## Nationwide enumeration strategy

No bulk station dump exists on the free API. FuelMap uses:

1. **Full sync (`syncMode=full`):** deterministic grid of `list.php` queries (25 km radius, `type=all`), merge by station UUID. ~500 grid points at 1 req/min ≈ 8+ hours for full discovery.
2. **Price sync (`syncMode=prices`):** chunked `prices.php` for external IDs already mapped in `station_source_mappings`. ~14k stations / 10 IDs / 1 req/min ≈ 23 hours for a full refresh.

This follows documented endpoints and rate limits. It is **not** scraping. Tankerkönig explicitly warns that mass mirroring via the free API will get keys blocked — production may need their commercial tier.

## Station identity

- **External ID:** Tankerkönig/MTS-K station UUID (`id` field).
- Mapping key: `(data_source_id, external_station_id)`.

## Fuels

| Upstream | Canonical |
| --- | --- |
| `e5` | `e5` |
| `e10` | `e10` |
| `diesel` | `diesel` |

Unavailable values (`false`, missing, zero) produce **no observation**.

## Price & timestamp semantics

- Upstream JSON returns prices as floating-point numbers (e.g. `1.789`).
- FuelMap stores exact `numeric(12,4)` strings (e.g. `"1.7890"`).
- The free API does **not** expose per-fuel change timestamps.
- **`observed_at`** = time FuelMap fetched/verified the current price (`fetchedAt` metadata).
- This is **not** a provider-reported “price changed at” time.
- **Idempotency:** `price-change-only` — repeated import with unchanged price creates **zero** new observations (same strategy as Spain).

## Closed / unavailable

- `isOpen: false` or `status: closed` → metadata only; historical prices retained.
- `false` price fields → skipped (never stored as €0.000).

## FuelMap configuration

```env
TANKERKOENIG_API_KEY=
TANKERKOENIG_BASE_URL=https://creativecommons.tankerkoenig.de/json
GERMANY_STATIONS_INGEST_CRON=0 2 * * 0
GERMANY_PRICES_INGEST_CRON=0 3 * * *
GERMANY_GRID_MAX_POINTS=   # optional dev cap for live dry-run
```

Register a free key: https://creativecommons.tankerkoenig.de (API-Key tab).

## CLI

```bash
pnpm ingest:germany
pnpm ingest:germany:dry-run
pnpm ingest -- --provider=germany
pnpm ingest -- --provider=germany --sync-mode=prices
pnpm ingest:germany -- --fixture
```

## Data source seed

| Field | Value |
| --- | --- |
| code | `DE_TANKERKOENIG_MTSK` |
| name | Tankerkönig / MTS-K Germany |
| type | `third_party` |
| trustWeight | 85 |
| upstreamAuthority | Bundeskartellamt MTS-K (metadata) |

## Attribution

CC BY 4.0 requires attribution. FuelMap shows the data source name on station cards/details (`Tankerkönig / MTS-K Germany`) and documents provenance here.

## Known limitations

- Free API rate limit makes full nationwide price refresh slow.
- Mass polling may trigger key suspension — use commercial Tankerkönig tier for production-scale mirroring.
- No opening-hours import in M12.
- Direct MTS-K VID registration remains a future option for official-source typing.
