#!/usr/bin/env bash
# Copy cloud (restaurant-ordering) database + menu-images storage to staging
# (restaurant-ordering-dev), fully overwriting staging content.
#
# Prerequisites:
#   - supabase login
#   - staging project ACTIVE (unpause from dashboard if INACTIVE)
#   - docker (for psql client)
#
# Usage:
#   ./scripts/sync-cloud-to-staging.sh          # use cached .sync-tmp dumps if present
#   ./scripts/sync-cloud-to-staging.sh --fresh  # re-dump cloud before restore

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SYNC_DIR="$ROOT/.sync-tmp"
CLOUD_REF="spgnhkaqtsbytvletpdm"
STAGING_REF="mnvqmrrvbqwuxfxlewdm"
FRESH=0

if [[ "${1:-}" == "--fresh" ]]; then
  FRESH=1
fi

die() {
  echo "error: $*" >&2
  exit 1
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "missing required command: $1"
}

project_status() {
  local ref="$1"
  supabase projects list -o json 2>/dev/null \
    | python3 -c "
import json, re, sys
raw = sys.stdin.read()
m = re.search(r'\[.*\]', raw, re.S)
data = json.loads(m.group(0))
for p in data:
    if p.get('id') == '$ref':
        print(p.get('status', 'UNKNOWN'))
        break
else:
    print('NOT_FOUND')
"
}

run_psql_file() {
  local sql_file="$1"
  local dry_run
  dry_run="$(supabase db dump --linked --dry-run 2>/dev/null | sed -n '/^export PG/p')"
  [[ -n "$dry_run" ]] || die "could not read linked database connection"
  # shellcheck disable=SC1090
  eval "$dry_run"
  docker run --rm \
    -v "$SYNC_DIR:/sync:ro" \
    -e PGPASSWORD \
    postgres:17 \
    psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" \
      -v ON_ERROR_STOP=1 \
      -f "/sync/$(basename "$sql_file")"
}

require_cmd supabase
require_cmd docker
require_cmd python3

mkdir -p "$SYNC_DIR"

echo "==> 1/7 Dump cloud ($CLOUD_REF)"
supabase link --project-ref "$CLOUD_REF" --yes >/dev/null

if [[ "$FRESH" -eq 1 || ! -f "$SYNC_DIR/cloud_data.sql" ]]; then
  supabase db dump --linked -f "$SYNC_DIR/cloud_schema.sql"
  supabase db dump --linked --data-only --use-copy -f "$SYNC_DIR/cloud_data.sql"
else
  echo "    reusing $SYNC_DIR/cloud_data.sql (pass --fresh to re-dump)"
fi

echo "==> 2/7 Download menu-images from cloud"
rm -rf "$SYNC_DIR/storage-menu-images"
mkdir -p "$SYNC_DIR/storage-menu-images"
if supabase storage cp -r "ss:///menu-images" "$SYNC_DIR/storage-menu-images" --linked --experimental 2>/dev/null; then
  STORAGE_FILE_COUNT="$(find "$SYNC_DIR/storage-menu-images" -type f 2>/dev/null | wc -l | tr -d ' ')"
  echo "    storage download ok ($STORAGE_FILE_COUNT files)"
else
  STORAGE_FILE_COUNT=0
  echo "    warn: menu-images download failed or bucket empty (continuing)"
fi

echo "==> 3/7 Check staging project status"
STAGING_STATUS="$(project_status "$STAGING_REF")"
if [[ "$STAGING_STATUS" != "ACTIVE_HEALTHY" ]]; then
  die "staging $STAGING_REF status=$STAGING_STATUS (expected ACTIVE_HEALTHY). Unpause/restore it in Supabase dashboard, then re-run this script."
fi

echo "==> 4/7 Link staging + apply migrations"
supabase link --project-ref "$STAGING_REF" --yes >/dev/null
supabase db push --yes

echo "==> 5/7 Wipe staging data"
cp "$ROOT/scripts/staging-wipe-all-data.sql" "$SYNC_DIR/staging-wipe-all-data.sql"
# supabase db query -f does not support multi-statement files reliably; use psql.
run_psql_file "$SYNC_DIR/staging-wipe-all-data.sql"

echo "==> 6/7 Restore cloud data to staging"
run_psql_file "$SYNC_DIR/cloud_data.sql"

echo "==> 7/7 Upload menu-images to staging"
if [[ "${STORAGE_FILE_COUNT:-0}" != "0" ]]; then
  STORAGE_UPLOAD_SRC="$SYNC_DIR/storage-menu-images"
  if [[ -d "$SYNC_DIR/storage-menu-images/menu-images" ]]; then
    STORAGE_UPLOAD_SRC="$SYNC_DIR/storage-menu-images/menu-images"
  fi
  supabase storage cp -r "$STORAGE_UPLOAD_SRC" "ss:///menu-images" --linked --experimental
  echo "    storage upload ok"
else
  echo "    skip storage upload (no files downloaded)"
fi

echo "==> Restore CLI link to cloud"
supabase link --project-ref "$CLOUD_REF" --yes >/dev/null

echo "Done. Staging ($STAGING_REF) now mirrors cloud data."
echo "Run: npm run stage  (uses .env.local.supabase — confirm it points to staging)"
