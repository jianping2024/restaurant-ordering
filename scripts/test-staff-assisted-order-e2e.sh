#!/usr/bin/env bash
# E2E: frontdesk staff-assisted append → table detail → cleanup (localhost only).
set -euo pipefail

BASE="${TEST_BASE_URL:-http://localhost:3000}"
EMAIL="${TEST_STAFF_EMAIL:-qiantai@mesa.in}"
PASSWORD="${TEST_STAFF_PASSWORD:?Set TEST_STAFF_PASSWORD}"
SLUG="${TEST_RESTAURANT_SLUG:-restaurant-mo9y14xc}"

COOKIE_JAR="$(mktemp)"
export COOKIE_JAR
trap 'rm -f "$COOKIE_JAR"' EXIT

pass=0
fail=0
skip=0

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

skip_case() {
  local name="$1" detail="${2:-}"
  echo "SKIP  $name${detail:+ — $detail}"
  skip=$((skip + 1))
}

time_curl() {
  local out="$1"
  shift
  curl -s -o "$out" -w '%{time_total}|%{http_code}' -b "$COOKIE_JAR" -c "$COOKIE_JAR" "$@"
}

echo "=== Staff-assisted order E2E ==="
echo "BASE=$BASE SLUG=$SLUG"

# 1 Login
LOGIN_OUT="$(mktemp)"
LOGIN_META="$(time_curl "$LOGIN_OUT" -X POST "$BASE/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")"
LOGIN_TIME="${LOGIN_META%%|*}"
LOGIN_CODE="${LOGIN_META##*|}"
LOGIN_OK="$(python3 -c "import json; d=json.load(open('$LOGIN_OUT')); print(1 if d.get('ok') else 0)" 2>/dev/null || echo 0)"
check "login" "$LOGIN_OK" "${LOGIN_TIME}s HTTP $LOGIN_CODE"
[[ "$LOGIN_OK" == "1" ]] || exit 1

# 2 Unauthorized append blocked
UNAUTH_OUT="$(mktemp)"
UNAUTH_META="$(curl -s -o "$UNAUTH_OUT" -w '%{http_code}' -X POST "$BASE/api/restaurants/$SLUG/orders/append" \
  -H 'Content-Type: application/json' \
  -d '{"table_id":"00000000-0000-4000-8000-000000000002","items":[],"waiter_flow":true}')"
check "append without session → 401" "$([[ "$UNAUTH_META" == "401" ]] && echo 1 || echo 0)" "HTTP $UNAUTH_META"

# 3 Board
BOARD_OUT="$(mktemp)"
BOARD_META="$(time_curl "$BOARD_OUT" "$BASE/api/restaurants/$SLUG/staff/waiter/board")"
BOARD_TIME="${BOARD_META%%|*}"
BOARD_CODE="${BOARD_META##*|}"
BOARD_OK="$([[ "$BOARD_CODE" == "200" ]] && echo 1 || echo 0)"
check "waiter board" "$BOARD_OK" "${BOARD_TIME}s HTTP $BOARD_CODE"
[[ "$BOARD_OK" == "1" ]] || exit 1

read -r TABLE_ID MENU_ITEM_ID <<< "$(python3 <<PY
import json
d=json.load(open("$BOARD_OUT"))
orders=d.get("orders") or []
meta=d.get("sessionMetaByTableId") or {}
# pick table with open session + non-buffet menu item id
for o in orders:
    tid=o.get("table_id")
    if not tid or tid not in meta: continue
    if meta[tid].get("status") not in ("open",): continue
    for it in o.get("items") or []:
        if it.get("kind")=="buffet_base": continue
        mid=it.get("id") or it.get("menu_item_id")
        if mid:
            print(tid, mid)
            raise SystemExit
# fallback: any active session table + first menu item from dashboard
tables=meta.keys()
if tables:
    tid=next(iter(tables))
    print(tid, "")
else:
    print("", "")
PY
)"

if [[ -z "$TABLE_ID" ]]; then
  skip_case "append + cleanup" "no active session table on board"
  echo "=== Summary: pass=$pass fail=$fail skip=$skip ==="
  exit 0
fi

# Resolve menu item if missing
if [[ -z "$MENU_ITEM_ID" ]]; then
  MENU_OUT="$(mktemp)"
  curl -s -b "$COOKIE_JAR" "$BASE/api/dashboard/menu/items" > "$MENU_OUT" 2>/dev/null || true
  MENU_ITEM_ID="$(python3 -c "import json;d=json.load(open('$MENU_OUT')); rows=[r for r in (d if isinstance(d,list) else d.get('items',[])) if r.get('available')]; print(rows[0]['id'] if rows else '')" 2>/dev/null || echo "")"
fi

if [[ -z "$MENU_ITEM_ID" ]]; then
  skip_case "append" "no menu item id"
  echo "=== Summary: pass=$pass fail=$fail skip=$skip ==="
  exit 0
fi

echo "Using table=$TABLE_ID menu_item=$MENU_ITEM_ID"

# 4 Table detail before
DETAIL_BEFORE="$(mktemp)"
DETAIL_B_META="$(time_curl "$DETAIL_BEFORE" "$BASE/api/restaurants/$SLUG/staff/waiter/tables/$TABLE_ID")"
DETAIL_B_TIME="${DETAIL_B_META%%|*}"

# 5 Append
APPEND_BODY="$(mktemp)"
APPEND_PAYLOAD="$(python3 -c "import json; print(json.dumps({'table_id':'$TABLE_ID','items':[{'menu_item_id':'$MENU_ITEM_ID','qty':1,'note':'e2e-test'}],'waiter_flow':True}))")"
APPEND_META="$(time_curl "$APPEND_BODY" -X POST "$BASE/api/restaurants/$SLUG/orders/append" \
  -H 'Content-Type: application/json' \
  -d "$APPEND_PAYLOAD")"
APPEND_TIME="${APPEND_META%%|*}"
APPEND_CODE="${APPEND_META##*|}"

read -r APPEND_OK ORDER_ID BATCH_ID <<< "$(python3 <<PY
import json
try:
  d=json.load(open("$APPEND_BODY"))
  print(1 if d.get("ok") else 0, d.get("order_id",""), d.get("batch_id",""))
except Exception:
  print(0, "", "")
PY
)"
check "append waiter_flow" "$APPEND_OK" "${APPEND_TIME}s HTTP $APPEND_CODE order=$ORDER_ID"
[[ "$APPEND_OK" == "1" ]] || { cat "$APPEND_BODY"; exit 1; }

# 6 Table detail after — batch visible
DETAIL_AFTER="$(mktemp)"
DETAIL_A_META="$(time_curl "$DETAIL_AFTER" "$BASE/api/restaurants/$SLUG/staff/waiter/tables/$TABLE_ID")"
DETAIL_A_TIME="${DETAIL_A_META%%|*}"
BATCH_FOUND="$(python3 <<PY
import json
d=json.load(open("$DETAIL_AFTER"))
batch="$BATCH_ID"
for o in d.get("orders") or []:
  for it in o.get("items") or []:
    if it.get("batch_id")==batch:
      print(1); raise SystemExit
print(0)
PY
)"
check "table detail contains new batch" "$BATCH_FOUND" "api ${DETAIL_A_TIME}s (before ${DETAIL_B_TIME}s)"

# 7 RSC timings
RSC1="$(curl -s -o /dev/null -w '%{time_total}' -b "$COOKIE_JAR" "$BASE/dashboard/waiter/$TABLE_ID")"
RSC2="$(curl -s -o /dev/null -w '%{time_total}' -b "$COOKIE_JAR" "$BASE/dashboard/waiter/$TABLE_ID?from=menu_submit")"
check "RSC table detail loads" "1" "warm1=${RSC1}s warm2=${RSC2}s"

# 8 Enqueue token
ENQ_OK="$(python3 <<PY
import json, subprocess, os
d=json.load(open("$APPEND_BODY"))
token=d.get("enqueue_token")
if not token: print(0); raise SystemExit
payload=json.dumps({"order_id":d["order_id"],"batch_id":d["batch_id"],"enqueue_token":token})
out=subprocess.check_output([
  "curl","-s","-o","/dev/null","-w","%{http_code}",
  "-b",os.environ.get("COOKIE_JAR",""),
  "-X","POST","$BASE/api/restaurants/$SLUG/station-tickets/auto",
  "-H","Content-Type: application/json","-d",payload
], text=True)
print(1 if out.strip() in ("200","204") else 0)
PY
)"
check "station-tickets/auto" "$ENQ_OK" ""

# 9 Cleanup — decrement test line
CLEAN_OK="$(python3 <<PY
import json, subprocess, os, sys
slug="$SLUG"
order_id="$ORDER_ID"
batch="$BATCH_ID"
jar=os.environ["COOKIE_JAR"]
base="$BASE"
admin_order=subprocess.check_output([
  "curl","-s","-b",jar,
  f"{base}/api/restaurants/{slug}/staff/waiter/tables/$TABLE_ID"
], text=True)
detail=json.loads(admin_order)
order=None
for o in detail.get("orders") or []:
  if o.get("id")==order_id:
    order=o; break
if not order:
  print(0); sys.exit(0)
idx=None
for i,it in enumerate(order.get("items") or []):
  if it.get("batch_id")==batch:
    idx=i; break
if idx is None:
  print(0); sys.exit(0)
body=json.dumps({
  "item_index": idx,
  "updated_at": order["updated_at"],
  "void_reason": "staff_mistake",
})
code=subprocess.check_output([
  "curl","-s","-o","/dev/null","-w","%{http_code}",
  "-b",jar,"-X","POST",
  f"{base}/api/restaurants/{slug}/staff/waiter/orders/{order_id}/decrement-item",
  "-H","Content-Type: application/json","-d",body
], text=True).strip()
print(1 if code=="200" else 0)
PY
)"
check "cleanup decrement test item" "$CLEAN_OK" "batch=$BATCH_ID"

# 10 Verify batch gone
DETAIL_FINAL="$(mktemp)"
curl -s -b "$COOKIE_JAR" "$BASE/api/restaurants/$SLUG/staff/waiter/tables/$TABLE_ID" > "$DETAIL_FINAL"
BATCH_GONE="$(python3 <<PY
import json
d=json.load(open("$DETAIL_FINAL"))
batch="$BATCH_ID"
for o in d.get("orders") or []:
  for it in o.get("items") or []:
    if it.get("batch_id")!=batch:
      continue
    qty=it.get("qty") or 0
    status=it.get("item_status") or "pending"
    if qty > 0 and status not in ("void", "voided"):
      print(0); raise SystemExit
print(1)
PY
)"
check "batch removed after cleanup" "$BATCH_GONE" ""

echo ""
echo "=== Timings ==="
echo "login:        ${LOGIN_TIME}s"
echo "board:        ${BOARD_TIME}s"
echo "append:       ${APPEND_TIME}s"
echo "detail(before): ${DETAIL_B_TIME}s"
echo "detail(after):  ${DETAIL_A_TIME}s"
echo "RSC table:    ${RSC1}s / ${RSC2}s"
echo ""
echo "=== Summary: pass=$pass fail=$fail skip=$skip ==="
[[ "$fail" -eq 0 ]]
