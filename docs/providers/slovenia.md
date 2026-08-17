# Slovenia — goriva.si Fuel Prices Provider

Verification date: **2026-08-17**

## Publisher

Ministry of Infrastructure and Energy (Ministrstvo za infrastrukturo in energetiko), formerly Ministry of Economic Development and Technology, operates **goriva.si** for consumer price transparency.

- GOV.SI topic page: https://www.gov.si/teme/cene-naftnih-derivatov/
- Consumer portal: https://goriva.si/
- Legal basis: Odredba o podatkih, ki so jih distributerji naftnih derivatov dolžni zagotavljati ministrstvu (PISRS)

## Reporting obligation

Fuel distributors must report every retail price change at each filling station in Slovenia to the ministry **before** the price takes effect, via:

- API interface (for distributors), or
- Web form at goriva.si

## Coverage

- **Stations:** All reporting filling stations nationwide (~550 as of 2026-08-17)
- **Fuels reported:** NMB-95, NMB-98+, diesel, extra light heating oil (KOEL), autogas LPG
- **Regulated vs actual:** gov.si publishes national regulated maximum prices separately; goriva.si shows **actual station-level prices** reported by distributors
- **Motorway stations:** Included when distributors report them
- **Coverage type:** `full_snapshot` via paginated nationwide search

## Machine-readable access

| Endpoint | Purpose |
|----------|---------|
| `GET /api/v1/search/?position={lat},{lon}&radius={m}` | Paginated station search (25/page) |
| `GET /api/v1/franchise/` | Distributor/brand lookup |

Nationwide fetch: centre `46.15,14.99`, radius `200000` m, follow `next` pagination links.

**Format:** JSON, UTF-8, no authentication required.

**Timestamps:** Not exposed per fuel or station; ingestion uses fetch time with `price-change-only` deduplication.

## Reuse / licence

- gov.si states prices are "javno dostopne" (publicly available) on goriva.si for consumer information
- Portal purpose: transparent consumer price comparison to support competition
- **No explicit open-data licence or third-party API documentation found**
- API is undocumented but powers the public website without authentication
- FuelMap limitation: `undocumented-public-api`

Commercial republication for consumer benefit aligns with stated portal purpose, but formal permission has not been obtained.

## Attribution

Credit **goriva.si / Ministrstvo za infrastrukturo in energetiko**.

## Fuel mapping

| goriva.si key | Canonical | Notes |
|---------------|-----------|-------|
| 95 | sp95 | NMB-95 unleaded — ethanol blend not inferred |
| dizel | diesel | Standard diesel |
| 98 | sp98 | NMB-98+ |
| 100 | sp98 | NMB-100 high-octane — mapped to sp98 (no sp100 canonical) |
| dizel-premium | premium_diesel | |
| avtoplin-lpg | lpg | |
| hvo | hvo | |
| cng | cng | |
| lng | lng | |
| KOEL | *(excluded)* | Extra light heating oil — non-road |

## Service mode

Not distinguished in API response → `unknown`.

## Provider code

`SI_GORIVA_FUEL_PRICES`

## Sync pattern

Batch snapshot every 2 hours (configurable via `SLOVENIA_INGEST_CRON`):

1. Fetch franchise list
2. Paginate nationwide search
3. Normalize and upsert stations/prices

## CLI

```bash
pnpm ingest:slovenia:dry-run
pnpm ingest:slovenia
pnpm ingest -- --provider=slovenia
```

## Decision gate

**IMPLEMENTED**

Reason: Official government portal with public JSON API returning station-level actual prices for all reporting stations. No explicit reuse prohibition found; API terms undocumented.

## Limitations

- Undocumented public API (not listed on gov.si as open-data endpoint)
- No per-price timestamps
- Some stations may show null prices when temporarily closed
- NMB-95 ethanol blend (E5/E10) not distinguished
