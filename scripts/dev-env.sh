#!/usr/bin/env bash
# Load env file into the shell, then start Next.js (web or ops workspace).
# Shell exports take precedence over .env.local (Next.js does not overwrite existing process.env).
# Port policy: never kill an existing listener — pick the next free port (see .cursor/rules/dev-port-isolation.mdc).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${1:-.env.local.dev}"
TARGET="${2:-web}"
cd "$ROOT"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing env file: $ENV_FILE" >&2
  echo "Run: bash scripts/sync-local-supabase-env.sh  (requires supabase start)" >&2
  exit 1
fi
set -a
# shellcheck source=/dev/null
source "$ENV_FILE"
set +a

port_in_use() {
  local port="$1"
  lsof -ti :"$port" -sTCP:LISTEN >/dev/null 2>&1
}

# Prefer preferred; if busy, walk upward. skip_port (optional) avoids web↔ops collision.
pick_listen_port() {
  local preferred="$1"
  local skip_port="${2:-}"
  local port="$preferred"
  local max=$((preferred + 40))
  while (( port <= max )); do
    if [[ -n "$skip_port" && "$port" -eq "$skip_port" ]]; then
      port=$((port + 1))
      continue
    fi
    if ! port_in_use "$port"; then
      if [[ "$port" -ne "$preferred" ]]; then
        echo "Port $preferred in use; starting on $port instead (left occupant alone)." >&2
        echo "UAT: MESA_UAT_BASE=http://localhost:$port  (or MESA_UAT_OPS_BASE for ops)" >&2
      fi
      echo "$port"
      return 0
    fi
    port=$((port + 1))
  done
  echo "No free listen port near $preferred (tried through $max)" >&2
  exit 1
}

case "$TARGET" in
  web)
    WEB_PORT="$(pick_listen_port 3000 3001)"
    cd apps/web
    exec npx next dev --hostname 0.0.0.0 --port "$WEB_PORT"
    ;;
  ops)
    OPS_PORT="$(pick_listen_port 3001 3000)"
    cd apps/ops
    exec npx next dev --hostname 0.0.0.0 --port "$OPS_PORT"
    ;;
  *)
    echo "Unknown target: $TARGET (use web or ops)" >&2
    exit 1
    ;;
esac
