# Local Docker infrastructure

This directory documents the Docker Compose services used for local development and future VPS deployment.

Services are defined in the repository root `docker-compose.yml`:

- `postgres` — PostgreSQL 16 with PostGIS 3.4, persistent volume `postgres_data`
- `redis` — Redis 7 (ephemeral; no volume in Milestone 1)

Node applications (`apps/web`, `apps/api`) run natively on macOS/Linux during development. Container definitions for web/api can be added in later milestones for VPS deployment.
