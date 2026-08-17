# FuelMap Europe — Production Deployment

This guide covers VPS/staging deployment using Docker Compose, Caddy, and compiled production artifacts. It does **not** configure your server automatically — prepare the host, copy env files, and run the commands below on the VPS.

## Prerequisites

- Linux VPS (amd64 recommended; arm64 supported by pinned images where available)
- Docker Engine 24+ and Docker Compose v2
- DNS `A`/`AAAA` record pointing `APP_DOMAIN` to the VPS (for HTTPS)
- Firewall allowing **80/tcp** and **443/tcp** only publicly
- At least ~2 GB RAM for single-instance staging (more if enabling OCR + ingestion concurrently)

## Architecture

```
Internet → Caddy (80/443)
            ├─ /api/* → NestJS API (internal :3001, global prefix /api)
            └─ /*     → Next.js web (internal :3000, standalone)
Postgres/PostGIS + Redis: internal Docker network only
```

Same-origin browser calls use `NEXT_PUBLIC_API_BASE_URL=/api` (build-time). Auth uses Secure HttpOnly cookies with `SameSite=Lax`; CORS is disabled in production.

## Environment

1. Copy `.env.production.example` → `.env.production`
2. Set strong `POSTGRES_PASSWORD`
3. Set `APP_DOMAIN` and `ACME_EMAIL` for TLS
4. Optional: `TANKERKOENIG_API_KEY` for Germany ingestion
5. Leave `OSRM_BASE_URL` and `NOMINATIM_BASE_URL` empty until self-hosted/commercial endpoints exist

**Build-time web vars:** changing `NEXT_PUBLIC_*` requires rebuilding the `web` image.

## First deploy sequence

```bash
git pull
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
```

Startup order (enforced by Compose):

1. `postgres` healthy (`pg_isready`)
2. `migrate` once → `node dist/src/database/run-migrate.js`
3. `seed` once → reference/provider registry seed (idempotent, **not** dev fixtures)
4. `api`, `web`, `reverse-proxy`

Verify:

```bash
curl -fsS "https://${APP_DOMAIN}/api/health"
curl -fsS "https://${APP_DOMAIN}/api/ready"
```

## Local production simulation (HTTP)

```bash
cp .env.production.example .env.production
# edit POSTGRES_PASSWORD
chmod +x scripts/deploy-local-prod.sh scripts/backup-postgres.sh scripts/run-maintenance.sh
./scripts/deploy-local-prod.sh
open http://localhost:8080
```

Uses `docker-compose.prod.local.yml` (Caddy on `:8080`, scheduler disabled by default).

## HTTPS

Production `deploy/Caddyfile` uses Caddy automatic HTTPS for `{$APP_DOMAIN}`. Do not run ACME against localhost.

Security headers (HSTS on HTTPS, `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`) are set at Caddy. Upload body limit: **15 MB** (API validates 10 MB).

## Migrations on upgrade

```bash
docker compose -f docker-compose.prod.yml run --rm migrate
docker compose -f docker-compose.prod.yml up -d api web
```

Review migration SQL in `apps/api/drizzle/` before deploying.

## Reference seed

Safe to re-run (updates provider registry rows):

```bash
docker compose -f docker-compose.prod.yml run --rm seed
```

Never run `db:seed:dev` in production.

## Ingestion scheduler

Runs inside the **single API container** when `INGESTION_SCHEDULER_ENABLED=true`.

| Provider | Schedule (UTC) | Notes |
|----------|----------------|-------|
| France | `*/15 * * * *` | Full snapshot |
| Spain | `*/15 * * * *` | Full snapshot |
| Italy | `0 8 * * *` | Daily publication window |
| Slovenia | `0 */2 * * *` | Full snapshot |
| Croatia | `0 */4 * * *` | Full snapshot |
| Germany stations | `0 2 * * 0` | Requires API key |
| Germany prices | `0 3 * * *` | Requires API key |
| Austria | — | On-demand only |

Advisory locks prevent overlapping runs. Provider failures are logged and do not crash the API.

## Maintenance (compiled CLIs)

Schedule on the host (recommended):

```cron
0 3 * * * /opt/fuelmap/scripts/run-maintenance.sh sessions
15 3 * * * /opt/fuelmap/scripts/run-maintenance.sh report-images
```

Or run manually:

```bash
./scripts/run-maintenance.sh sessions
./scripts/run-maintenance.sh report-images
```

Uses narrow compiled entry points — no full HTTP server, no ts-node.

## Backups

```bash
export FUELMAP_USE_LOCAL_PROD=1   # when using local prod compose
./scripts/backup-postgres.sh
```

Backups land in `./backups/postgres/fuelmap-<timestamp>.dump` (custom `pg_dump -Fc` format). Retention defaults to 14 days.

### Restore (disposable/test or disaster recovery)

1. Stop writers: `docker compose -f docker-compose.prod.yml stop api`
2. Drop/recreate DB or restore to a fresh volume
3. `pg_restore` from backup (see runbook)
4. Run migrate if needed, then start API

Test restore locally against the prod-local stack before relying on backups in production.

## Persistence

| Data | Storage |
|------|---------|
| PostgreSQL | `postgres_data` volume |
| Report images | `api_uploads` → `/app/data/uploads` |
| Tesseract traineddata cache | `tesseract_cache` → `/app/data/tesseract-cache` |
| Redis | Ephemeral (cache/scheduler aux state) |

## Production caveats

- **Germany:** ingestion skipped without `TANKERKOENIG_API_KEY`
- **Cyprus / LT / RO / GR / PT:** blocked — no cron
- **OSRM / Nominatim public endpoints:** not suitable for production traffic; configure self-hosted or commercial providers first
- **OCR:** lazy-init; health checks do not warm Tesseract

## Upgrades & rollback

1. Backup DB
2. Pull/build new images
3. Run migrate job
4. Restart `api` + `web`
5. Smoke test auth, map, `/api/coverage`

Rollback: redeploy previous image tags; restore DB backup if schema/data migration is irreversible.

## Resource notes

- OCR concurrency: 1 (`OCR_MAX_CONCURRENCY`)
- Redis maxmemory: 256 MB LRU (Compose default)
- No tight CPU/memory limits set — tune after measuring on your VPS
