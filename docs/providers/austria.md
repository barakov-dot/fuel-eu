# Austria official fuel price provider (E-Control Spritpreisrechner)

Verification date: **2026-08-17**

## Statutory system

| Field | Value |
|-------|-------|
| Legal basis | Preistransparenzgesetz; Preistransparenzverordnung Treibstoffpreise 2011 |
| Operator | Energie-Control Austria (E-Control) |
| Database | Preistransparenzdatenbank |
| Public UI | [spritpreisrechner.at](https://www.spritpreisrechner.at) |
| FAQ | [e-control.at/spritpreisrechner](https://www.e-control.at/spritpreisrechner) |

Commercial stations must report price changes within statutory deadlines (e.g. decreases within 30 minutes; increases within 10 minutes after the allowed midday window).

## E-Control role

E-Control operates the statutory transparency database, publishes the Spritpreisrechner website, and exposes a JSON HTTP API used by third-party information services (e.g. motoring clubs). FuelMap uses this official API — not scraped frontend pages.

## Mandatory / public fuels

Statutory focus (per E-Control FAQ):

| Official product | API code | FuelMap canonical |
|------------------|----------|-------------------|
| Diesel | `DIE` | `diesel` |
| Super-95 | `SUP` | `sp95` |

Premium grades and E10 are **not** statutory mandatory products. FuelMap does **not** map generic `SUP` to `e10`.

Optional voluntary products (e.g. CNG `GAS`) exist but are not ingested in Milestone 13.

## Reporting & freshness

- Station operators report via E-Control channels (web portal, POS integrations, etc.).
- Published prices must not be older than ~30 minutes (statutory requirement).
- The public UI intentionally **does not show price timestamps** because stale prices are not permitted.

FuelMap uses **fetch/received time** as `observedAt` and documents that this is not the exact pump-change instant.

## Public display restrictions (critical)

E-Control FAQ (verified 2026-08-17):

- Address / district search shows the **five cheapest** stations for the selected fuel.
- The API returns the **ten nearest** stations; only the cheapest subset includes prices (others may have empty `prices[]`).
- This is a **legislative design** to encourage downward price competition, not a complete nationwide price mirror.
- Route-wide cheapest-station search is explicitly **not supported** by the official system.

FuelMap **must not** imply complete area coverage. Nearby API responses include:

```json
"meta": { "austriaDataScope": "official-cheapest-subset-only-not-all-area-stations" }
```

when the query point is in Austria.

## API access

| Item | Status |
|------|--------|
| Base URL | `https://api.e-control.at/sprit/1.0` |
| Auth | None required for public search endpoints (verified live 2026-08-17) |
| Example | `GET /search/gas-stations/by-address?latitude=48.2082&longitude=16.3738&fuelType=DIE&includeClosed=false` |
| Official Swagger | Linked from E-Control historically; `api-docs` endpoint returned 404 on 2026-08-17 — treat live endpoint behaviour + FAQ as primary |
| Registration | Not required for read-only public search used here |

## Licence / reuse / commercial use

- FuelMap reads the same public JSON API intended for consumer information services.
- No bulk open-data dump is published; reuse is limited to **location queries** returning the statutory cheapest subset.
- Commercial app use should remain aligned with E-Control’s consumer-information purpose; contact `office@e-control.at` for formal redistribution questions.
- Attribute data to **E-Control Spritpreisrechner / Preistransparenzdatenbank**.

## FuelMap integration strategy

| Aspect | Decision |
|--------|----------|
| Provider code | `AT_ECONTROL_SPRITPREIS` |
| Type | `official` |
| Architecture | **On-demand location provider** (not nationwide batch cron) |
| Trigger | `/stations/nearby` when lat/lon falls in Austria bbox |
| Cache | Redis key rounded to 0.01°; default TTL 900s (`AUSTRIA_CACHE_TTL_SECONDS`) |
| Scheduler | **Not registered** (no nationwide Austria cron) |
| CLI | `pnpm ingest:austria -- --lat=… --lon=…` or `--fixture` dry-run |

## Station identity

Use stable E-Control numeric `id` as `external_station_id` (stringified).

## Coordinates

API `location.latitude` / `location.longitude` (WGS84) → PostGIS SRID 4326 via existing geometry helper.

## Idempotency

Provider strategy: `price-change-only`. Repeated identical prices create **0** new observations.

## CLI verification

```bash
pnpm ingest:austria:dry-run -- --fixture
pnpm ingest:austria -- --lat=48.2082 --lon=16.3738   # live Vienna query
```

## Limitations

- Not a complete Austrian station/price mirror.
- Routing cannot claim comprehensive cheapest-station coverage along a corridor (official system excludes route search by design).
- No official pump-change timestamps exposed.
- Swagger/docs endpoint may be offline; monitor API stability.

## Decision gate (M13)

**IMPLEMENTED** as on-demand official location provider with documented statutory cheapest-subset limitation. Not blocked: public API works without credentials; reuse aligns with official consumer price transparency purpose when scope is disclosed.
