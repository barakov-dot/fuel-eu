# Croatia — Mzoe-gor Fuel Price Monitoring

Verification date: **2026-08-17**

## Publisher

Ministry of Economy (Ministarstvo gospodarstva), fuel price monitoring system **Mzoe-gor**.

- Portal: https://mzoe-gor.hr/
- Legal basis: Pravilnik o podacima koje su energetski subjekti dužni dostavljati Ministarstvu (NN 127/2019) — mandates publication of retail prices on www.mzoe-gor.hr
- Contact: podaci-nafta@mzoe.hr

## Official system

Energy entities must deliver retail fuel price data to the Ministry. Prices are published on the Mzoe-gor website and mobile apps for consumer price comparison.

**Important distinction:**

- **Government maximum prices** (Uredba o utvrđivanju najviših maloprodajnih cijena) set bi-weekly caps for basic fuels
- **Mzoe-gor data.json** contains **actual station-level prices** reported by operators — not just regulated maximums

## Machine-readable access

| Endpoint | Detail |
|----------|--------|
| `https://mzoe-gor.hr/data.json` | Full JSON snapshot (~909 stations) |
| Format | JSON, UTF-8, no authentication |
| Update frequency | Continuous (entities report changes) |
| Timestamps | Not exposed per price; fetch-time with price-change dedup |

## Coverage

- **Stations:** ~909 reporting stations nationwide
- **Coverage type:** `full_snapshot`
- **Currency:** EUR (Croatia eurozone since 2023)

## Coordinate note

API fields `lat` and `long` are **swapped**:

- `lat` field contains **longitude**
- `long` field contains **latitude**

Provider corrects this before storage (WGS84 SRID 4326).

## Reuse / licence

- Official government publication mandated by regulation (NN 127/2019)
- Public JSON endpoint powers official consumer portal
- No explicit open-data licence text found
- Third-party apps (e.g. MagicMirror modules) use the public endpoint for consumer price display

## Attribution

Credit **Ministarstvo gospodarstva / Mzoe-gor**.

## Fuel mapping

Road fuels mapped via `vrsta_goriva` names:

| vrsta_goriva | Canonical |
|--------------|-----------|
| Eurosuper 95 sa aditivima | sp95 |
| Eurosuper 95 bez aditiva | sp95 |
| Eurosuper 100 sa aditivima | sp98 |
| Eurosuper 100 bez aditiva | sp98 |
| Eurodizel sa aditivima | diesel |
| Eurodizel bez aditiva | diesel |
| UNP (autoplin) | lpg |

Excluded (non-road):

- Plinsko ulje LU EL (lož ulje) — heating oil
- Plinsko ulje obojano plavom bojom (plavi dizel) — marked heating oil
- Bioetanol

## Service mode

Not distinguished → `unknown`.

## Provider code

`HR_MZOE_FUEL_PRICES`

## Sync pattern

Batch snapshot every 4 hours (configurable via `CROATIA_INGEST_CRON`):

1. Fetch data.json
2. Build gorivo_id → vrsta_goriva lookup
3. Normalize stations with coordinate correction
4. Upsert

## CLI

```bash
pnpm ingest:croatia:dry-run
pnpm ingest:croatia
pnpm ingest -- --provider=croatia
```

## Decision gate

**IMPLEMENTED**

Reason: Official ministry-operated system with legitimate machine-readable JSON feed containing station-level actual prices. Mandated by regulation.

## Limitations

- Swapped lat/long fields in source API
- No per-price timestamps
- Multiple price entries per fuel grade (with/without additives) at same station
