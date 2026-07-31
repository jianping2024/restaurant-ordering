#!/usr/bin/env bash
# Upload one local snapshot directory to a restic repository (S3/R2/etc.).
# Config: MESA_HOME/config/backup.env or deploy/on-prem/config/backup.env
# Required: RESTIC_REPOSITORY, RESTIC_PASSWORD
# Optional AWS_*: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_DEFAULT_REGION
set -euo pipefail

ONPREM_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SNAPSHOT_DIR="${1:-}"
if [[ -z "$SNAPSHOT_DIR" || ! -d "$SNAPSHOT_DIR" ]]; then
  echo "Usage: $0 <snapshot-dir>" >&2
  exit 2
fi

load_env() {
  local f="$1"
  [[ -f "$f" ]] || return 1
  set -a
  # shellcheck disable=SC1090
  source "$f"
  set +a
  return 0
}

if [[ -n "${MESA_HOME:-}" ]]; then
  load_env "${MESA_HOME}/config/backup.env" || true
fi
load_env "${ONPREM_DIR}/config/backup.env" || true

if [[ -z "${RESTIC_REPOSITORY:-}" || -z "${RESTIC_PASSWORD:-}" ]]; then
  echo "RESTIC_REPOSITORY / RESTIC_PASSWORD not set — skip upload" >&2
  exit 3
fi

if ! command -v restic >/dev/null 2>&1; then
  echo "restic not installed — skip upload" >&2
  exit 4
fi

INSTANCE_ID="${MESA_INSTANCE_ID:-}"
if [[ -z "$INSTANCE_ID" && -f "${ONPREM_DIR}/.env" ]]; then
  INSTANCE_ID=$(grep -E '^MESA_INSTANCE_ID=' "${ONPREM_DIR}/.env" | head -1 | cut -d= -f2- || true)
fi
INSTANCE_ID=${INSTANCE_ID:-unknown}
HOST_TAG="${MESA_BACKUP_HOSTNAME:-$(hostname -s 2>/dev/null || echo mesa)}"

# Init repo if needed (idempotent)
restic snapshots >/dev/null 2>&1 || restic init

echo "restic backup ${SNAPSHOT_DIR} → ${RESTIC_REPOSITORY}"
restic backup "$SNAPSHOT_DIR" \
  --tag "mesa" \
  --tag "instance:${INSTANCE_ID}" \
  --tag "host:${HOST_TAG}" \
  --host "$HOST_TAG"

KEEP_DAYS="${MESA_BACKUP_REMOTE_KEEP_DAYS:-14}"
echo "restic forget --keep-within ${KEEP_DAYS}d"
restic forget --keep-within "${KEEP_DAYS}d" --prune --tag mesa || true

echo "Upload complete."
