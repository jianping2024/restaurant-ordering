#!/usr/bin/env bash
# Roll back Mesa web/files to previous release when migrations were NOT applied.
# If LAST_UPGRADE.migrationsApplied=true, refuse and point to restore-local / Restore-Mesa.
set -euo pipefail

ONPREM_DIR="$(cd "$(dirname "$0")/.." && pwd)"
FORCE=0

usage() {
  cat <<EOF
Usage: $0 [--Force]

  Restores files from previous releaseDir in current.json / LAST_UPGRADE.
  Refuses when migrations were already applied (use restore-local.sh --Force).
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --Force) FORCE=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unexpected: $1" >&2; usage; exit 2 ;;
  esac
done

if [[ -n "${MESA_HOME:-}" ]]; then
  TARGET_ONPREM="${MESA_HOME}/current/deploy/on-prem"
  LOG_DIR="${MESA_HOME}/logs"
  CURRENT_JSON="${MESA_HOME}/config/current.json"
else
  TARGET_ONPREM="$ONPREM_DIR"
  LOG_DIR="${ONPREM_DIR}/logs"
  CURRENT_JSON="${ONPREM_DIR}/current.json"
fi
LAST_UPGRADE="${LOG_DIR}/LAST_UPGRADE.json"

if [[ ! -f "$LAST_UPGRADE" ]]; then
  echo "No LAST_UPGRADE.json — nothing to roll back." >&2
  exit 1
fi

migrations_applied=false
prev=""
if command -v python3 >/dev/null 2>&1; then
  migrations_applied=$(python3 -c 'import json,sys; print(str(json.load(open(sys.argv[1])).get("migrationsApplied", False)).lower())' "$LAST_UPGRADE")
  prev=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("previousRelease") or "")' "$LAST_UPGRADE")
fi

if [[ "$migrations_applied" == "true" && "$FORCE" != "1" ]]; then
  cat <<EOF >&2
Refusing file rollback: migrations were already applied.
Database may not match older app files.
Use: ./scripts/restore-local.sh --Force <backup-snapshot>
  or Windows Restore-Mesa.ps1
Pass --Force only if you accept a file-only rollback (dangerous).
EOF
  exit 3
fi

if [[ -z "$prev" || ! -d "$prev/deploy/on-prem" ]]; then
  # Fall back to second-newest under releases/
  RELEASES="${MESA_HOME:-$ONPREM_DIR}/releases"
  [[ -n "${MESA_HOME:-}" ]] || RELEASES="${ONPREM_DIR}/.releases"
  prev=$(ls -1d "${RELEASES}"/* 2>/dev/null | sort | tail -2 | head -1 || true)
fi

if [[ -z "$prev" || ! -d "${prev}/deploy/on-prem" ]]; then
  echo "No previous release directory found." >&2
  exit 1
fi

echo "Rolling file tree back from ${prev}"
ENV_BAK=""
if [[ -f "${TARGET_ONPREM}/.env" ]]; then
  ENV_BAK=$(mktemp)
  cp "${TARGET_ONPREM}/.env" "$ENV_BAK"
fi

rsync -a \
  --exclude '.env' \
  --exclude 'vendor/supabase-docker/volumes/db/data' \
  --exclude 'vendor/supabase-docker/volumes/storage' \
  --exclude 'backups' \
  "${prev}/deploy/on-prem/" "${TARGET_ONPREM}/"

if [[ -n "$ENV_BAK" ]]; then
  cp "$ENV_BAK" "${TARGET_ONPREM}/.env"
  rm -f "$ENV_BAK"
fi

cd "$TARGET_ONPREM"
./scripts/stack.sh up --build web

ok=0
for i in $(seq 1 40); do
  if curl -sf "http://127.0.0.1:3000/api/health/live" >/dev/null 2>&1; then
    ok=1
    break
  fi
  sleep 3
done

cat >"$LAST_UPGRADE" <<JSON
{
  "schemaVersion": 1,
  "status": "$([[ "$ok" == "1" ]] && echo ok || echo failed)",
  "phase": "rollback",
  "detail": "file rollback from ${prev}",
  "migrationsApplied": ${migrations_applied},
  "finishedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
JSON

if [[ "$ok" != "1" ]]; then
  echo "Rollback health check failed." >&2
  exit 1
fi
echo "Rollback OK (files). Confirm DB still matches this app version."
