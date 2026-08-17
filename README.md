# FuelMap Europe

Local development foundation for the FuelMap Europe monorepo.

## Prerequisites (macOS)

- Node.js 20 or newer
- pnpm 9 (`corepack enable && corepack prepare pnpm@9.15.9 --activate`)
- Docker Desktop, Colima, or another Docker engine with Compose v2

If you use Colima, point Docker at the Colima socket before running Compose:

```bash
export DOCKER_HOST=unix://$HOME/.colima/default/docker.sock
```

If `docker compose` is unavailable, install the Compose plugin (e.g. `brew install docker-compose`) or use the root scripts, which fall back to `docker-compose`.

## Stack

- **Frontend:** Next.js (App Router, TypeScript) in `apps/web`
- **Backend:** NestJS (TypeScript) in `apps/api`
- **Database:** PostgreSQL 16 + PostGIS 3.4 via Docker Compose
- **Cache:** Redis 7 via Docker Compose
- **ORM:** Drizzle ORM with `drizzle-kit` migrations

### Why Drizzle?

Drizzle was chosen over Prisma and TypeORM for Milestone 1 because it has first-class PostgreSQL/PostGIS support (geometry columns, spatial indexes), lightweight SQL-first migrations, and strong TypeScript ergonomics without a heavy runtime. Prisma's PostGIS support currently relies on newer extension APIs; TypeORM's PostGIS support is usable but less ergonomic for typed spatial queries.

## First-time setup

```bash
cp .env.example .env
# Edit .env and set POSTGRES_PASSWORD to a local secret.

pnpm install
pnpm infra:up
pnpm db:migrate
```

## Development workflow

Start infrastructure (Postgres/PostGIS + Redis):

```bash
pnpm infra:up
```

Run both apps:

```bash
pnpm dev
```

Or run individually:

```bash
pnpm dev:api
pnpm dev:web
```

### Local URLs

| Service | URL |
|---------|-----|
| Web (EN) | http://localhost:3000/en |
| Web (RU) | http://localhost:3000/ru |
| Web status | http://localhost:3000/status |
| API health | http://localhost:3001/health |
| API readiness | http://localhost:3001/ready |

### Frontend environment

Add to `.env` (see `.env.example`):

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001
NEXT_PUBLIC_MAP_STYLE_URL=https://demotiles.maplibre.org/style.json
```

See [docs/frontend.md](docs/frontend.md) for architecture, map setup, and deferred items.

### Routing (optional, Milestone 7)

For manual route verification, configure OSRM in `.env` (see `.env.example`). Automated tests use a mock provider — no live OSRM in CI.

```env
ROUTING_PROVIDER=osrm
OSRM_BASE_URL=https://router.project-osrm.org
```

See [docs/routing.md](docs/routing.md) for architecture and API details.

### Geocoding (optional, Milestone 8)

For manual place search verification, configure Nominatim in `.env` (see `.env.example`). Automated tests use a mock provider — no live Nominatim in CI. Public Nominatim is development-only; self-host before launch.

```env
GEOCODING_PROVIDER=nominatim
NOMINATIM_BASE_URL=https://nominatim.openstreetmap.org
```

See [docs/geocoding.md](docs/geocoding.md) for API, caching, throttling, and self-hosting notes.

### Photo-assisted price reports (Milestone 11)

Local photo evidence uses filesystem storage and Tesseract.js OCR (no cloud APIs). Defaults in `.env.example`:

```env
IMAGE_STORAGE_PATH=./data/uploads
OCR_PROVIDER=tesseract
OCR_MAX_CONCURRENCY=1
```

Remove expired unattached images:

```bash
pnpm cleanup:report-images
pnpm cleanup:sessions
```

See [docs/cli.md](docs/cli.md) and [docs/photo-reporting.md](docs/photo-reporting.md).

## Ingestion (France, Spain, Germany, Austria)

Seed reference data and provider sources:

```bash
pnpm db:seed
```

Import official fuel prices:

```bash
pnpm ingest:france:dry-run
pnpm ingest:france
pnpm ingest:spain:dry-run
pnpm ingest:spain
pnpm ingest:germany:dry-run
pnpm ingest:austria:dry-run -- --fixture
```

See [docs/cli.md](docs/cli.md), [docs/ingestion.md](docs/ingestion.md), and provider docs under `docs/providers/`.

## Database migrations

```bash
pnpm db:migrate
pnpm db:status
```

Migrations live in `apps/api/drizzle/`. The initial migration enables PostGIS and creates a minimal `_fuelmap_meta` table to prove the migration pipeline.

## Quality commands

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Stop infrastructure

```bash
pnpm infra:down
```

To remove the Postgres data volume as well:

```bash
docker compose down -v
```

## Deployment note

For local development, Node apps run natively while Postgres and Redis run in Docker. The repository layout keeps `apps/web` and `apps/api` container-ready for later VPS deployment with minimal structural changes.

Production deployment uses `docker-compose.prod.yml` (or `docker-compose.prod.local.yml` for local prod smoke tests). Copy `.env.production.example` to `.env.production` on the server and fill in secrets there — never commit `.env.production`. See [docs/deployment.md](docs/deployment.md), [docs/runbook.md](docs/runbook.md), and [docs/release-checklist.md](docs/release-checklist.md).

## Redis persistence

Redis runs without a named volume in Milestone 1. That is intentional: no queues or durable cache data exist yet, and ephemeral Redis simplifies local resets. Add persistence when background jobs or durable cache entries are introduced.
