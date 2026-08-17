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
BACKUP_DIR="${BACKUP_DIR:-${ROOT_DIR}/backups/postgres}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
COMPOSE_FILES=(-f "${ROOT_DIR}/docker-compose.prod.yml")

if [[ -f "${ROOT_DIR}/docker-compose.prod.local.yml" ]] && [[ "${FUELMAP_USE_LOCAL_PROD:-}" == "1" ]]; then
  COMPOSE_FILES+=(-f "${ROOT_DIR}/docker-compose.prod.local.yml")
fi

if [[ -f "${ROOT_DIR}/.env.production" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "${ROOT_DIR}/.env.production"
  set +a
fi

mkdir -p "${BACKUP_DIR}"

TIMESTAMP="$(date -u +"%Y%m%dT%H%M%SZ")"
TEMP_FILE="${BACKUP_DIR}/.fuelmap-backup-${TIMESTAMP}.dump.tmp"
FINAL_FILE="${BACKUP_DIR}/fuelmap-${TIMESTAMP}.dump"

cleanup_temp() {
  rm -f "${TEMP_FILE}"
}
trap cleanup_temp EXIT

echo "Creating PostgreSQL backup in ${BACKUP_DIR}..."

compose "${COMPOSE_FILES[@]}" exec -T postgres \
  pg_dump -U "${POSTGRES_USER:-fuelmap}" -d "${POSTGRES_DB:-fuelmap}" -Fc \
  > "${TEMP_FILE}"

if [[ ! -s "${TEMP_FILE}" ]]; then
  echo "Backup failed: output file is empty" >&2
  exit 1
fi

mv "${TEMP_FILE}" "${FINAL_FILE}"
trap - EXIT

echo "Backup written to ${FINAL_FILE}"

find "${BACKUP_DIR}" -name 'fuelmap-*.dump' -type f -mtime +"${RETENTION_DAYS}" -delete
echo "Removed backups older than ${RETENTION_DAYS} day(s)"
