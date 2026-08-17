# Italy — MIMIT Fuel Prices Provider

Verification date: **2026-08-17**

## Publisher

Ministero delle Imprese e del Made in Italy (MIMIT) — open-data dataset **“Carburanti - Prezzi praticati e anagrafica degli impianti”**.

- Dataset page: https://www.mimit.gov.it/it/open-data/elenco-dataset/carburanti-prezzi-praticati-e-anagrafica-degli-impianti
- Metadata PDF (updated 2026-01-28, pipe delimiter from 2026-02-10): https://www.mimit.gov.it/images/stories/documenti/Metadati_prezzi_carburanti_20260128.pdf

## Licence & attribution

- **Licence:** Italian Open Data Licence (IODL) 2.0
- **Attribution:** credit MIMIT as publisher; link to source dataset when reusing

## Resources (stable URLs)

| Resource | URL | Size (2026-08-17) |
|----------|-----|-------------------|
| Station registry (`anagrafica_impianti_attivi.csv`) | https://www.mimit.gov.it/images/exportCSV/anagrafica_impianti_attivi.csv | ~3.6 MB |
| Daily prices (`prezzo_alle_8.csv`) | https://www.mimit.gov.it/images/exportCSV/prezzo_alle_8.csv | ~4.0 MB |

Both files publish daily. Prices reflect values **in force at 08:00 Europe/Rome on the day before the extraction date** (stated on dataset page).

## Format

- **Encoding:** UTF-8 (BOM tolerated)
- **Delimiter:** `|` (pipe) since **2026-02-10** — do not use comma/semicolon parsers
- **Line 1:** `Estrazione del YYYY-MM-DD` (skip)
- **Line 2:** column headers
- **Line 3+:** data rows
- **Decimals:** international format (`.` separator)

### Station schema

`idImpianto|Gestore|Bandiera|Tipo Impianto|Nome Impianto|Indirizzo|Comune|Provincia|Latitudine|Longitudine`

- **Station ID:** `idImpianto` → `external_station_id`
- **Coordinates:** `Latitudine`, `Longitudine` (WGS84, voluntary — validated against Italy bounds)

### Price schema

`idImpianto|descCarburante|prezzo|isSelf|dtComu`

- **Fuel:** `descCarburante` (many brand-specific premium labels exist)
- **Price:** `prezzo` (EUR/litre; metano priced per kg per metadata)
- **Service mode:** `isSelf` — `1` = self-service, `0` = served
- **Timestamp:** `dtComu` — communication datetime `GG/MM/AAAA hh:mm:ss` (Europe/Rome)

## Fuel mapping

Standard products mapped via `IT_MIMIT_FUEL_PRICES` aliases:

| MIMIT label | Canonical |
|-------------|-----------|
| Benzina | `petrol` (generic unleaded) |
| Gasolio | `diesel` |
| GPL | `lpg` |
| Metano | `cng` |
| GNL | `lng` |
| Premium/special 98 labels | `sp98` / `premium_diesel` where explicit |

Brand-specific premium labels (e.g. Shell V-Power) are **skipped** and listed in `ITALY_UNSUPPORTED_FUEL_LABELS`.

## Service mode architecture

Self/served prices are stored on `fuel_price_observations.service_mode` (`self` | `served` | `unknown`).

Selection policy (global default): prefer **self**, then **unknown**, then **served**.

## Provider code

`IT_MIMIT_FUEL_PRICES`

## Sync pattern

Single daily batch:

1. Fetch station registry + price file in parallel
2. Join on `idImpianto` during normalization
3. Dedup strategy: `timestamp-price` (uses `dtComu`)

## Scheduler

- **Cron default:** `0 8 * * *` UTC (`ITALY_INGEST_CRON`)
- Rationale: MIMIT files updated ~06:45–07:00 UTC; 08:00 UTC = 09:00 CET / 10:00 CEST

## CLI

```bash
pnpm ingest:italy
pnpm ingest:italy:dry-run
pnpm ingest -- --provider=italy [--fixture] [--dry-run]
```

Fixtures: `apps/api/test/fixtures/italy/stations-small.csv` + `prices-small.csv`

## Idempotency

Unique observation key: `(mapping, fuel_type, service_mode, observed_at, price, currency)`.

Repeated daily import with unchanged rows → **0 new observations**.
