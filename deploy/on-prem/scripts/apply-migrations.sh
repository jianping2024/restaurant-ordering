#!/usr/bin/env bash
# Apply Mesa schema to Mode B Postgres (single orchestration, two-channel psql).
#
# Fresh install (no __baseline_public__ marker):
#   1) ensure_ledger
#   2) DROP public + baseline_public.sql + marker
#   3) sync_covered_from_file   — ONLY here: dump already includes tip schema, so
#      covered filenames are stamped without re-running SQL (fresh pending=0)
#   4) apply_pending_sql_files  (disk *.sql minus ledger; usually 0 at tip)
#   5) ensure_realtime_publication (every run; baseline omits pub membership)
#
# Live upgrade / re-run (marker present, or MESA_MIGRATE_INCREMENTAL_ONLY=1):
#   NEVER sync_covered_from_file. That only INSERT-stamps covered rows and would
#   skip real SQL on stores whose live schema never got those migrations
#   (Pirata 2026-10-21: station_print / time_slot marked applied, columns missing).
#   Only apply_pending_sql_files (ledger miss → run file in one tx → stamp) + ensure realtime.
#   Each pending *.sql uses psql -1 (single transaction), same as supabase CLI —
#   otherwise TEMP … ON COMMIT DROP dies after the CREATE statement (Pirata 2026-10-31).
#
# Pending is a bash path array from glob + sql_scalar checks — never from psql stdout.
#
# Data prechecks: before ANY pending file runs, if a migration with a data precheck is
# pending, run that read-only precheck; any row → print it and exit 3 (nothing applied,
# no half-migrated state). upgrade.sh records exit 3 as phase "migrate-precheck".
set -euo pipefail

ONPREM_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ROOT="$(cd "${ONPREM_DIR}/../.." && pwd)"
MIG_DIR="${ROOT}/supabase/migrations"
BASELINE="${ONPREM_DIR}/schema/baseline_public.sql"
COVERED_FILE="${ONPREM_DIR}/schema/baseline_covered_migrations.txt"
REALTIME_ENSURE="${ONPREM_DIR}/schema/ensure_realtime_publication.sql"
ENV_FILE="${ONPREM_DIR}/.env"
# Multi-store step 1 (docs/technical/multi-store-access-plan.zh.md §5.3): violation listing.
# Sole source is repo scripts/db/multi-store-precheck.sql; pack-release copies it into
# schema/ because a store's installed upgrade.sh only syncs deploy/on-prem (+ web/migrations).
MULTI_STORE_MIGRATION="20261120120000_staff_identities_multi_store_step1.sql"
MULTI_STORE_PRECHECK="${ONPREM_DIR}/schema/multi-store-precheck.sql"
[[ -f "$MULTI_STORE_PRECHECK" ]] || MULTI_STORE_PRECHECK="${ROOT}/scripts/db/multi-store-precheck.sql"
PRECHECK_EXIT=3
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

cd "$ONPREM_DIR"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing .env — run ./scripts/bootstrap-mode-b.sh first." >&2
  exit 1
fi
if [[ ! -f "$BASELINE" ]]; then
  echo "Missing ${BASELINE}. Run ./scripts/export-schema-baseline.sh on a green DB." >&2
  exit 1
fi

POSTGRES_PASSWORD=$(grep -E '^POSTGRES_PASSWORD=' "$ENV_FILE" | head -1 | cut -d= -f2-)
POSTGRES_DB=$(grep -E '^POSTGRES_DB=' "$ENV_FILE" | head -1 | cut -d= -f2-)
POSTGRES_DB=${POSTGRES_DB:-postgres}
export POSTGRES_PASSWORD POSTGRES_DB

# shellcheck source=lib/psql-mesa.sh
source "${SCRIPT_DIR}/lib/psql-mesa.sh"

if [[ "${MESA_SKIP_STACK_UP:-}" != "1" ]]; then
  ./scripts/stack.sh up db >/dev/null
fi

echo "Waiting for Postgres..."
ready=0
for _ in $(seq 1 60); do
  if docker exec "${MESA_DB_CONTAINER}" pg_isready -U postgres -h localhost >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 2
done
if [[ "$ready" != "1" ]]; then
  echo "ERROR: ${MESA_DB_CONTAINER} not ready." >&2
  exit 1
fi

sql_escape() {
  printf '%s' "${1//\'/\'\'}"
}

# --- step 1 ---
ensure_ledger() {
  sql_exec <<'SQL'
CREATE TABLE IF NOT EXISTS public.mesa_schema_migrations (
  filename text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);
SQL
}

has_baseline_marker() {
  [[ "$(sql_scalar "SELECT CASE WHEN to_regclass('public.mesa_schema_migrations') IS NULL THEN 0 ELSE 1 END")" == "1" ]] \
    && [[ "$(sql_scalar "SELECT count(*)::int FROM public.mesa_schema_migrations WHERE filename = '__baseline_public__'")" == "1" ]]
}

# --- step 2 ---
apply_baseline_if_needed() {
  if has_baseline_marker; then
    echo "Baseline marker already present — skip DROP / baseline dump."
    return 0
  fi

  local live
  live=$(sql_scalar "SELECT CASE WHEN to_regclass('public.restaurants') IS NULL THEN 0 ELSE (SELECT count(*)::int FROM public.restaurants) END" || echo 0)
  live=${live:-0}
  if [[ "$live" != "0" ]]; then
    echo "Refusing baseline DROP SCHEMA: public.restaurants has ${live} row(s)." >&2
    exit 1
  fi

  echo "Applying public schema baseline..."
  sql_exec <<'SQL'
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;
SQL

  grep -v -E '^CREATE SCHEMA public' "$BASELINE" \
    | grep -v -E '^ALTER SCHEMA public OWNER' \
    | sql_exec -f -

  sql_exec <<'SQL'
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres, anon, authenticated, service_role;
SQL

  ensure_ledger
  sql_exec <<'SQL'
INSERT INTO public.mesa_schema_migrations (filename) VALUES ('__baseline_public__')
ON CONFLICT DO NOTHING;
SQL

  if [[ "$(sql_scalar "SELECT count(*)::int FROM public.mesa_schema_migrations WHERE filename = '__baseline_public__'")" != "1" ]]; then
    echo "ERROR: baseline marker missing after apply." >&2
    exit 1
  fi
  echo "Baseline marker OK."

  # Tip dump already has schema for every covered file — stamp ledger so pending=0.
  # Live upgrades must never call this (would skip real SQL).
  sync_covered_from_file

  if [[ "$(sql_scalar "SELECT CASE WHEN to_regclass('storage.buckets') IS NULL THEN 0 ELSE 1 END")" == "1" ]]; then
    sql_exec <<'SQL'
INSERT INTO storage.buckets (id, name, public)
VALUES ('menu-images', 'menu-images', true)
ON CONFLICT (id) DO NOTHING;
SQL
  else
    echo "WARN: storage.buckets not ready yet — skip bucket seed."
  fi
}

# --- step 3 (fresh baseline only) ---
# Stamp covered migration filenames after a tip baseline dump was just loaded.
# Must not run on live upgrades — see header.
sync_covered_from_file() {
  ensure_ledger
  local sql_tmp base
  sql_tmp="$(mktemp)"
  {
    echo "BEGIN;"
    if [[ -f "$COVERED_FILE" ]]; then
      while IFS= read -r base || [[ -n "$base" ]]; do
        base=$(printf '%s' "$base" | tr -d '[:space:]')
        [[ -z "$base" || "$base" == \#* ]] && continue
        echo "INSERT INTO public.mesa_schema_migrations (filename) VALUES ('$(sql_escape "$base")') ON CONFLICT DO NOTHING;"
      done <"$COVERED_FILE"
    else
      echo "WARN: missing ${COVERED_FILE} — marking all migration files as covered." >&2
      shopt -s nullglob
      local f
      for f in "${MIG_DIR}"/*.sql; do
        echo "INSERT INTO public.mesa_schema_migrations (filename) VALUES ('$(sql_escape "$(basename "$f")")') ON CONFLICT DO NOTHING;"
      done
    fi
    echo "COMMIT;"
  } >"$sql_tmp"
  sql_exec_file "$sql_tmp"
  rm -f "$sql_tmp"

  local marked
  marked=$(sql_scalar "SELECT count(*) FROM public.mesa_schema_migrations WHERE filename <> '__baseline_public__'")
  echo "Marked baseline-covered migrations (rows excluding baseline marker: ${marked})."
}

# --- step 4 ---
# Fills nameref array with absolute paths of pending *.sql files only.
collect_pending_paths() {
  local -n _pending=$1
  _pending=()
  ensure_ledger
  shopt -s nullglob
  local f base
  for f in "${MIG_DIR}"/*.sql; do
    [[ -f "$f" ]] || continue
    base=$(basename "$f")
    if [[ "$(sql_scalar "SELECT 1 FROM public.mesa_schema_migrations WHERE filename = '$(sql_escape "$base")'")" != "1" ]]; then
      _pending+=("$f")
    fi
  done
}

# Abort before any pending SQL runs when legacy data would violate the multi-store rules.
precheck_multi_store_if_pending() {
  local f needed=0
  for f in "$@"; do
    [[ "$(basename "$f")" == "$MULTI_STORE_MIGRATION" ]] && needed=1
  done
  [[ "$needed" == "1" ]] || return 0

  if [[ ! -f "$MULTI_STORE_PRECHECK" ]]; then
    echo "ERROR: ${MULTI_STORE_MIGRATION} is pending but ${MULTI_STORE_PRECHECK} is missing — refusing to migrate." >&2
    exit "$PRECHECK_EXIT"
  fi
  echo "Multi-store precheck (read-only) before ${MULTI_STORE_MIGRATION}..."
  local report
  report=$(sql_report_file "$MULTI_STORE_PRECHECK")
  if [[ -n "$report" ]]; then
    {
      echo "ERROR: 多店迁移违约预查未通过，升级已中止，本次没有执行任何迁移（数据库未改动）。"
      echo "违约明细（类型|账号 user_id|门店）："
      printf '%s\n' "$report" | sed 's/^/  /'
      echo "说明：owner_of_multiple_restaurants = 同一账号是多家店的管理员；"
      echo "      owner_has_staff_membership = 管理员账号同时有员工店籍；"
      echo "      print_agent_multiple_memberships = 打印代理账号有多行店籍。"
      echo "处理：联系平台人工清理上述数据后，重新执行升级。"
    } >&2
    exit "$PRECHECK_EXIT"
  fi
  echo "Multi-store precheck OK (0 violations)."
}

apply_pending_sql_files() {
  local pending=()
  collect_pending_paths pending

  if [[ ${#pending[@]} -eq 0 ]]; then
    echo "No pending incremental migrations (baseline covers current tree)."
    return 0
  fi

  precheck_multi_store_if_pending "${pending[@]}"

  echo "Pending incremental migrations: ${#pending[@]}"
  local f base applied=0
  for f in "${pending[@]}"; do
    [[ -f "$f" && "$f" == *.sql ]] || {
      echo "ERROR: refusing non-file pending entry: ${f}" >&2
      exit 1
    }
    base=$(basename "$f")
    echo "Applying incremental migration: ${base}"
    sql_exec_file_tx "$f"
    sql_exec <<SQL
INSERT INTO public.mesa_schema_migrations (filename) VALUES ('$(sql_escape "$base")')
ON CONFLICT DO NOTHING;
SQL
    applied=$((applied + 1))
  done
  echo "Applied ${applied} incremental migration(s)."
}

# Publication membership is not in baseline_public.sql; must run every migrate.
ensure_realtime_publication() {
  if [[ ! -f "$REALTIME_ENSURE" ]]; then
    echo "ERROR: missing ${REALTIME_ENSURE}" >&2
    exit 1
  fi
  echo "Ensuring supabase_realtime publication tables..."
  sql_exec_file "$REALTIME_ENSURE"
}

# --- orchestration ---
ensure_ledger

if [[ "${MESA_MIGRATE_INCREMENTAL_ONLY:-}" == "1" ]]; then
  echo "MESA_MIGRATE_INCREMENTAL_ONLY=1 — skipping baseline DROP; not stamping covered (live upgrade)."
  if ! has_baseline_marker; then
    echo "Refusing incremental-only migrate: baseline marker __baseline_public__ missing." >&2
    exit 1
  fi
  apply_pending_sql_files
  ensure_realtime_publication
  echo "Next: ./scripts/stack.sh up --build web"
  exit 0
fi

# Fresh path: apply_baseline_if_needed stamps covered only when it just loaded the dump.
# If marker already present (accidental full re-run on a live store), skip sync_covered
# and only apply ledger-missing files — same rule as upgrade.
apply_baseline_if_needed
apply_pending_sql_files
ensure_realtime_publication
echo "Next: ./scripts/stack.sh up --build web"
