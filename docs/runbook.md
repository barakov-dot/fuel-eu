# FuelMap Europe — Operations Runbook

Concise commands for day-to-day operations. Assumes repo root on the VPS and production Compose file.

## Status

```bash
docker compose -f docker-compose.prod.yml ps
curl -fsS "https://${APP_DOMAIN}/api/health" | jq .
curl -fsS "https://${APP_DOMAIN}/api/ready" | jq .
curl -fsS "https://${APP_DOMAIN}/api/coverage" | jq '.providers | length'
```

Local prod sim: replace host with `http://localhost:8080`.

## Logs

```bash
docker compose -f docker-compose.prod.yml logs -f api
docker compose -f docker-compose.prod.yml logs -f web
docker compose -f docker-compose.prod.yml logs -f reverse-proxy
docker compose -f docker-compose.prod.yml logs -f postgres
```

## Restart

```bash
docker compose -f docker-compose.prod.yml restart api
docker compose -f docker-compose.prod.yml restart web reverse-proxy
docker compose -f docker-compose.prod.yml restart
```

## Migrations

```bash
docker compose -f docker-compose.prod.yml run --rm migrate
```

## Reference seed

```bash
docker compose -f docker-compose.prod.yml run --rm seed
```

## Manual ingestion (compiled CLI)

```bash
docker compose -f docker-compose.prod.yml run --rm api \
  node dist/src/ingestion/run-ingest.js --provider=france

docker compose -f docker-compose.prod.yml run --rm api \
  node dist/src/ingestion/run-ingest.js --provider=spain --dry-run
```

## Maintenance cleanup

```bash
./scripts/run-maintenance.sh sessions
./scripts/run-maintenance.sh report-images
```

## Backup

```bash
./scripts/backup-postgres.sh
ls -lh backups/postgres/
```

## Restore (example)

```bash
docker compose -f docker-compose.prod.yml stop api
docker compose -f docker-compose.prod.yml exec -T postgres \
  dropdb -U fuelmap --if-exists fuelmap_restore_test
docker compose -f docker-compose.prod.yml exec -T postgres \
  createdb -U fuelmap fuelmap_restore_test
docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_restore -U fuelmap -d fuelmap_restore_test --clean --if-exists \
  < backups/postgres/fuelmap-YYYYMMDDTHHMMSSZ.dump
```

For full production restore, stop API, restore into primary DB/volume, run migrate, restart API.

## Disk usage

```bash
docker system df
du -sh backups/postgres data/uploads 2>/dev/null || true
docker volume ls | grep fuelmap
```

## Health checks

| Check | Command |
|-------|---------|
| API liveness | `GET /api/health` |
| API readiness (DB/PostGIS/Redis) | `GET /api/ready` |
| Web | `GET /` via proxy |
| Postgres | `docker compose exec postgres pg_isready -U fuelmap` |
| Redis | `docker compose exec redis redis-cli ping` |

## Auth smoke (via proxy)

```bash
curl -c /tmp/fm.cookies -fsS -X POST "http://localhost:8080/api/auth/register" \
  -H 'Content-Type: application/json' \
  -d '{"email":"ops-smoke@example.com","password":"smoke-test-pass-1","displayName":"Ops"}'
curl -b /tmp/fm.cookies -fsS "http://localhost:8080/api/auth/me"
```

## Ingestion scheduler status

Check API logs for `Ingestion scheduler enabled` or `disabled`. Verify cron env vars in `.env.production`.

## When things fail

1. `docker compose ps` — unhealthy service?
2. `docker compose logs migrate seed api` — migration/seed errors?
3. `curl /api/ready` — DB/Redis connectivity?
4. Caddy logs — TLS or upstream errors?
5. Restore from backup if data corruption suspected
