#!/usr/bin/env bash
# Restore Postgres (+ optional storage) from a local snapshot produced by backup-local.sh.
# Default: refuse if target DB looks populated unless --Force.
# Cloud pull: use restic restore into a dir first, then point this script at that dir.
set -euo pipefail

ONPREM_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ONPREM_DIR"

FORCE=0
SNAPSHOT=""
RESTORE_STORAGE=1

usage() {
  cat <<EOF
Usage: $0 [--Force] [--NoStorage] <snapshot-dir>

  snapshot-dir  e.g. backups/20260725T030000Z or a restic-restored folder
  --Force       allow restore into a non-empty public.restaurants table
  --NoStorage   skip copying storage/ files
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --Force) FORCE=1; shift ;;
    --NoStorage) RESTORE_STORAGE=0; shift ;;
    -h|--help) usage; exit 0 ;;
    *)
      if [[ -z "$SNAPSHOT" ]]; then SNAPSHOT=$1; shift
      else echo "Unexpected arg: $1" >&2; usage; exit 2
      fi
      ;;
  esac
done

if [[ -z "$SNAPSHOT" || ! -d "$SNAPSHOT" ]]; then
  usage
  exit 2
fi
DUMP="${SNAPSHOT}/postgres.dump"
META="${SNAPSHOT}/meta.json"
if [[ ! -f "$DUMP" ]]; then
  echo "Missing ${DUMP}" >&2
  exit 1
fi
if [[ -f "$META" ]]; then
  echo "Restoring snapshot meta:"
  cat "$META"
fi

ENV_FILE="${ONPREM_DIR}/.env"
POSTGRES_PASSWORD=$(grep -E '^POSTGRES_PASSWORD=' "$ENV_FILE" | head -1 | cut -d= -f2-)
POSTGRES_DB=$(grep -E '^POSTGRES_DB=' "$ENV_FILE" | head -1 | cut -d= -f2-)
POSTGRES_DB=${POSTGRES_DB:-postgres}

./scripts/stack.sh up db >/dev/null 2>&1 || true
for i in $(seq 1 30); do
  if docker exec supabase-db pg_isready -U postgres -h localhost >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

count=$(docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" supabase-db \
  psql -U postgres -d "$POSTGRES_DB" -tAc \
  "SELECT CASE WHEN to_regclass('public.restaurants') IS NULL THEN 0 ELSE (SELECT count(*)::int FROM public.restaurants) END" \
  | tr -d '[:space:]')
count=${count:-0}
if [[ "$count" != "0" && "$FORCE" != "1" ]]; then
  echo "Refusing restore: public.restaurants has ${count} row(s). Pass --Force to overwrite." >&2
  exit 3
fi

count=$(docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" supabase-db \
  psql -U supabase_admin -d "$POSTGRES_DB" -tAc \
  "SELECT CASE WHEN to_regclass('public.restaurants') IS NULL THEN 0 ELSE (SELECT count(*)::int FROM public.restaurants) END" \
  | tr -d '[:space:]')
count=${count:-0}
if [[ "$count" != "0" && "$FORCE" != "1" ]]; then
  echo "Refusing restore: public.restaurants has ${count} row(s). Pass --Force to overwrite." >&2
  exit 3
fi

echo "Restoring postgres from ${DUMP} (role=supabase_admin) ..."
docker cp "$DUMP" supabase-db:/tmp/mesa-restore.dump
set +e
docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" supabase-db \
  pg_restore -U supabase_admin -d "$POSTGRES_DB" --clean --if-exists --no-owner --no-acl \
  /tmp/mesa-restore.dump
restore_rc=$?
set -e
docker exec supabase-db rm -f /tmp/mesa-restore.dump
# pg_restore returns 1 when some objects warn; only fail hard on crash (rc>=2) if data missing.
after=$(docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" supabase-db \
  psql -U supabase_admin -d "$POSTGRES_DB" -tAc \
  "SELECT CASE WHEN to_regclass('public.restaurants') IS NULL THEN 0 ELSE (SELECT count(*)::int FROM public.restaurants) END" \
  | tr -d '[:space:]')
after=${after:-0}
echo "Postgres restore finished (pg_restore_rc=${restore_rc}; restaurants=${after})."
if [[ "$after" == "0" && "$count" != "0" ]]; then
  echo "ERROR: restaurants empty after restore — dump may be incomplete." >&2
  exit 4
fi
if [[ "$restore_rc" -ge 2 ]]; then
  echo "ERROR: pg_restore failed hard (rc=${restore_rc})." >&2
  exit 5
fi

if [[ "$RESTORE_STORAGE" == "1" && -d "${SNAPSHOT}/storage" ]]; then
  DEST=""
  if [[ -n "${MESA_HOME:-}" && -d "${MESA_HOME}/data/storage" ]]; then
    DEST="${MESA_HOME}/data/storage"
  elif [[ -d "${ONPREM_DIR}/vendor/supabase-docker/volumes/storage" ]]; then
    DEST="${ONPREM_DIR}/vendor/supabase-docker/volumes/storage"
  fi
  if [[ -n "$DEST" ]]; then
    echo "Restoring storage → ${DEST}"
    mkdir -p "$DEST"
    if command -v rsync >/dev/null 2>&1; then
      rsync -a --delete "${SNAPSHOT}/storage/" "${DEST}/"
    else
      rm -rf "${DEST:?}/"*
      cp -a "${SNAPSHOT}/storage/." "${DEST}/"
    fi
  else
    echo "WARN: no storage dest — skipped file restore"
  fi
fi

echo "Done. Restart stack if needed: ./scripts/stack.sh up"
