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

# --schema=public omits triggers on other schemas' tables (e.g. auth.users) that call
# public functions — migrations create them, so a fresh install must too. Generated from
# the tip DB (migrations stay the sole source); empty search_path → schema-qualified names
# (the dump runs with search_path ''). Appended last: functions exist by then; the fresh
# path's DROP SCHEMA public CASCADE drops them together with their public function.
{
  echo
  echo "-- Triggers on non-public tables calling public functions (not in --schema=public dump)."
  docker exec "$DB_CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -qtA \
    -c "SET search_path = ''" -c "
    SELECT pg_get_triggerdef(t.oid) || ';'
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_proc p ON p.oid = t.tgfoid
    JOIN pg_namespace pn ON pn.oid = p.pronamespace
    WHERE NOT t.tgisinternal AND n.nspname <> 'public' AND pn.nspname = 'public'
    ORDER BY n.nspname, c.relname, t.tgname"
} >>"$OUT"

# Lock which supabase/migrations filenames this dump already includes.
COVERED="${ONPREM_DIR}/schema/baseline_covered_migrations.txt"
ls "${ROOT}/supabase/migrations"/*.sql 2>/dev/null \
  | xargs -n1 basename \
  >"$COVERED" || true

wc -l "$OUT"
echo "Wrote $OUT"
echo "Wrote $COVERED ($(wc -l <"$COVERED" | tr -d ' ') files)"
