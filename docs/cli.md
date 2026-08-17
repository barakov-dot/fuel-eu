# CLI operations

Verification date: **2026-08-17**

FuelMap CLIs run TypeScript **from source** via **`ts-node` in transpile-only mode** (see `apps/api/tsconfig.json`). This preserves NestJS `emitDecoratorMetadata` for dependency injection while skipping the strict type-check pass that previously blocked CLI startup.

`tsx` was evaluated (Context7) but rejected for Nest CLI modules because esbuild transpilation does not emit decorator metadata, which left `ConfigService` and other constructor injections unresolved at runtime.

## Runtime

| Item | Choice |
|------|--------|
| Runner | `ts-node` (`transpileOnly: true` in `apps/api/tsconfig.json`) |
| Entry | `apps/api/src/**` TypeScript files |
| Env loading | Root `.env` then `apps/api/.env` via `loadCliEnv()` / Nest `ConfigModule` |
| Working directory | Repo root (`pnpm …`) or `apps/api` (`pnpm exec tsx …`) |

## Module boundaries

| Module | Purpose |
|--------|---------|
| `ApplicationCoreModule` | Config, PostgreSQL, Redis |
| `IngestionCoreModule` | Ingestion providers/services without HTTP, OCR, auth controllers, or scheduler |
| `IngestionCliModule` | `ApplicationCoreModule` + `IngestionCoreModule` |
| `AuthMaintenanceCliModule` | Session cleanup only |
| `ReportImagesMaintenanceCliModule` | Report image cleanup without Multer/upload controller |

The full HTTP app still uses `AppModule`. Ingestion/maintenance CLIs intentionally avoid loading Multer, Tesseract workers, and unrelated controllers.

## Shutdown

All CLIs call `shutdownApplicationContext()` which:

1. Closes PostgreSQL (`PostgresConnection.onModuleDestroy`)
2. Closes Redis (`RedisConnection.onModuleDestroy`) when loaded
3. Terminates Tesseract worker if loaded
4. Calls `app.close()`

Exit codes:

- `0` — success
- `1` — fatal error / failed ingestion status
- `2` — advisory lock held (`AdvisoryLockError`)

## Ingestion commands

From repo root (requires `DATABASE_URL`, infra up, `pnpm db:seed`):

```bash
pnpm ingest:france:dry-run
pnpm ingest:france

pnpm ingest:spain:dry-run
pnpm ingest:spain

pnpm ingest:germany:dry-run   # uses fixture with --fixture; live needs TANKERKOENIG_API_KEY
pnpm ingest:germany

pnpm ingest:austria:dry-run   # fixture mode: add --fixture or use smoke script
pnpm ingest:austria -- --lat=48.2082 --lon=16.3738   # on-demand location query

pnpm ingest -- --provider=france [--dry-run] [--fixture]
```

Fixture/offline examples (from `apps/api`):

```bash
pnpm exec tsx src/ingestion/run-france.ts --dry-run --fixture
pnpm exec tsx src/ingestion/run-austria.ts --dry-run --fixture
```

## Maintenance commands

```bash
pnpm cleanup:sessions
pnpm cleanup:report-images
```

## macOS usage

1. `cp .env.example .env` and configure `DATABASE_URL` / `REDIS_URL`
2. `pnpm infra:up`
3. `pnpm db:migrate && pnpm db:seed`
4. Run any CLI above from repo root

## Linux VPS (future)

Same commands apply once `.env` and Docker infra are configured on the VPS. CLIs do not require the HTTP server to be running. Use systemd/cron to invoke root `pnpm` scripts. For production you may later switch to compiled `node dist/...` entry points without changing CLI module boundaries.

## Smoke verification

```bash
pnpm --filter @fuelmap/api cli:smoke
```

Runs fixture dry-run boot/exit checks for France, Spain, Germany, and Austria without live external APIs.

## Root cause fixed (M12 debt)

- **ts-node (strict)**: full-graph type-check failed on Express `Request.user` before CLI logic ran.
- **tsx**: breaks Nest DI without decorator metadata (`ConfigService` undefined in `PostgresConnection`).
- **Fix**: `ts-node` + `transpileOnly` + narrow CLI modules that exclude HTTP/OCR/upload paths unless required.
