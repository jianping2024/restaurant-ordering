#!/usr/bin/env bash
# Mesa on-prem daily cutover (sole store-side daily job):
#   1) nightly_close  → GET /api/cron/nightly-close-sessions?policy=always
#   2) local_backup   → scripts/backup-local.sh
# Scheduled by mesa-daily-cutover.timer (Europe/Lisbon ~05:05).
# policy=always: caller owns schedule (timer + manual systemctl start); skip Lisbon due gate.
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
CLOSE_BODY="/tmp/mesa-cutover-close.json"

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
CLOSE_URL="${BASE_URL}/api/cron/nightly-close-sessions?policy=always"

echo "Phase 1: nightly_close → ${CLOSE_URL}"
if curl -fsS "${auth_hdr[@]}" "$CLOSE_URL" -o "$CLOSE_BODY"; then
  # Prefer python for JSON; fall back to grep if unavailable.
  if command -v python3 >/dev/null 2>&1; then
    PARSE=$(python3 - "$CLOSE_BODY" <<'PY'
import json, sys
path = sys.argv[1]
with open(path, encoding="utf-8") as f:
    d = json.load(f)
ok = bool(d.get("ok"))
skipped = bool(d.get("skipped"))
closed = d.get("closedCount")
err = d.get("error") or d.get("reason") or ""
if not ok:
    print(f"failed\t{err or 'ok_false'}")
elif skipped:
    print(f"skipped\t{err or 'skipped'}")
else:
    print(f"ok\tclosedCount={closed if closed is not None else '?'}")
PY
)
    CLOSE_STATUS="${PARSE%%$'\t'*}"
    DETAIL="${PARSE#*$'\t'}"
  else
    if grep -q '"skipped"[[:space:]]*:[[:space:]]*true' "$CLOSE_BODY"; then
      CLOSE_STATUS="skipped"
      DETAIL="skipped_without_python"
    elif grep -q '"ok"[[:space:]]*:[[:space:]]*true' "$CLOSE_BODY"; then
      CLOSE_STATUS="ok"
      DETAIL="ok_grep"
    else
      CLOSE_STATUS="failed"
      DETAIL="parse_failed"
    fi
  fi
else
  CLOSE_STATUS="failed"
  DETAIL="nightly_close_http_failed"
fi

echo "Phase 1 result: nightlyClose=${CLOSE_STATUS} detail=${DETAIL}"

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

if [[ "$CLOSE_STATUS" != "ok" ]]; then
  exit 1
fi
exit 0
