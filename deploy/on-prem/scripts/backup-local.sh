#!/usr/bin/env bash
# Mode B local daily backup (step ⑥a).
# Produces one snapshot directory under BACKUP_ROOT (default: ./backups or $MESA_HOME/backups).
# Does NOT include plaintext secrets (.env). Optional restic upload via backup-upload-restic.sh.
set -euo pipefail

ONPREM_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ONPREM_DIR"

ENV_FILE="${ONPREM_DIR}/.env"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing .env — run bootstrap-mode-b.sh / install-mesa.sh first." >&2
  exit 1
fi

if [[ -n "${MESA_HOME:-}" ]]; then
  BACKUP_ROOT="${BACKUP_ROOT:-${MESA_HOME}/backups}"
else
  BACKUP_ROOT="${BACKUP_ROOT:-${ONPREM_DIR}/backups}"
fi
LOCAL_KEEP="${MESA_BACKUP_LOCAL_KEEP:-7}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
PARTIAL="${BACKUP_ROOT}/.partial-${STAMP}"
FINAL="${BACKUP_ROOT}/${STAMP}"
RESULT_FILE="${BACKUP_ROOT}/LAST_RESULT.json"

mkdir -p "$BACKUP_ROOT"
rm -rf "$PARTIAL"
mkdir -p "$PARTIAL/storage"

POSTGRES_PASSWORD=$(grep -E '^POSTGRES_PASSWORD=' "$ENV_FILE" | head -1 | cut -d= -f2-)
POSTGRES_DB=$(grep -E '^POSTGRES_DB=' "$ENV_FILE" | head -1 | cut -d= -f2-)
POSTGRES_DB=${POSTGRES_DB:-postgres}
INSTANCE_ID=$(grep -E '^MESA_INSTANCE_ID=' "$ENV_FILE" | head -1 | cut -d= -f2- || true)
INSTANCE_ID=${INSTANCE_ID:-unknown}

# Escape for embedding in JSON string values (no secrets in detail).
json_str() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

write_result() {
  local status="$1"
  local phase="$2"
  local detail="$3"
  local snapshot="${4:-}"
  local upload="${5:-skipped}"
  cat >"$RESULT_FILE" <<JSON
{
  "schemaVersion": 1,
  "status": "$(json_str "$status")",
  "phase": "$(json_str "$phase")",
  "uploadStatus": "$(json_str "$upload")",
  "detail": "$(json_str "$detail")",
  "snapshot": "$(json_str "$snapshot")",
  "instanceId": "$(json_str "$INSTANCE_ID")",
  "finishedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
JSON
}

on_err() {
  write_result "failed" "local" "backup aborted" "" "skipped"
  rm -rf "$PARTIAL"
}
trap on_err ERR

# Ensure DB is up
./scripts/stack.sh up db >/dev/null 2>&1 || true
for i in $(seq 1 30); do
  if docker exec supabase-db pg_isready -U postgres -h localhost >/dev/null 2>&1; then
    break
  fi
  sleep 2
done
if ! docker exec supabase-db pg_isready -U postgres -h localhost >/dev/null 2>&1; then
  write_result "failed" "local" "postgres not ready" "" "skipped"
  exit 1
fi

echo "Dumping postgres → ${PARTIAL}/postgres.dump"
docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" supabase-db \
  pg_dump -U supabase_admin -d "$POSTGRES_DB" -Fc -f /tmp/mesa-backup.dump
docker cp supabase-db:/tmp/mesa-backup.dump "${PARTIAL}/postgres.dump"
docker exec supabase-db rm -f /tmp/mesa-backup.dump

DUMP_BYTES=$(wc -c <"${PARTIAL}/postgres.dump" | tr -d ' ')
if [[ "$DUMP_BYTES" -lt 1000 ]]; then
  write_result "failed" "local" "postgres.dump too small (${DUMP_BYTES} bytes)" "" "skipped"
  exit 1
fi

STORAGE_SRC=""
if [[ -n "${MESA_HOME:-}" && -d "${MESA_HOME}/data/storage" ]]; then
  STORAGE_SRC="${MESA_HOME}/data/storage"
elif [[ -d "${ONPREM_DIR}/vendor/supabase-docker/volumes/storage" ]]; then
  STORAGE_SRC="${ONPREM_DIR}/vendor/supabase-docker/volumes/storage"
fi

STORAGE_FILE_COUNT=0
if [[ -n "$STORAGE_SRC" ]]; then
  echo "Copying storage from ${STORAGE_SRC}"
  # Avoid copying huge empty dirs noise; preserve tree.
  if command -v rsync >/dev/null 2>&1; then
    rsync -a --delete "${STORAGE_SRC}/" "${PARTIAL}/storage/"
  else
    cp -a "${STORAGE_SRC}/." "${PARTIAL}/storage/" 2>/dev/null || true
  fi
  STORAGE_FILE_COUNT=$(find "${PARTIAL}/storage" -type f 2>/dev/null | wc -l | tr -d ' ')
else
  echo "WARN: no storage volume found — DB-only snapshot"
fi

DUMP_SHA=$(
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "${PARTIAL}/postgres.dump" | awk '{print $1}'
  else
    shasum -a 256 "${PARTIAL}/postgres.dump" | awk '{print $1}'
  fi
)

cat >"${PARTIAL}/meta.json" <<JSON
{
  "schemaVersion": 1,
  "createdAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "instanceId": "${INSTANCE_ID}",
  "postgresDb": "${POSTGRES_DB}",
  "dumpRole": "supabase_admin",
  "dumpFormat": "custom",
  "files": {
    "postgres.dump": { "bytes": ${DUMP_BYTES}, "sha256": "${DUMP_SHA}" },
    "storage": { "fileCount": ${STORAGE_FILE_COUNT} }
  },
  "status": "ok"
}
JSON

# Manifest of relative paths (no secrets)
(
  cd "$PARTIAL"
  find . -type f | sort > MANIFEST.txt
)

mv "$PARTIAL" "$FINAL"
echo "Local snapshot ready: ${FINAL}"

# Prune old local snapshots (keep newest LOCAL_KEEP) — portable (no mapfile).
KEEP="$LOCAL_KEEP"
ls -1d "${BACKUP_ROOT}"/20* 2>/dev/null | sort -r | while read -r snap; do
  if [[ "$KEEP" -gt 0 ]]; then
    KEEP=$((KEEP - 1))
    continue
  fi
  echo "Prune local: $snap"
  rm -rf "$snap"
done

UPLOAD_STATUS="skipped"
UPLOAD_DETAIL="no backup.env / restic not configured"
if { [[ -n "${MESA_HOME:-}" && -f "${MESA_HOME}/config/backup.env" ]]; } \
  || [[ -f "${ONPREM_DIR}/config/backup.env" ]] \
  || [[ -n "${RESTIC_REPOSITORY:-}" ]]; then
  if "${ONPREM_DIR}/scripts/backup-upload-restic.sh" "$FINAL"; then
    UPLOAD_STATUS="ok"
    UPLOAD_DETAIL="restic backup ok"
  else
    UPLOAD_STATUS="pending_retry"
    UPLOAD_DETAIL="restic upload failed; local snapshot kept"
  fi
fi

trap - ERR
write_result "ok" "local" "$UPLOAD_DETAIL" "$FINAL" "$UPLOAD_STATUS"
echo "LAST_RESULT → ${RESULT_FILE} (upload=${UPLOAD_STATUS})"
# Local success always exits 0 even if upload pending (does not block trading).
exit 0
