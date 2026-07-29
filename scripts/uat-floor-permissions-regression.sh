#!/usr/bin/env bash
# Floor mutation + permission regression (local). Usage: bash scripts/uat-floor-permissions-regression.sh
set -euo pipefail
BASE="${BASE_URL:-http://localhost:3000}"
SLUG="restaurant-mohnrib5"
RESTAURANT_ID="88064a0b-1d36-4633-aa21-c928039e4f57"
DB_CONTAINER="${SUPABASE_DB_CONTAINER:-supabase_db_restaurant-ordering}"
PASS=0
FAIL=0

pass() { echo "PASS  $1"; PASS=$((PASS + 1)); }
fail() { echo "FAIL  $1 — $2"; FAIL=$((FAIL + 1)); }

psql_q() {
  docker exec -i "$DB_CONTAINER" psql -U postgres -At -F $'\t' -c "$1"
}

ensure_open() {
  local table_id=$1
  psql_q "INSERT INTO table_sessions (restaurant_id, table_id, status, opened_by_user_id)
    SELECT '$RESTAURANT_ID', '$table_id'::uuid, 'open', '$USER_ID'::uuid
    WHERE NOT EXISTS (
      SELECT 1 FROM table_sessions WHERE table_id='$table_id'::uuid AND status IN ('open','billing')
    );" >/dev/null
}

ensure_idle() {
  local table_id=$1
  psql_q "UPDATE table_sessions
    SET status='closed', closed_at=now()
    WHERE table_id='$table_id'::uuid AND status IN ('open','billing');" >/dev/null
}

login() {
  local jar=$1 account=$2 password=$3
  curl -sS -c "$jar" -X POST "$BASE/api/auth/login" \
    -H 'Content-Type: application/json' \
    -d "{\"account\":\"$account\",\"password\":\"$password\"}" >/dev/null
}

http_code() {
  local jar=$1 method=$2 url=$3 body=${4:-}
  if [ -n "$body" ]; then
    curl -sS -b "$jar" -o /tmp/uat-body.json -w '%{http_code}' -X "$method" "$BASE$url" \
      -H 'Content-Type: application/json' -d "$body"
  else
    curl -sS -b "$jar" -o /tmp/uat-body.json -w '%{http_code}' -X "$method" "$BASE$url"
  fi
}

assert_code() {
  local name=$1 exp=$2 got=$3
  if [ "$exp" = "$got" ]; then pass "$name"; else fail "$name" "expected $exp got $got body=$(cat /tmp/uat-body.json 2>/dev/null | head -c 200)"; fi
}

echo "=== Setup: pick idle tables ==="
TABLES=$(psql_q "SELECT t.id::text FROM restaurant_tables t
  WHERE t.restaurant_id = '$RESTAURANT_ID' AND t.deleted_at IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM table_sessions ts
      WHERE ts.table_id = t.id AND ts.status IN ('open','billing')
    )
  ORDER BY t.sort_order LIMIT 4;")

FROM_TABLE=$(echo "$TABLES" | sed -n '1p')
TO_TABLE=$(echo "$TABLES" | sed -n '2p')
MERGE_TARGET=$(echo "$TABLES" | sed -n '3p')
CLOSE_TABLE=$(echo "$TABLES" | sed -n '4p')

if [ -z "$FROM_TABLE" ] || [ -z "$TO_TABLE" ] || [ -z "$MERGE_TARGET" ] || [ -z "$CLOSE_TABLE" ]; then
  echo "FAIL setup — need at least 4 idle tables"
  exit 1
fi

USER_ID=$(psql_q "SELECT user_id::text FROM restaurant_staff_accounts WHERE login_name='dianzhan' LIMIT 1;")
echo "FROM=$FROM_TABLE TO=$TO_TABLE MERGE=$MERGE_TARGET CLOSE=$CLOSE_TABLE"

echo "=== Logins ==="
STORE_JAR=$(mktemp)
FRONT_JAR=$(mktemp)
CASH_JAR=$(mktemp)
WAIT_JAR=$(mktemp)
KITCHEN_JAR=$(mktemp)
ADMIN_JAR=$(mktemp)
login "$STORE_JAR" "dianzhan" "123456"
login "$FRONT_JAR" "qiantai1" "123456"
login "$CASH_JAR" "shouyinyuan1" "123456"
login "$WAIT_JAR" "fuwuyuan1" "123456"
login "$ADMIN_JAR" "baiyun@gmail.com" "123456"

CREATE=$(curl -sS -b "$ADMIN_JAR" -X POST "$BASE/api/dashboard/staff" -H 'Content-Type: application/json' \
  -d '{"display_name":"UAT厨房FM","login_name":"kitchen_fm_uat","role":"kitchen","password":"123456"}')
KITCHEN_ID=$(echo "$CREATE" | python3 -c "import json,sys; print(json.load(sys.stdin).get('staff',{}).get('id',''))" 2>/dev/null || true)
login "$KITCHEN_JAR" "kitchen_fm_uat" "123456"

ACTION="/api/restaurants/$SLUG/staff/waiter/tables/action"
TARGETS="/api/restaurants/$SLUG/staff/waiter/tables/$FROM_TABLE/action-targets"

echo "=== Transfer/merge permission gate (action-targets, no mutation) ==="
ensure_open "$FROM_TABLE"
assert_code "store_owner transfer targets" 200 "$(http_code "$STORE_JAR" GET "$TARGETS?operation=transfer")"
assert_code "frontdesk transfer targets" 200 "$(http_code "$FRONT_JAR" GET "$TARGETS?operation=transfer")"
assert_code "cashier transfer targets" 200 "$(http_code "$CASH_JAR" GET "$TARGETS?operation=transfer")"
assert_code "waiter transfer targets" 200 "$(http_code "$WAIT_JAR" GET "$TARGETS?operation=transfer")"
assert_code "kitchen transfer targets blocked" 401 "$(http_code "$KITCHEN_JAR" GET "$TARGETS?operation=transfer")"
assert_code "store_owner merge targets" 200 "$(http_code "$STORE_JAR" GET "$TARGETS?operation=merge")"
assert_code "kitchen merge targets blocked" 401 "$(http_code "$KITCHEN_JAR" GET "$TARGETS?operation=merge")"

echo "=== Transfer mutation by role ==="
BODY_TRANSFER=$(python3 -c "import json; print(json.dumps({'action':'transfer','from_table_id':'$FROM_TABLE','to_table_id':'$TO_TABLE'}))")

ensure_idle "$FROM_TABLE"; ensure_idle "$TO_TABLE"; ensure_open "$FROM_TABLE"
assert_code "store_owner transfer" 200 "$(http_code "$STORE_JAR" POST "$ACTION" "$BODY_TRANSFER")"

ensure_idle "$FROM_TABLE"; ensure_idle "$TO_TABLE"; ensure_open "$FROM_TABLE"
assert_code "frontdesk transfer" 200 "$(http_code "$FRONT_JAR" POST "$ACTION" "$BODY_TRANSFER")"

ensure_idle "$FROM_TABLE"; ensure_idle "$TO_TABLE"; ensure_open "$FROM_TABLE"
assert_code "cashier transfer" 200 "$(http_code "$CASH_JAR" POST "$ACTION" "$BODY_TRANSFER")"

ensure_idle "$FROM_TABLE"; ensure_idle "$TO_TABLE"; ensure_open "$FROM_TABLE"
assert_code "waiter transfer" 200 "$(http_code "$WAIT_JAR" POST "$ACTION" "$BODY_TRANSFER")"

ensure_idle "$FROM_TABLE"; ensure_idle "$TO_TABLE"; ensure_open "$FROM_TABLE"
assert_code "kitchen transfer blocked" 401 "$(http_code "$KITCHEN_JAR" POST "$ACTION" "$BODY_TRANSFER")"

echo "=== Merge mutation by role ==="
BODY_MERGE=$(python3 -c "import json; print(json.dumps({'action':'merge','from_table_id':'$FROM_TABLE','to_table_id':'$MERGE_TARGET'}))")

ensure_idle "$FROM_TABLE"; ensure_idle "$MERGE_TARGET"; ensure_open "$FROM_TABLE"; ensure_open "$MERGE_TARGET"
assert_code "store_owner merge" 200 "$(http_code "$STORE_JAR" POST "$ACTION" "$BODY_MERGE")"

ensure_idle "$FROM_TABLE"; ensure_idle "$MERGE_TARGET"; ensure_open "$FROM_TABLE"; ensure_open "$MERGE_TARGET"
assert_code "frontdesk merge" 200 "$(http_code "$FRONT_JAR" POST "$ACTION" "$BODY_MERGE")"

ensure_idle "$FROM_TABLE"; ensure_idle "$MERGE_TARGET"; ensure_open "$FROM_TABLE"; ensure_open "$MERGE_TARGET"
assert_code "cashier merge" 200 "$(http_code "$CASH_JAR" POST "$ACTION" "$BODY_MERGE")"

ensure_idle "$FROM_TABLE"; ensure_idle "$MERGE_TARGET"; ensure_open "$FROM_TABLE"; ensure_open "$MERGE_TARGET"
assert_code "waiter merge" 200 "$(http_code "$WAIT_JAR" POST "$ACTION" "$BODY_MERGE")"

ensure_idle "$FROM_TABLE"; ensure_idle "$MERGE_TARGET"; ensure_open "$FROM_TABLE"; ensure_open "$MERGE_TARGET"
assert_code "kitchen merge blocked" 401 "$(http_code "$KITCHEN_JAR" POST "$ACTION" "$BODY_MERGE")"

echo "=== Force-close / unpaid close by role ==="
FORCE_BODY=$(python3 -c "import json; print(json.dumps({'table_id':'$CLOSE_TABLE','confirm_close':True,'close_reason':'owner_approved'}))")

ensure_idle "$CLOSE_TABLE"; ensure_open "$CLOSE_TABLE"
FORCE_CODE=$(http_code "$STORE_JAR" POST "/api/dashboard/close-table-session" "$FORCE_BODY")
if [ "$FORCE_CODE" = "200" ]; then
  REASON=$(psql_q "SELECT closed_reason FROM table_sessions WHERE table_id='$CLOSE_TABLE'::uuid ORDER BY closed_at DESC NULLS LAST LIMIT 1;")
  if [ "$REASON" = "owner_forced" ]; then
    pass "store_owner force-close owner_forced"
  else
    fail "store_owner force-close owner_forced" "closed_reason=$REASON body=$(cat /tmp/uat-body.json | head -c 200)"
  fi
else
  fail "store_owner force-close" "HTTP $FORCE_CODE $(cat /tmp/uat-body.json | head -c 200)"
fi

ensure_idle "$CLOSE_TABLE"; ensure_open "$CLOSE_TABLE"
FRONT_FORCE=$(http_code "$FRONT_JAR" POST "/api/dashboard/close-table-session" "$FORCE_BODY")
if [ "$FRONT_FORCE" = "200" ]; then
  REASON=$(psql_q "SELECT closed_reason FROM table_sessions WHERE table_id='$CLOSE_TABLE'::uuid ORDER BY closed_at DESC NULLS LAST LIMIT 1;")
  if [ "$REASON" = "frontdesk_forced" ]; then
    pass "frontdesk force-close frontdesk_forced"
  else
    fail "frontdesk force-close frontdesk_forced" "closed_reason=$REASON"
  fi
else
  fail "frontdesk force-close" "HTTP $FRONT_FORCE $(cat /tmp/uat-body.json | head -c 200)"
fi

ensure_idle "$CLOSE_TABLE"; ensure_open "$CLOSE_TABLE"
CASH_FORCE=$(http_code "$CASH_JAR" POST "/api/dashboard/close-table-session" "$FORCE_BODY")
if [ "$CASH_FORCE" = "401" ] || [ "$CASH_FORCE" = "403" ]; then
  pass "cashier force-close blocked"
else
  fail "cashier force-close blocked" "expected 401/403 got $CASH_FORCE body=$(cat /tmp/uat-body.json | head -c 200)"
fi

WAIT_FORCE=$(http_code "$WAIT_JAR" POST "/api/dashboard/close-table-session" "$FORCE_BODY")
if [ "$WAIT_FORCE" = "401" ] || [ "$WAIT_FORCE" = "403" ]; then
  pass "waiter force-close blocked"
else
  fail "waiter force-close blocked" "expected 401/403 got $WAIT_FORCE"
fi

KITCHEN_FORCE=$(http_code "$KITCHEN_JAR" POST "/api/dashboard/close-table-session" "$FORCE_BODY")
if [ "$KITCHEN_FORCE" = "401" ] || [ "$KITCHEN_FORCE" = "403" ]; then
  pass "kitchen force-close blocked"
else
  fail "kitchen force-close blocked" "expected 401/403 got $KITCHEN_FORCE"
fi

echo "=== Checkout close regression ==="
ensure_idle "$CLOSE_TABLE"; ensure_open "$CLOSE_TABLE"
CLOSE_BODY=$(python3 -c "import json; print(json.dumps({'table_id':'$CLOSE_TABLE'}))")
CLOSE_CODE=$(http_code "$STORE_JAR" POST "/api/dashboard/checkout-close-table-session" "$CLOSE_BODY")
if [ "$CLOSE_CODE" = "200" ] || [ "$CLOSE_CODE" = "201" ]; then
  pass "store_owner checkout-close"
else
  fail "store_owner checkout-close" "HTTP $CLOSE_CODE $(cat /tmp/uat-body.json | head -c 200)"
fi
KITCHEN_CLOSE=$(http_code "$KITCHEN_JAR" POST "/api/dashboard/checkout-close-table-session" "$CLOSE_BODY")
if [ "$KITCHEN_CLOSE" = "401" ] || [ "$KITCHEN_CLOSE" = "403" ]; then
  pass "kitchen checkout-close blocked"
else
  fail "kitchen checkout-close blocked" "expected 401/403 got $KITCHEN_CLOSE"
fi

echo "=== Settings API matrix ==="
assert_code "backend_admin staff API" 200 "$(http_code "$ADMIN_JAR" GET /api/dashboard/staff)"
assert_code "backend_admin features API" 200 "$(http_code "$ADMIN_JAR" GET /api/restaurant/features)"
assert_code "backend_admin roles API" 200 "$(http_code "$ADMIN_JAR" GET /api/dashboard/roles)"
assert_code "backend_admin buffet API" 200 "$(http_code "$ADMIN_JAR" GET /api/dashboard/buffet)"
assert_code "backend_admin profile PATCH gate" 400 "$(http_code "$ADMIN_JAR" PATCH /api/restaurant/settings)"

assert_code "store_owner staff API" 200 "$(http_code "$STORE_JAR" GET /api/dashboard/staff)"
assert_code "store_owner features API" 403 "$(http_code "$STORE_JAR" GET /api/restaurant/features)"
assert_code "store_owner roles API" 403 "$(http_code "$STORE_JAR" GET /api/dashboard/roles)"
assert_code "store_owner buffet API" 403 "$(http_code "$STORE_JAR" GET /api/dashboard/buffet)"
assert_code "store_owner profile PATCH gate" 400 "$(http_code "$STORE_JAR" PATCH /api/restaurant/settings)"

assert_code "frontdesk staff API" 403 "$(http_code "$FRONT_JAR" GET /api/dashboard/staff)"
assert_code "frontdesk features API" 403 "$(http_code "$FRONT_JAR" GET /api/restaurant/features)"
assert_code "frontdesk roles API" 403 "$(http_code "$FRONT_JAR" GET /api/dashboard/roles)"
assert_code "frontdesk buffet API" 403 "$(http_code "$FRONT_JAR" GET /api/dashboard/buffet)"
assert_code "frontdesk profile PATCH gate" 403 "$(http_code "$FRONT_JAR" PATCH /api/restaurant/settings)"

assert_code "cashier staff API" 403 "$(http_code "$CASH_JAR" GET /api/dashboard/staff)"
assert_code "cashier features API" 403 "$(http_code "$CASH_JAR" GET /api/restaurant/features)"
assert_code "cashier roles API" 403 "$(http_code "$CASH_JAR" GET /api/dashboard/roles)"
assert_code "cashier buffet API" 403 "$(http_code "$CASH_JAR" GET /api/dashboard/buffet)"
assert_code "cashier profile PATCH gate" 403 "$(http_code "$CASH_JAR" PATCH /api/restaurant/settings)"

assert_code "waiter staff API" 403 "$(http_code "$WAIT_JAR" GET /api/dashboard/staff)"
assert_code "waiter features API" 403 "$(http_code "$WAIT_JAR" GET /api/restaurant/features)"
assert_code "waiter roles API" 403 "$(http_code "$WAIT_JAR" GET /api/dashboard/roles)"
assert_code "waiter buffet API" 403 "$(http_code "$WAIT_JAR" GET /api/dashboard/buffet)"
assert_code "waiter profile PATCH gate" 403 "$(http_code "$WAIT_JAR" PATCH /api/restaurant/settings)"

echo "=== Dashboard pages store_owner ==="
for path in /dashboard /dashboard/orders /dashboard/tables /dashboard/menu /dashboard/waiter /dashboard/settings; do
  assert_code "store_owner GET $path" 200 "$(http_code "$STORE_JAR" GET "$path")"
done

echo "=== Waiter board URLs ==="
for pair in "store_owner:$STORE_JAR" "frontdesk:$FRONT_JAR" "cashier:$CASH_JAR" "waiter:$WAIT_JAR"; do
  role="${pair%%:*}"
  jar="${pair#*:}"
  url=$(curl -sS -b "$jar" -o /dev/null -w '%{url_effective}' -L "$BASE/dashboard/waiter")
  if [[ "$url" == *"/dashboard/waiter" ]]; then pass "$role waiter board"; else fail "$role waiter board" "$url"; fi
done
url=$(curl -sS -b "$KITCHEN_JAR" -o /dev/null -w '%{url_effective}' -L "$BASE/dashboard/waiter")
if [[ "$url" != *"/dashboard/waiter" ]]; then pass "kitchen waiter board redirected"; else fail "kitchen waiter board redirected" "$url"; fi

if [ -n "$KITCHEN_ID" ]; then
  curl -sS -b "$ADMIN_JAR" -X DELETE "$BASE/api/dashboard/staff/$KITCHEN_ID" >/dev/null || true
  pass "kitchen temp account cleanup"
fi

# leave tables idle
ensure_idle "$FROM_TABLE"; ensure_idle "$TO_TABLE"; ensure_idle "$MERGE_TARGET"; ensure_idle "$CLOSE_TABLE"

echo "=== Summary: $PASS passed, $FAIL failed ==="
[ "$FAIL" -eq 0 ]
