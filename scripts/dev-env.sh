#!/usr/bin/env bash
# Load env file into the shell, then start Next.js (web or ops workspace).
# Shell exports take precedence over .env.local (Next.js does not overwrite existing process.env).
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

free_listen_port() {
  local port="$1"
  local pids
  pids="$(lsof -ti :"$port" -sTCP:LISTEN 2>/dev/null || true)"
  if [[ -n "$pids" ]]; then
    echo "Port $port in use (PIDs: $pids); stopping..." >&2
    # shellcheck disable=SC2086
    kill $pids 2>/dev/null || true
    sleep 1
  fi
  if command -v docker >/dev/null 2>&1 && docker ps --format '{{.Names}}' 2>/dev/null | grep -qx 'mesa-on-prem-web-1'; then
    echo "Stopping mesa-on-prem-web-1 (binds :$port)..." >&2
    docker stop mesa-on-prem-web-1 >/dev/null 2>&1 || true
  fi
}

case "$TARGET" in
  web)
    free_listen_port 3000
    cd apps/web
    exec npx next dev --hostname 0.0.0.0 --port 3000
    ;;
  ops)
    cd apps/ops
    exec npx next dev --hostname 0.0.0.0 --port 3001
    ;;
  *)
    echo "Unknown target: $TARGET (use web or ops)" >&2
    exit 1
    ;;
esac
