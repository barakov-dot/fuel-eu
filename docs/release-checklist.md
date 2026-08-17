# FuelMap Europe — Release Checklist

Use before tagging or deploying to staging/production.

## Code quality

- [ ] `pnpm lint`
- [ ] `pnpm typecheck`
- [ ] `pnpm test`
- [ ] `pnpm --filter @fuelmap/api test:integration`
- [ ] `pnpm --filter @fuelmap/api test:e2e`
- [ ] `pnpm build`

## Compiled runtime

- [ ] `node apps/api/dist/src/main.js` boots (with local `.env` + infra)
- [ ] No `MODULE_NOT_FOUND` (multer, sharp, etc.)
- [ ] Compiled CLIs run: migrate, seed, ingest, cleanup

## Docker / Compose

- [ ] `docker compose -f docker-compose.prod.yml build`
- [ ] Local prod sim: `./scripts/deploy-local-prod.sh`
- [ ] `GET /` and locale redirect via proxy
- [ ] `GET /api/health`, `/api/ready`, `/api/coverage`
- [ ] Auth register/login/me/logout via proxy (Secure cookie in HTTPS deploy)
- [ ] Photo upload via proxy + persistence after API restart
- [ ] DB persistence after stack restart
- [ ] Backup + restore tested in disposable environment

## Database

- [ ] Review new migrations in `apps/api/drizzle/`
- [ ] Backup taken before deploy (`./scripts/backup-postgres.sh`)
- [ ] Migrate job succeeds
- [ ] Reference seed idempotent (no dev fixtures)

## Environment

- [ ] `.env.production` complete (no secrets committed)
- [ ] `POSTGRES_PASSWORD` strong
- [ ] `APP_DOMAIN` + `ACME_EMAIL` set for TLS deploy
- [ ] `NEXT_PUBLIC_API_BASE_URL=/api` baked into web image
- [ ] `OSRM_BASE_URL` / `NOMINATIM_BASE_URL` empty or production-suitable
- [ ] `TANKERKOENIG_API_KEY` set if Germany ingestion required
- [ ] `INGESTION_SCHEDULER_ENABLED` only on intended API instance

## Post-deploy smoke

- [ ] Map page loads (MapLibre tiles/style)
- [ ] Nearby stations query
- [ ] EN + RU locale routes
- [ ] Coverage registry reflects expected providers
- [ ] Security headers present (via Caddy)
- [ ] Upload >10 MB rejected by API; ≤10 MB accepted; proxy allows ≤15 MB

## Rollback decision

- [ ] If migrate fails: **do not** route traffic to new API; fix forward or restore backup
- [ ] If smoke fails: rollback image tags; restore DB if schema changed

## Known non-production items (document, do not block staging)

- Public OSRM/Nominatim endpoints
- Cyprus, Lithuania, Romania, Greece, Portugal providers
- Self-hosted Europe routing/geocoding
