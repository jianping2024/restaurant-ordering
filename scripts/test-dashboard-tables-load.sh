#!/usr/bin/env bash
# Verify /dashboard/tables data path and table QR helpers (localhost / cloud).
set -euo pipefail

BASE="${TEST_BASE_URL:-http://localhost:3000}"
EMAIL="${TEST_STAFF_EMAIL:-qiantai@mesa.in}"
PASSWORD="${TEST_STAFF_PASSWORD:?Set TEST_STAFF_PASSWORD}"

COOKIE_JAR="$(mktemp)"
export COOKIE_JAR
trap 'rm -f "$COOKIE_JAR"' EXIT

pass=0
fail=0

check() {
  local name="$1" ok="$2" detail="${3:-}"
  if [[ "$ok" == "1" ]]; then
    echo "PASS  $name${detail:+ — $detail}"
    pass=$((pass + 1))
  else
    echo "FAIL  $name${detail:+ — $detail}"
    fail=$((fail + 1))
  fi
}

echo "=== Dashboard tables load ==="
echo "BASE=$BASE"

LOGIN_OUT="$(mktemp)"
LOGIN_CODE="$(curl -s -o "$LOGIN_OUT" -w '%{http_code}' -c "$COOKIE_JAR" -b "$COOKIE_JAR" \
  -X POST "$BASE/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")"
LOGIN_OK="$(python3 -c "import json; d=json.load(open('$LOGIN_OUT')); print(1 if d.get('ok') else 0)" 2>/dev/null || echo 0)"
check "frontdesk login" "$LOGIN_OK" "HTTP $LOGIN_CODE"
[[ "$LOGIN_OK" == "1" ]] || exit 1

PAGE_START="$(python3 -c 'import time; print(time.time())')"
PAGE_CODE="$(curl -s -o /tmp/dashboard-tables.html -w '%{http_code}' -b "$COOKIE_JAR" "$BASE/dashboard/tables")"
PAGE_END="$(python3 -c 'import time; print(time.time())')"
PAGE_MS="$(python3 -c "print(int(($PAGE_END - $PAGE_START) * 1000))")"
PAGE_OK="$([[ "$PAGE_CODE" == "200" ]] && echo 1 || echo 0)"
check "GET /dashboard/tables" "$PAGE_OK" "${PAGE_MS}ms HTTP $PAGE_CODE"

API_START="$(python3 -c 'import time; print(time.time())')"
API_CODE="$(curl -s -o /tmp/dashboard-tables-api.json -w '%{http_code}' -b "$COOKIE_JAR" \
  -X POST "$BASE/api/dashboard/tables" \
  -H 'Content-Type: application/json' \
  -d '{"count":0}' )"
API_END="$(python3 -c 'import time; print(time.time())')"
# count:0 should 400 — proves route + auth work without mutating
API_OK="$([[ "$API_CODE" == "400" ]] && echo 1 || echo 0)"
check "POST /api/dashboard/tables auth (invalid count → 400)" "$API_OK" "HTTP $API_CODE"

GROUPS_CODE="$(curl -s -o /dev/null -w '%{http_code}' -b "$COOKIE_JAR" "$BASE/dashboard/tables?tab=groups")"
GROUPS_OK="$([[ "$GROUPS_CODE" == "200" ]] && echo 1 || echo 0)"
check "GET /dashboard/tables?tab=groups" "$GROUPS_OK" "HTTP $GROUPS_CODE"

echo "=== Summary: pass=$pass fail=$fail ==="
[[ "$fail" -eq 0 ]]
