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

case "$TARGET" in
  web)
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
