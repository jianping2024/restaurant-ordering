#!/usr/bin/env bash
# Export public schema baseline from a green Postgres (default: local supabase CLI DB).
# Usage:
#   ./scripts/export-schema-baseline.sh
#   DB_CONTAINER=supabase_db_restaurant-ordering ./scripts/export-schema-baseline.sh
set -euo pipefail

ONPREM_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ROOT="$(cd "${ONPREM_DIR}/../.." && pwd)"
OUT="${ONPREM_DIR}/schema/baseline_public.sql"
DB_CONTAINER="${DB_CONTAINER:-supabase_db_restaurant-ordering}"

mkdir -p "${ONPREM_DIR}/schema"
docker exec "$DB_CONTAINER" pg_dump -U postgres -d postgres \
  --schema=public --schema-only --no-owner --no-acl \
  >"$OUT"

# Lock which supabase/migrations filenames this dump already includes.
COVERED="${ONPREM_DIR}/schema/baseline_covered_migrations.txt"
ls "${ROOT}/supabase/migrations"/*.sql 2>/dev/null \
  | xargs -n1 basename \
  >"$COVERED" || true

wc -l "$OUT"
echo "Wrote $OUT"
echo "Wrote $COVERED ($(wc -l <"$COVERED" | tr -d ' ') files)"
