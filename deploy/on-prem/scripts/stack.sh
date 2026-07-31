#!/usr/bin/env bash
# Mode B stack helper — always merges vendored Supabase + Mesa overlay.
set -euo pipefail

ONPREM_DIR="$(cd "$(dirname "$0")/.." && pwd)"
# Prefer caller-provided MESA_REPO_ROOT (host-visible path for Docker Desktop /
# docker-from-container). Fall back to repo root resolved from this tree.
ROOT="$(cd "${ONPREM_DIR}/../.." && pwd)"
export MESA_REPO_ROOT="${MESA_REPO_ROOT:-$ROOT}"
cd "$ONPREM_DIR"

if [[ ! -f .env ]]; then
  echo "Missing .env — run ./scripts/bootstrap-mode-b.sh first." >&2
  exit 1
fi

COMPOSE=(
  docker compose
  --env-file .env
  -f vendor/supabase-docker/docker-compose.yml
  -f compose.yaml
)

cmd="${1:-}"
shift || true

case "$cmd" in
  up)
    "${COMPOSE[@]}" up -d "$@"
    ;;
  down)
    "${COMPOSE[@]}" down "$@"
    ;;
  pull)
    "${COMPOSE[@]}" pull "$@"
    ;;
  ps)
    "${COMPOSE[@]}" ps "$@"
    ;;
  logs)
    "${COMPOSE[@]}" logs "$@"
    ;;
  config)
    "${COMPOSE[@]}" config "$@"
    ;;
  migrate)
    "${COMPOSE[@]}" up -d db
    ./scripts/apply-migrations.sh
    ;;
  *)
    cat <<EOF
Usage: $0 <up|down|pull|ps|logs|config|migrate> [args...]
EOF
    exit 1
    ;;
esac
