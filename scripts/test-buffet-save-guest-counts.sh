#!/usr/bin/env bash
# Manual verification: buffet open / save guest counts (localhost staff API).
set -euo pipefail

BASE="${TEST_BASE_URL:-http://localhost:3000}"
EMAIL="${TEST_STAFF_EMAIL:-qiantai@mesa.in}"
PASSWORD="${TEST_STAFF_PASSWORD:?Set TEST_STAFF_PASSWORD}"
SLUG="${TEST_RESTAURANT_SLUG:-restaurant-mo9y14xc}"

COOKIE_JAR="$(mktemp)"
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

time_post_buffet() {
  local body_file="$1"
  curl -s -o /tmp/buffet-resp.json -w '%{time_total}|%{http_code}' \
    -b "$COOKIE_JAR" -c "$COOKIE_JAR" \
    -X POST "$BASE/api/restaurants/$SLUG/staff/waiter/buffet" \
    -H 'Content-Type: application/json' \
    -d @"$body_file"
}

echo "=== Buffet save guest counts ==="
echo "BASE=$BASE SLUG=$SLUG"

LOGIN_OUT="$(mktemp)"
LOGIN_CODE="$(curl -s -o "$LOGIN_OUT" -w '%{http_code}' -b "$COOKIE_JAR" -c "$COOKIE_JAR" \
  -X POST "$BASE/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")"
LOGIN_OK="$(python3 -c "import json; d=json.load(open('$LOGIN_OUT')); print(1 if d.get('ok') else 0)" 2>/dev/null || echo 0)"
check "staff login" "$LOGIN_OK" "HTTP $LOGIN_CODE"
[[ "$LOGIN_OK" == "1" ]] || exit 1

BOARD_OUT="$(mktemp)"
curl -s -o "$BOARD_OUT" -b "$COOKIE_JAR" \
  "$BASE/api/restaurants/$SLUG/staff/waiter/board" >/dev/null

read -r TABLE_ID ADULTS CHILDREN BUFFET_ID <<< "$(python3 <<PY
import json
from pathlib import Path

board = json.loads(Path("$BOARD_OUT").read_text())
orders = board.get("orders") or []
meta = board.get("sessionMetaByTableId") or {}

def buffet_agg(items):
    for it in reversed(items or []):
        if it.get("kind") == "buffet_base" and it.get("item_status") != "voided":
            return it
    return None

for o in orders:
    tid = o.get("table_id")
    if not tid or tid not in meta:
        continue
    if meta[tid].get("status") != "open":
        continue
    line = buffet_agg(o.get("items"))
    if not line:
        continue
    print(tid, line.get("adult_count", 0), line.get("child_count", 0), line.get("buffet_id", ""))
    break
else:
    print("", "", "", "")
PY
)"

if [[ -z "$TABLE_ID" ]]; then
  echo "SKIP  no occupied buffet table on board — open a table first"
  exit 0
fi

echo "Table=$TABLE_ID buffet=$BUFFET_ID counts=A${ADULTS} C${CHILDREN}"

# 1 Unchanged (server should return unchanged: true, fast)
UNCHANGED_BODY="$(mktemp)"
python3 -c "import json; print(json.dumps({'table_id':'$TABLE_ID','buffet_id':'$BUFFET_ID','adult_count':$ADULTS,'child_count':$CHILDREN}))" > "$UNCHANGED_BODY"
META="$(time_post_buffet "$UNCHANGED_BODY")"
TIME="${META%%|*}"
CODE="${META##*|}"
UNCHANGED_FLAG="$(python3 -c "import json; d=json.load(open('/tmp/buffet-resp.json')); print(1 if d.get('unchanged') and d.get('ok') else 0)" 2>/dev/null || echo 0)"
check "unchanged save (no write)" "$([[ "$CODE" == "200" && "$UNCHANGED_FLAG" == "1" ]] && echo 1 || echo 0)" "${TIME}s HTTP $CODE"

# 2 Save with +1 adult then revert
NEW_ADULTS=$((ADULTS + 1))
SAVE_BODY="$(mktemp)"
python3 -c "import json; print(json.dumps({'table_id':'$TABLE_ID','buffet_id':'$BUFFET_ID','adult_count':$NEW_ADULTS,'child_count':$CHILDREN}))" > "$SAVE_BODY"
META="$(time_post_buffet "$SAVE_BODY")"
TIME="${META%%|*}"
CODE="${META##*|}"
SAVE_OK="$(python3 -c "
import json
d=json.load(open('/tmp/buffet-resp.json'))
m=d.get('model') or {}
orders=(m.get('detail') or {}).get('orders') or []
for o in orders:
  for it in o.get('items') or []:
    if it.get('kind')=='buffet_base' and it.get('item_status')!='voided':
      import sys
      sys.exit(0 if it.get('adult_count')==$NEW_ADULTS else 1)
import sys
sys.exit(1)
" 2>/dev/null && echo 1 || echo 0)"
check "save +1 adult" "$([[ "$CODE" == "200" && "$SAVE_OK" == "1" ]] && echo 1 || echo 0)" "${TIME}s HTTP $CODE"

# 3 Revert
python3 -c "import json; print(json.dumps({'table_id':'$TABLE_ID','buffet_id':'$BUFFET_ID','adult_count':$ADULTS,'child_count':$CHILDREN}))" > "$SAVE_BODY"
META="$(time_post_buffet "$SAVE_BODY")"
TIME="${META%%|*}"
CODE="${META##*|}"
check "revert guest counts (cleanup)" "$([[ "$CODE" == "200" ]] && echo 1 || echo 0)" "${TIME}s HTTP $CODE"

echo "---"
echo "Results: $pass passed, $fail failed"
exit "$([[ $fail -eq 0 ]] && echo 0 || echo 1)"
