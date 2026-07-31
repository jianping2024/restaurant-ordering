# Mesa Mode B: two-channel psql over docker exec.
# Source after POSTGRES_PASSWORD and POSTGRES_DB are set.
# Container name is fixed: supabase-db (Mode B compose).
#
# sql_exec   — run SQL; never use its stdout as data (discarded).
# sql_scalar — one trimmed scalar; never feed heredoc/file through this path.
#
# Do not mix: capturing sql_exec stdout as a file list is forbidden.

: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD required}"
: "${POSTGRES_DB:?POSTGRES_DB required}"

MESA_DB_CONTAINER="${MESA_DB_CONTAINER:-supabase-db}"

sql_exec() {
  # Usage: sql_exec                 < file.sql
  #        sql_exec -f -            < stream
  #        args are passed to psql (e.g. -f /path is NOT used — host paths differ).
  docker exec -i -e PGPASSWORD="$POSTGRES_PASSWORD" "$MESA_DB_CONTAINER" \
    psql -U postgres -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -q "$@" >/dev/null
}

sql_exec_file() {
  local host_file="$1"
  if [[ ! -f "$host_file" ]]; then
    echo "ERROR: SQL file not found: ${host_file}" >&2
    return 1
  fi
  docker exec -i -e PGPASSWORD="$POSTGRES_PASSWORD" "$MESA_DB_CONTAINER" \
    psql -U postgres -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -q <"$host_file" >/dev/null
}

sql_scalar() {
  local query="$1"
  # No -i: attached empty stdin breaks -tAc batches on some Docker setups.
  docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" "$MESA_DB_CONTAINER" \
    psql -U postgres -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -q -tAc "$query" \
    | tr -d '[:space:]'
}
