#!/usr/bin/env bash
# Mode B / on-prem upgrade (step ⑦a).
# Flow: preflight → local backup → stage release → apply incremental migrations → rebuild web → health.
# Does NOT auto-upgrade Supabase vendor major versions (see images.lock).
set -euo pipefail

ONPREM_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SKIP_BACKUP=0
SKIP_BUILD=0
SOURCE=""

usage() {
  cat <<EOF
Usage: $0 [--SkipBackup] [--SkipBuild] <source-pack-dir>

  source-pack-dir  Unpacked mesa-on-prem-<ver>/ (has manifest.json + deploy/on-prem/)
                   or a deploy/on-prem tree itself.

Env:
  MESA_HOME     If set, stage under \$MESA_HOME/releases/<ver> and sync to current/
  BACKUP_ROOT   Passed through to backup-local.sh
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --SkipBackup) SKIP_BACKUP=1; shift ;;
    --SkipBuild) SKIP_BUILD=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *)
      if [[ -z "$SOURCE" ]]; then SOURCE=$1; shift
      else echo "Unexpected: $1" >&2; usage; exit 2
      fi
      ;;
  esac
done

if [[ -z "$SOURCE" || ! -d "$SOURCE" ]]; then
  usage
  exit 2
fi
SOURCE="$(cd "$SOURCE" && pwd)"

# Resolve pack root vs on-prem dir
SRC_ONPREM=""
MANIFEST=""
if [[ -f "$SOURCE/manifest.json" && -d "$SOURCE/deploy/on-prem" ]]; then
  SRC_ONPREM="$SOURCE/deploy/on-prem"
  MANIFEST="$SOURCE/manifest.json"
elif [[ -f "$SOURCE/compose.yaml" && -d "$SOURCE/scripts" ]]; then
  SRC_ONPREM="$SOURCE"
  if [[ -f "$SOURCE/../../manifest.json" ]]; then
    MANIFEST="$(cd "$SOURCE/../.." && pwd)/manifest.json"
  fi
else
  echo "Unrecognized source layout: $SOURCE" >&2
  exit 2
fi

if [[ -n "${MESA_HOME:-}" ]]; then
  TARGET_ONPREM="${MESA_HOME}/current/deploy/on-prem"
  LOG_DIR="${MESA_HOME}/logs"
  RELEASES="${MESA_HOME}/releases"
  CURRENT_JSON="${MESA_HOME}/config/current.json"
else
  TARGET_ONPREM="$ONPREM_DIR"
  LOG_DIR="${ONPREM_DIR}/logs"
  RELEASES="${ONPREM_DIR}/.releases"
  CURRENT_JSON="${ONPREM_DIR}/current.json"
fi
mkdir -p "$LOG_DIR" "$RELEASES"
LAST_UPGRADE="${LOG_DIR}/LAST_UPGRADE.json"

json_str() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

write_upgrade() {
  local status="$1"
  local phase="$2"
  local detail="$3"
  local migrations="${4:-false}"
  cat >"$LAST_UPGRADE" <<JSON
{
  "schemaVersion": 1,
  "status": "$(json_str "$status")",
  "phase": "$(json_str "$phase")",
  "detail": "$(json_str "$detail")",
  "migrationsApplied": ${migrations},
  "fromVersion": "$(json_str "${FROM_VERSION:-}")",
  "toVersion": "$(json_str "${TO_VERSION:-}")",
  "previousRelease": "$(json_str "${PREV_RELEASE:-}")",
  "finishedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
JSON
}

read_version_from_manifest() {
  local f="$1"
  if [[ -f "$f" ]] && command -v python3 >/dev/null 2>&1; then
    python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("version",""))' "$f" 2>/dev/null || true
  elif [[ -f "$f" ]]; then
    grep -E '"version"' "$f" | head -1 | sed 's/.*: *"\([^"]*\)".*/\1/' || true
  fi
}

migrations_head() {
  local dir="$1"
  ls -1 "$dir"/supabase/migrations/*.sql 2>/dev/null | xargs -n1 basename 2>/dev/null | sort | tail -1 || true
}

FROM_VERSION=""
PREV_RELEASE=""
if [[ -f "$CURRENT_JSON" ]]; then
  FROM_VERSION=$(read_version_from_manifest "$CURRENT_JSON")
  if command -v python3 >/dev/null 2>&1; then
    PREV_RELEASE=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("releaseDir") or "")' "$CURRENT_JSON" 2>/dev/null || true)
  fi
fi
TO_VERSION=$(read_version_from_manifest "$MANIFEST")
if [[ -z "$TO_VERSION" ]]; then
  TO_VERSION="$(date -u +%Y%m%dT%H%M%SZ)"
fi

MIGRATIONS_APPLIED=false

if [[ ! -f "${TARGET_ONPREM}/.env" ]]; then
  write_upgrade "failed" "preflight" "missing target .env — install first" "false"
  echo "Missing ${TARGET_ONPREM}/.env" >&2
  exit 1
fi

write_upgrade "running" "started" "upgrade begun" "false"
on_err() {
  write_upgrade "failed" "aborted" "upgrade aborted" "${MIGRATIONS_APPLIED}"
}
trap on_err ERR

if [[ "$SKIP_BACKUP" != "1" ]]; then
  write_upgrade "running" "backup" "running local backup" "false"
  echo "== backup =="
  if [[ -x "${TARGET_ONPREM}/scripts/backup-local.sh" ]]; then
    (cd "$TARGET_ONPREM" && MESA_HOME="${MESA_HOME:-}" ./scripts/backup-local.sh)
  else
    (cd "$ONPREM_DIR" && MESA_HOME="${MESA_HOME:-}" ./scripts/backup-local.sh)
  fi
fi

STAGE="${RELEASES}/${TO_VERSION}"
echo "== stage ${STAGE} =="
rm -rf "$STAGE"
mkdir -p "$STAGE"

if [[ -f "$SOURCE/manifest.json" ]]; then
  # Full pack: copy pack root essentials
  rsync -a --delete \
    --exclude '.env' \
    --exclude 'vendor/supabase-docker/volumes/db/data' \
    --exclude 'vendor/supabase-docker/volumes/storage' \
    --exclude 'backups' \
    --exclude 'data' \
    "$SOURCE/" "$STAGE/"
else
  mkdir -p "$STAGE/deploy"
  rsync -a --delete \
    --exclude '.env' \
    --exclude 'vendor/supabase-docker/volumes/db/data' \
    --exclude 'vendor/supabase-docker/volumes/storage' \
    --exclude 'backups' \
    "$SRC_ONPREM/" "$STAGE/deploy/on-prem/"
  cat >"$STAGE/manifest.json" <<EOF
{"name":"mesa-on-prem","version":"${TO_VERSION}","kind":"7a-upgrade-stage","createdAt":"$(date -u +%Y-%m-%dT%H:%M:%SZ)"}
EOF
fi

STAGED_ONPREM="$STAGE/deploy/on-prem"
if [[ ! -d "$STAGED_ONPREM" ]]; then
  write_upgrade "failed" "stage" "staged deploy/on-prem missing" "false"
  exit 1
fi

# Preserve live .env + durable license check-in state (claim writes platform.json here)
ENV_BAK=""
LICENSE_STATE_BAK=""
if [[ -f "${TARGET_ONPREM}/.env" ]]; then
  ENV_BAK=$(mktemp)
  cp "${TARGET_ONPREM}/.env" "$ENV_BAK"
fi
if [[ -d "${TARGET_ONPREM}/license-state" ]]; then
  LICENSE_STATE_BAK=$(mktemp -d)
  cp -a "${TARGET_ONPREM}/license-state/." "${LICENSE_STATE_BAK}/"
fi

echo "== sync staged → ${TARGET_ONPREM} =="
write_upgrade "running" "sync" "syncing release files" "false"
# Keep vendor volumes / data junctions intact: exclude volume data paths
rsync -a \
  --exclude '.env' \
  --exclude 'license-state' \
  --exclude 'vendor/supabase-docker/volumes/db/data' \
  --exclude 'vendor/supabase-docker/volumes/storage' \
  --exclude 'backups' \
  "${STAGED_ONPREM}/" "${TARGET_ONPREM}/"
if [[ -n "$ENV_BAK" ]]; then
  cp "$ENV_BAK" "${TARGET_ONPREM}/.env"
  rm -f "$ENV_BAK"
fi
mkdir -p "${TARGET_ONPREM}/license-state"
if [[ -n "$LICENSE_STATE_BAK" ]]; then
  cp -a "${LICENSE_STATE_BAK}/." "${TARGET_ONPREM}/license-state/"
  rm -rf "$LICENSE_STATE_BAK"
fi

# If pack includes apps/web, sync into MESA_HOME/current for image rebuild context
if [[ -n "${MESA_HOME:-}" && -d "$STAGE/apps/web" ]]; then
  mkdir -p "${MESA_HOME}/current/apps" "${MESA_HOME}/current/packages" "${MESA_HOME}/current/supabase"
  rsync -a --delete --exclude node_modules --exclude .next "$STAGE/apps/web/" "${MESA_HOME}/current/apps/web/"
  [[ -d "$STAGE/packages/shared" ]] && rsync -a --delete --exclude node_modules "$STAGE/packages/shared/" "${MESA_HOME}/current/packages/shared/"
  [[ -d "$STAGE/packages/ui" ]] && rsync -a --delete --exclude node_modules "$STAGE/packages/ui/" "${MESA_HOME}/current/packages/ui/"
  [[ -d "$STAGE/supabase/migrations" ]] && rsync -a --delete "$STAGE/supabase/migrations/" "${MESA_HOME}/current/supabase/migrations/"
  [[ -f "$STAGE/package.json" ]] && cp "$STAGE/package.json" "${MESA_HOME}/current/package.json"
  [[ -f "$STAGE/package-lock.json" ]] && cp "$STAGE/package-lock.json" "${MESA_HOME}/current/package-lock.json"
  # Dockerfile COPYs this for pinned print-agent download links (must be in build context).
  if [[ -f "$STAGE/apps/print-agent/VERSION" ]]; then
    mkdir -p "${MESA_HOME}/current/apps/print-agent"
    cp "$STAGE/apps/print-agent/VERSION" "${MESA_HOME}/current/apps/print-agent/VERSION"
  fi
  [[ -f "$STAGE/.dockerignore" ]] && cp "$STAGE/.dockerignore" "${MESA_HOME}/current/.dockerignore"
fi

cd "$TARGET_ONPREM"
export MESA_REPO_ROOT
if [[ -n "${MESA_HOME:-}" ]]; then
  export MESA_REPO_ROOT="${MESA_HOME}/current"
else
  export MESA_REPO_ROOT="$(cd "${TARGET_ONPREM}/../.." && pwd)"
fi

write_upgrade "running" "migrate" "applying incremental migrations" "false"
echo "== migrate =="
MESA_MIGRATE_INCREMENTAL_ONLY=1 ./scripts/apply-migrations.sh
MIGRATIONS_APPLIED=true
write_upgrade "running" "migrate" "migrations applied" "true"

write_upgrade "running" "stack" "bringing stack up" "true"
echo "== stack =="
# Bake pack version into web image + runtime (getWebAppBuildInfo /settings footer).
export MESA_WEB_VERSION="$TO_VERSION"
ENV_FILE="${TARGET_ONPREM}/.env"
if [[ -f "$ENV_FILE" ]]; then
  if grep -q '^MESA_WEB_VERSION=' "$ENV_FILE"; then
    if [[ "$(uname)" == "Darwin" ]]; then
      sed -i.bak -e "s|^MESA_WEB_VERSION=.*|MESA_WEB_VERSION=${TO_VERSION}|" "$ENV_FILE"
      rm -f "${ENV_FILE}.bak"
    else
      sed -i -e "s|^MESA_WEB_VERSION=.*|MESA_WEB_VERSION=${TO_VERSION}|" "$ENV_FILE"
    fi
  else
    printf 'MESA_WEB_VERSION=%s\n' "$TO_VERSION" >>"$ENV_FILE"
  fi
fi
./scripts/stack.sh up
if [[ "$SKIP_BUILD" != "1" ]]; then
  ./scripts/stack.sh up --build web
else
  ./scripts/stack.sh up web
fi

write_upgrade "running" "health" "waiting for health" "true"
echo "== health =="
ok=0
for i in $(seq 1 60); do
  if curl -sf "http://127.0.0.1:3000/api/health/live" >/dev/null 2>&1 \
    && curl -sf "http://127.0.0.1:3000/api/health/ready" >/dev/null 2>&1; then
    ok=1
    break
  fi
  sleep 3
done
if [[ "$ok" != "1" ]]; then
  write_upgrade "failed" "health" "health check failed after upgrade" "true"
  echo "Health check failed. migrationsApplied=true — use restore-local if needed." >&2
  exit 1
fi

MIG_HEAD=$(migrations_head "${MESA_REPO_ROOT}")
VENDOR_COMMIT=""
if [[ -f "${TARGET_ONPREM}/vendor/SUPABASE_DOCKER_VENDOR.md" ]]; then
  VENDOR_COMMIT=$(grep -E 'commit|Commit' "${TARGET_ONPREM}/vendor/SUPABASE_DOCKER_VENDOR.md" | head -1 | sed 's/.*\([0-9a-f]\{7,\}\).*/\1/' || true)
fi
PRINT_AGENT=""
if [[ -f "$MANIFEST" ]] && command -v python3 >/dev/null 2>&1; then
  PRINT_AGENT=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("printAgentMinVersion") or "")' "$MANIFEST" 2>/dev/null || true)
fi

cat >"$CURRENT_JSON" <<JSON
{
  "schemaVersion": 1,
  "version": "$(json_str "$TO_VERSION")",
  "releaseDir": "$(json_str "$STAGE")",
  "migrationsHead": "$(json_str "$MIG_HEAD")",
  "supabaseVendorCommit": "$(json_str "$VENDOR_COMMIT")",
  "printAgentMinVersion": "$(json_str "$PRINT_AGENT")",
  "updatedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "note": "Supabase vendor major upgrades are manual; this path upgrades Mesa web + incremental SQL."
}
JSON

trap - ERR
write_upgrade "ok" "done" "upgrade succeeded" "true"
echo "Upgrade OK → ${TO_VERSION}"
echo "CURRENT → ${CURRENT_JSON}"
echo "LAST_UPGRADE → ${LAST_UPGRADE}"
