#!/usr/bin/env bash
# Apply Mesa migrations inside the Mode B compose network (run via migrate profile).
set -euo pipefail

echo "Waiting for Postgres at ${PGHOST}:${PGPORT}..."
for i in $(seq 1 60); do
  if pg_isready -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" >/dev/null 2>&1; then
    break
  fi
  sleep 2
done
pg_isready -h "$PGHOST" -p "$PGPORT" -U "$PGUSER"

psql -v ON_ERROR_STOP=1 <<'SQL'
CREATE TABLE IF NOT EXISTS public.mesa_schema_migrations (
  filename text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);
SQL

shopt -s nullglob
files=(/migrations/*.sql)
if [[ ${#files[@]} -eq 0 ]]; then
  echo "No migration files found under /migrations" >&2
  exit 1
fi

for f in "${files[@]}"; do
  base=$(basename "$f")
  exists=$(psql -tAc "SELECT 1 FROM public.mesa_schema_migrations WHERE filename = '${base}'")
  if [[ "$exists" == "1" ]]; then
    echo "skip $base"
    continue
  fi
  echo "apply $base"
  psql -v ON_ERROR_STOP=1 -f "$f"
  psql -v ON_ERROR_STOP=1 -c "INSERT INTO public.mesa_schema_migrations (filename) VALUES ('${base}')"
done

echo "Migrations complete."
