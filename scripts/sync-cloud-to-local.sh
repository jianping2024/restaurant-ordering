#!/usr/bin/env bash
# Copy cloud (restaurant-ordering) database into local Docker Supabase.
#
# Prerequisites:
#   - supabase login
#   - supabase start (local)
#   - docker (psql client image)
#
# Usage:
#   ./scripts/sync-cloud-to-local.sh
#   ./scripts/sync-cloud-to-local.sh --fresh   # re-dump cloud before import

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SYNC_DIR="$ROOT/.sync-tmp"
CLOUD_REF="spgnhkaqtsbytvletpdm"
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

run_local_psql_file() {
  local file="$1"
  docker run --rm \
    -v "$SYNC_DIR:/sync:ro" \
    postgres:17 \
    psql "postgresql://postgres:postgres@host.docker.internal:54322/postgres" \
      -v ON_ERROR_STOP=1 \
      -f "/sync/$(basename "$file")"
}

prepare_local_data_sql() {
  python3 - <<'PY'
from pathlib import Path
import re

src = Path(".sync-tmp/cloud_data.sql").read_text()
src = re.sub(r"^SET transaction_timeout = 0;\n", "", src, flags=re.M)
for name in [
    "buckets",
    "buckets_analytics",
    "buckets_vectors",
    "objects",
    "s3_multipart_uploads",
    "s3_multipart_uploads_parts",
    "vector_indexes",
]:
    src = re.sub(
        rf"-- Data for Name: {re.escape(name)}; Type: TABLE DATA; Schema: storage;.*?\n\\\.\n\n",
        "",
        src,
        flags=re.S,
    )
Path(".sync-tmp/cloud_data_local.sql").write_text(src)
PY
}

require_cmd supabase
require_cmd docker
require_cmd python3

mkdir -p "$SYNC_DIR"
cd "$ROOT"

supabase status >/dev/null 2>&1 || die "local supabase is not running — run: supabase start"

echo "==> 1/5 Dump cloud ($CLOUD_REF)"
supabase link --project-ref "$CLOUD_REF" --yes >/dev/null
if [[ "$FRESH" -eq 1 || ! -f "$SYNC_DIR/cloud_data.sql" ]]; then
  supabase db dump --linked --data-only --use-copy -f "$SYNC_DIR/cloud_data.sql"
else
  echo "    reusing $SYNC_DIR/cloud_data.sql (pass --fresh to re-dump)"
fi

echo "==> 2/5 Download menu-images from cloud (optional)"
rm -rf "$SYNC_DIR/storage-menu-images"
mkdir -p "$SYNC_DIR/storage-menu-images"
if supabase storage cp -r "ss:///menu-images" "$SYNC_DIR/storage-menu-images" --linked --experimental 2>/dev/null; then
  STORAGE_FILE_COUNT="$(find "$SYNC_DIR/storage-menu-images" -type f 2>/dev/null | wc -l | tr -d ' ')"
  echo "    downloaded $STORAGE_FILE_COUNT files"
else
  STORAGE_FILE_COUNT=0
  echo "    warn: menu-images download failed or bucket empty"
fi

echo "==> 3/5 Reset local schema (no seed) + import cloud data"
prepare_local_data_sql
supabase db reset --local --no-seed --yes >/dev/null
run_local_psql_file "$SYNC_DIR/cloud_data_local.sql"

echo "==> 4/5 Upload menu-images to local (optional)"
if [[ "${STORAGE_FILE_COUNT:-0}" != "0" ]]; then
  UPLOAD_SRC="$SYNC_DIR/storage-menu-images"
  if [[ -d "$SYNC_DIR/storage-menu-images/menu-images" ]]; then
    UPLOAD_SRC="$SYNC_DIR/storage-menu-images/menu-images"
  fi
  supabase storage cp -r "$UPLOAD_SRC" "ss:///menu-images" --local --experimental
  echo "    storage upload ok"
else
  echo "    skip storage upload (no files)"
fi

echo "==> 5/5 Refresh .env.local.dev"
bash "$ROOT/scripts/sync-local-supabase-env.sh"

echo "Done. Local Docker Supabase mirrors cloud data."
echo "Run: npm run dev"
