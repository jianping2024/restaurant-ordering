#!/usr/bin/env bash
# One-shot verify: clean previous Mesa verify stack + fresh Mode B install in WSL/Linux.
# Usage: verify-install-wsl.sh <pack-root>
# Invoked once per Windows START-WSL-TEST.cmd session (no nested wsl probes from cmd).
set -euo pipefail

echo "verify-install-wsl: session started"
echo "  pwd=$(pwd)"
echo "  arg1=${1:-}"

PACK_SRC="${1:?pack root required}"
PACK_SRC="$(cd "$PACK_SRC" && pwd)"
VERIFY_HOME="${HOME}/mesa-verify"

if [[ -f "$PACK_SRC/PACK-ID.txt" ]]; then
  echo "Pack ID: $(tr -d '[:space:]' <"$PACK_SRC/PACK-ID.txt")"
fi

if [[ ! -f "$PACK_SRC/deploy/on-prem/compose.yaml" ]]; then
  echo "ERROR: not a Mesa on-prem pack root: $PACK_SRC" >&2
  exit 1
fi
if [[ ! -f "$PACK_SRC/apps/web/Dockerfile" ]]; then
  echo "ERROR: missing apps/web/Dockerfile in $PACK_SRC" >&2
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "ERROR: docker not found inside Ubuntu." >&2
  echo "Fix: Start Docker Desktop; Settings -> Resources -> WSL Integration -> enable Ubuntu." >&2
  exit 1
fi

echo "Checking docker daemon (inside Ubuntu)..."
if ! docker info >/dev/null 2>&1; then
  echo "Docker daemon not ready yet; waiting up to 90s..."
  ready=0
  for i in $(seq 1 45); do
    if docker info >/dev/null 2>&1; then
      ready=1
      break
    fi
    sleep 2
  done
  if [[ "$ready" != "1" ]]; then
    echo "ERROR: docker daemon not reachable inside Ubuntu." >&2
    echo "Start Docker Desktop (Ready) and enable WSL Integration for Ubuntu." >&2
    exit 1
  fi
fi
echo "Docker OK."

wipe_dir_as_root() {
  local dir="$1"
  [[ -e "$dir" ]] || return 0
  local parent base
  parent="$(cd "$(dirname "$dir")" && pwd)"
  base="$(basename "$dir")"
  echo "Removing ${dir} (docker root; volume files may be root-owned)..."
  docker run --rm -v "${parent}:/parent" alpine:3.20 rm -rf "/parent/${base}"
  if [[ -e "$dir" ]]; then
    echo "ERROR: could not remove ${dir}" >&2
    exit 1
  fi
}

echo ""
echo "=== 1/5 Clean previous verify install ==="
# Stop compose project if previous verify tree still exists
if [[ -d "$VERIFY_HOME/deploy/on-prem" ]]; then
  echo "Stopping stack in ${VERIFY_HOME}..."
  (
    cd "$VERIFY_HOME/deploy/on-prem"
    export MESA_REPO_ROOT="$VERIFY_HOME"
    chmod +x scripts/*.sh 2>/dev/null || true
    ./scripts/stack.sh down -v 2>/dev/null || true
  ) || true
fi

# Fixed container_names from vendored Supabase + Mesa overlay (safe for verify machine)
echo "Removing leftover Mesa/Supabase containers (if any)..."
docker rm -f \
  supabase-db supabase-kong supabase-auth supabase-rest supabase-meta \
  supabase-studio supabase-storage supabase-imgproxy supabase-pooler \
  supabase-edge-functions supabase-analytics \
  realtime-dev.supabase-realtime \
  2>/dev/null || true

docker compose -p mesa-on-prem down -v 2>/dev/null || true

# Bind-mounted DB files survive compose -v; wipe verify home entirely as root.
wipe_dir_as_root "$VERIFY_HOME"
echo "Clean done."

echo ""
echo "=== 2/5 Stage pack on Linux disk ==="
# Always install from VERIFY_HOME so Windows /mnt/c is not the bind-mount root.
PACK="$VERIFY_HOME"
mkdir -p "$PACK"
echo "Copying pack -> ${PACK}"
if command -v rsync >/dev/null 2>&1; then
  rsync -a \
    --exclude 'deploy/on-prem/.env' \
    --exclude 'deploy/on-prem/vendor/supabase-docker/volumes/db/data/' \
    --exclude 'deploy/on-prem/vendor/supabase-docker/volumes/storage/' \
    "$PACK_SRC/" "$PACK/"
else
  cp -a "$PACK_SRC/." "$PACK/"
  rm -f "$PACK/deploy/on-prem/.env"
  rm -rf "$PACK/deploy/on-prem/vendor/supabase-docker/volumes/db/data" \
    "$PACK/deploy/on-prem/vendor/supabase-docker/volumes/storage" 2>/dev/null || true
fi

ONPREM="$PACK/deploy/on-prem"
cd "$ONPREM"
chmod +x scripts/*.sh
export MESA_REPO_ROOT="$PACK"
echo "MESA_REPO_ROOT=$MESA_REPO_ROOT"

echo ""
echo "=== 3/5 Bootstrap .env ==="
./scripts/bootstrap-mode-b.sh

echo ""
echo "=== 4/5 Pull + up ==="
# Arg2 or MESA_VERIFY_BUILD=1 or FORCE-WEB-BUILD.txt => --build; else up only (less RAM).
BUILD_FLAG="${2:-${MESA_VERIFY_BUILD:-0}}"
if [[ -f "$PACK_SRC/FORCE-WEB-BUILD.txt" || -f "$PACK/FORCE-WEB-BUILD.txt" ]]; then
  BUILD_FLAG=1
fi
./scripts/stack.sh pull || echo "WARN: pull had errors; continuing with up"

if [[ "$BUILD_FLAG" == "1" ]]; then
  echo "Web: up -d --build (forced)"
  ./scripts/stack.sh up -d --build
else
  echo "Web: up -d (no --build; create FORCE-WEB-BUILD.txt to force)"
  ./scripts/stack.sh up -d
fi

echo "Waiting for database..."
for i in $(seq 1 90); do
  if docker exec supabase-db pg_isready -U postgres -h localhost >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

echo ""
echo "=== 5/5 Apply schema baseline ==="
MESA_SKIP_STACK_UP=1 ./scripts/apply-migrations.sh
./scripts/stack.sh up -d web

echo ""
echo "DONE (clean + install)."
echo "  Web:  http://127.0.0.1/setup   (edge :80 same-origin; not :3000)"
echo "  Pack: $PACK"
echo "  Stop: cd $ONPREM && ./scripts/stack.sh down"
echo "  Wipe: double-click START-WSL-TEST.cmd again (re-cleans then reinstalls)"
