#!/usr/bin/env bash
# Mesa on-prem daily cutover (sole store-side daily job):
#   1) nightly_close  → GET /api/cron/nightly-close-sessions
#   2) local_backup   → scripts/backup-local.sh
# Scheduled by mesa-daily-cutover.timer (Europe/Lisbon ~05:05).
set -euo pipefail

ONPREM_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ONPREM_DIR"

if [[ -n "${MESA_HOME:-}" ]]; then
  RESULT_DIR="${MESA_HOME}/logs"
  ENV_FILE="${ONPREM_DIR}/.env"
  [[ -f "${MESA_HOME}/current/deploy/on-prem/.env" ]] && ENV_FILE="${MESA_HOME}/current/deploy/on-prem/.env"
else
  RESULT_DIR="${ONPREM_DIR}/logs"
  ENV_FILE="${ONPREM_DIR}/.env"
fi
mkdir -p "$RESULT_DIR"
RESULT_FILE="${RESULT_DIR}/LAST_DAILY_CUTOVER.json"

BASE_URL="${MESA_CUTOVER_BASE_URL:-}"
if [[ -z "$BASE_URL" && -f "$ENV_FILE" ]]; then
  BASE_URL=$(grep -E '^NEXT_PUBLIC_BASE_URL=' "$ENV_FILE" | head -1 | cut -d= -f2- || true)
fi
BASE_URL="${BASE_URL:-http://127.0.0.1}"
BASE_URL="${BASE_URL%/}"

CRON_SECRET="${CRON_SECRET:-}"
if [[ -z "$CRON_SECRET" && -f "$ENV_FILE" ]]; then
  CRON_SECRET=$(grep -E '^CRON_SECRET=' "$ENV_FILE" | head -1 | cut -d= -f2- || true)
fi

json_str() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

write_result() {
  cat >"$RESULT_FILE" <<JSON
{
  "schemaVersion": 1,
  "finishedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "nightlyClose": "$(json_str "$1")",
  "localBackup": "$(json_str "$2")",
  "detail": "$(json_str "$3")"
}
JSON
}

CLOSE_STATUS="skipped"
BACKUP_STATUS="skipped"
DETAIL="ok"

if [[ -z "$CRON_SECRET" ]]; then
  write_result "failed" "skipped" "CRON_SECRET missing"
  echo "CRON_SECRET missing — abort cutover" >&2
  exit 1
fi

auth_hdr=(-H "Authorization: Bearer ${CRON_SECRET}")

echo "Phase 1: nightly_close → ${BASE_URL}/api/cron/nightly-close-sessions"
if curl -fsS "${auth_hdr[@]}" "${BASE_URL}/api/cron/nightly-close-sessions" -o /tmp/mesa-cutover-close.json; then
  CLOSE_STATUS="ok"
else
  CLOSE_STATUS="failed"
  DETAIL="nightly_close_http_failed"
fi

echo "Phase 2: local_backup"
export MESA_HOME="${MESA_HOME:-}"
if [[ -x "${ONPREM_DIR}/scripts/backup-local.sh" ]]; then
  if BACKUP_ROOT="${MESA_HOME:+${MESA_HOME}/backups}" "${ONPREM_DIR}/scripts/backup-local.sh"; then
    BACKUP_STATUS="ok"
  else
    BACKUP_STATUS="failed"
    DETAIL="${DETAIL};local_backup_failed"
  fi
else
  BACKUP_STATUS="skipped"
  DETAIL="${DETAIL};backup_script_missing"
fi

write_result "$CLOSE_STATUS" "$BACKUP_STATUS" "$DETAIL"
echo "LAST_DAILY_CUTOVER → ${RESULT_FILE}"

if [[ "$CLOSE_STATUS" == "failed" ]]; then
  exit 1
fi
exit 0
