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
COMPOSE_FILES=(-f "${ROOT_DIR}/docker-compose.prod.yml")

if [[ -f "${ROOT_DIR}/docker-compose.prod.local.yml" ]] && [[ "${FUELMAP_USE_LOCAL_PROD:-}" == "1" ]]; then
  COMPOSE_FILES+=(-f "${ROOT_DIR}/docker-compose.prod.local.yml")
fi

TASK="${1:-}"
if [[ -z "${TASK}" ]]; then
  echo "Usage: $0 <sessions|report-images>" >&2
  exit 1
fi

case "${TASK}" in
  sessions)
    CMD=(node dist/src/database/commands/cleanup-sessions.js)
    ;;
  report-images)
    CMD=(node dist/src/database/commands/cleanup-report-images.js)
    ;;
  *)
    echo "Unknown task: ${TASK}" >&2
    exit 1
    ;;
esac

compose "${COMPOSE_FILES[@]}" run --rm api "${CMD[@]}"
