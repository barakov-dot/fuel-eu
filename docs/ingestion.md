# Fuel ingestion

FuelMap Europe ingests external fuel price feeds through a small provider-based subsystem in `apps/api/src/modules/ingestion/`.

## Architecture

```
CLI / scheduler
        │
        ▼
 IngestionService ── advisory lock per provider
        │
        ├── FuelPriceProvider.fetch()     ← HTTP / fixture
        ├── FuelPriceProvider.normalize() ← Zod + domain mapping
        └── IngestionWriterService        ← batched DB writes
                │
                ├── ingestion_runs
                └── ingestion_errors
```

### Multi-provider design

Each country/provider implements `FuelPriceProvider` in its own package:

- `providers/france/` — Opendatasoft JSON (paginated)
- `providers/spain/` — MITECO REST JSON (single snapshot)
- `providers/italy/` — MIMIT CSV (station registry + daily prices, pipe-delimited)

`IngestionService.runProvider(code)` resolves country and currency from the seeded `data_sources` row — no hardcoded country logic in the orchestrator.

Provider-specific behaviour (parsing, fuel aliases, dedup strategy) stays inside the provider package.

### Provider interface

- `fetch()` — download and parse transport format
- `normalize()` — map upstream records to canonical station + price observations
- `observationDedupStrategy` (optional):
  - `timestamp-price` (France default) — dedup on `(mapping, fuel, observed_at, price, currency)`
  - `price-change-only` (Spain, Germany) — skip insert when latest price unchanged, even if feed timestamp moved

Germany additionally supports `IngestionOptions.syncMode`:

- `full` — nationwide station discovery via bounded `list.php` grid queries
- `prices` — price refresh via chunked `prices.php` for known mapped station UUIDs (IDs loaded by `IngestionService` from `station_source_mappings`)

## Validation boundary

- **Transport parsing**: Zod schemas validate untrusted upstream JSON field types/ranges.
- **Domain normalization**: fuel aliases, coordinate checks, timestamp parsing, price formatting.
- Malformed rows are skipped and recorded in `ingestion_errors`; the run continues when safe.

## Run and error recording

Every non-dry import creates an `ingestion_runs` row with counters and final status:

- `running` → `succeeded` | `partially_succeeded` | `failed`

Row-level issues are stored in `ingestion_errors` (bounded message length, optional small `raw_payload`).

## Idempotency rule

Price observations are deduplicated with a unique index on:

`(station_source_mapping_id, fuel_type_id, service_mode, observed_at, price, currency_id)`

**France**: per-fuel upstream timestamps; repeated identical imports create zero new rows.

**Spain / Germany**: no reliable per-price upstream timestamp on the free feed/API. FuelMap uses `price-change-only` — repeated imports with unchanged prices create zero new rows. Germany sets `observed_at` to the fetch time (`fetchedAt`), not an upstream change time.

Station mappings are keyed by `(data_source_id, external_station_id)`.

## Concurrency lock

Overlapping runs for the same provider are prevented with PostgreSQL advisory locks (`pg_try_advisory_lock`), keyed from the provider code. France and Spain locks are independent.

## Raw payload policy

Successful price observations do **not** store the full upstream record. `ingestion_errors.raw_payload` may contain a bounded malformed record snippet for debugging.

## Transaction / batching strategy

Imports use **per-batch transactions** (50 stations) with batched:

- mapping lookups (`IN` query)
- station inserts (multi-row)
- price observation inserts (multi-row `ON CONFLICT DO NOTHING`)
- latest-price lookups for Spain dedup (`DISTINCT ON`)

## Manual CLI

```bash
pnpm ingest:france                         # live France import
pnpm ingest:france:dry-run
pnpm ingest:spain                          # live Spain import
pnpm ingest:spain:dry-run
pnpm ingest:germany
pnpm ingest:germany:dry-run
pnpm ingest:italy
pnpm ingest:italy:dry-run
pnpm ingest -- --provider=spain            # generic entry point
pnpm ingest -- --provider=italy
pnpm ingest -- --provider=germany --sync-mode=prices
pnpm ingest:france -- --fixture=path.json
pnpm ingest:spain -- --fixture
```

The CLI bootstraps a Nest application context (no HTTP server), runs ingestion, prints JSON stats, and closes DB/Redis connections.

## Scheduler

NestJS `@nestjs/schedule` with dynamically registered UTC cron jobs.

| Variable | Default | Description |
|----------|---------|-------------|
| `INGESTION_SCHEDULER_ENABLED` | `false` | Master switch |
| `INGESTION_RUN_ON_STARTUP` | `false` | Run all providers once on API boot |
| `FRANCE_INGEST_CRON` | `*/10 * * * *` | France schedule (UTC) |
| `SPAIN_INGEST_CRON` | `*/10 * * * *` | Spain schedule (UTC) |
| `GERMANY_STATIONS_INGEST_CRON` | `0 2 * * 0` | Germany full grid discovery (UTC, weekly) |
| `GERMANY_PRICES_INGEST_CRON` | `0 3 * * *` | Germany price refresh for known IDs (UTC, daily) |
| `ITALY_INGEST_CRON` | `0 8 * * *` | Italy MIMIT daily import (UTC, after publication) |
| `TANKERKOENIG_API_KEY` | _(empty)_ | Required for live Germany imports; scheduler skips Germany when missing |

When enabled, the scheduler calls the same `IngestionService` methods as the CLI. Germany jobs register only when `TANKERKOENIG_API_KEY` is set. Provider failures are logged and do not crash the NestJS process.

## Coverage API

`GET /coverage` returns per-country coverage metadata from `provider-capabilities.ts` (static legal/technical registry) merged with active seeded providers and runtime config.

Coverage types: `full_snapshot`, `partial_network_coverage`, `on_demand_limited`, `implemented_requires_credentials`, `blocked`, `crowdsourcing_only`.

Limitation codes (examples): `no-official-machine-readable-endpoint`, `pending-official-permission`, `requires-data-sharing-agreement`, `partial-participating-networks-only`, `community-data-only`.

M15 blocked countries: **LT**, **RO**, **GR**, **PT** — see provider docs below.

## Status API

`GET /ingestion/status` returns latest run summary for active configured sources (France, Spain, Germany) plus `schedulerEnabled`. No cron secrets or raw payloads exposed.

See also: [France provider](providers/france.md), [Spain provider](providers/spain.md), [Germany provider](providers/germany.md), [Italy provider](providers/italy.md), [Austria provider](providers/austria.md), [Lithuania research](providers/lithuania.md), [Romania research](providers/romania.md), [Greece research](providers/greece.md), [Portugal research](providers/portugal.md).
