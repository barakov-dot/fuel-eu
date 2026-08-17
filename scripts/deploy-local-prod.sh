#!/usr/bin/env bash
set -euo pipefail

compose() {
  if docker compose version >/dev/null 2>&1; then
    docker compose "$@"
  else
    docker-compose "$@"
  fi
}

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

if [[ ! -f .env.production ]]; then
  echo "Missing .env.production — copy from .env.production.example first." >&2
  exit 1
fi

export FUELMAP_USE_LOCAL_PROD=1

echo "Building production images..."
compose -f docker-compose.prod.yml -f docker-compose.prod.local.yml build

echo "Starting production stack (local HTTP on http://localhost:8080)..."
compose -f docker-compose.prod.yml -f docker-compose.prod.local.yml up -d

echo "Waiting for API readiness..."
for _ in $(seq 1 90); do
  if curl -fsS http://localhost:8080/api/ready >/dev/null 2>&1; then
    echo "API is ready."
    exit 0
  fi
  sleep 2
done

echo "Timed out waiting for API readiness" >&2
exit 1
