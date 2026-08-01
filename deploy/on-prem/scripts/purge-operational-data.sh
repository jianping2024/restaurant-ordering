#!/usr/bin/env bash
# Mode B：清理日常经营数据（开台 / 订单 / 结账 / 打印队列等），保留门店配置。
#
# 表清单与「清 / 留」说明见同目录旁：
#   ../schema/purge_operational_data.sql  （文件头大段注释）
#
# 用法（店机，推荐）：
#   cd /opt/mesa/current   # 或解压包内带 deploy/on-prem 的树
#   sudo -E MESA_HOME=/opt/mesa bash deploy/on-prem/scripts/purge-operational-data.sh --i-understand-wipe-ops-data
#
# 可选：先备份
#   sudo -E MESA_HOME=/opt/mesa bash deploy/on-prem/scripts/backup-local.sh
#
# 环境：
#   需要 docker 容器 supabase-db，以及 deploy/on-prem/.env 里的 POSTGRES_PASSWORD。
#   若当前目录不是带 .env 的 on-prem 树，设置 MESA_HOME 后脚本会用
#   $MESA_HOME/current/deploy/on-prem/.env
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ONPREM_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

if [[ -n "${MESA_HOME:-}" && -f "${MESA_HOME}/current/deploy/on-prem/.env" ]]; then
  ONPREM_DIR="${MESA_HOME}/current/deploy/on-prem"
fi

ENV_FILE="${ONPREM_DIR}/.env"
SQL_FILE="$(cd "${SCRIPT_DIR}/../schema" && pwd)/purge_operational_data.sql"
# When MESA_HOME redirects ONPREM_DIR, SQL still lives next to this script's tree
# (pack / current sync keeps schema/ beside scripts/).
if [[ ! -f "$SQL_FILE" && -f "${ONPREM_DIR}/schema/purge_operational_data.sql" ]]; then
  SQL_FILE="${ONPREM_DIR}/schema/purge_operational_data.sql"
fi

usage() {
  cat <<EOF
Usage: $0 --i-understand-wipe-ops-data [--dry-run]

  --i-understand-wipe-ops-data   Required confirm flag (destructive).
  --dry-run                      Only print row counts for ops tables; no DELETE/TRUNCATE.

Clears daily trading data. Keeps restaurant config (menu, tables, staff, license, printers).
See comments in: deploy/on-prem/schema/purge_operational_data.sql
EOF
}

CONFIRM=0
DRY_RUN=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --i-understand-wipe-ops-data) CONFIRM=1; shift ;;
    --dry-run) DRY_RUN=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *)
      echo "Unexpected: $1" >&2
      usage
      exit 2
      ;;
  esac
done

if [[ "$CONFIRM" != "1" ]]; then
  echo "Refusing to run without --i-understand-wipe-ops-data" >&2
  usage
  exit 2
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing .env at ${ENV_FILE}" >&2
  echo "Hint: export MESA_HOME=/opt/mesa and run from a packed tree, or cd into deploy/on-prem after install." >&2
  exit 1
fi
if [[ ! -f "$SQL_FILE" ]]; then
  echo "Missing SQL: ${SQL_FILE}" >&2
  exit 1
fi

POSTGRES_PASSWORD=$(grep -E '^POSTGRES_PASSWORD=' "$ENV_FILE" | head -1 | cut -d= -f2-)
POSTGRES_DB=$(grep -E '^POSTGRES_DB=' "$ENV_FILE" | head -1 | cut -d= -f2-)
POSTGRES_DB=${POSTGRES_DB:-postgres}
export POSTGRES_PASSWORD POSTGRES_DB

# shellcheck source=lib/psql-mesa.sh
source "${SCRIPT_DIR}/lib/psql-mesa.sh"

if ! docker exec "${MESA_DB_CONTAINER}" pg_isready -U postgres -h localhost >/dev/null 2>&1; then
  echo "ERROR: ${MESA_DB_CONTAINER} is not ready." >&2
  exit 1
fi

# Row counts for the tables this purge touches (and a few keep-alive checks).
count_ops() {
  docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" "$MESA_DB_CONTAINER" \
    psql -U postgres -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -q -P pager=off <<'SQL'
SELECT 'table_sessions' AS tbl, count(*)::bigint AS n FROM public.table_sessions
UNION ALL SELECT 'orders', count(*) FROM public.orders
UNION ALL SELECT 'bill_splits', count(*) FROM public.bill_splits
UNION ALL SELECT 'session_collected_payments', count(*) FROM public.session_collected_payments
UNION ALL SELECT 'order_append_idempotency', count(*) FROM public.order_append_idempotency
UNION ALL SELECT 'print_jobs', count(*) FROM public.print_jobs
UNION ALL SELECT 'table_session_events', count(*) FROM public.table_session_events
UNION ALL SELECT 'table_party_groups', count(*) FROM public.table_party_groups
UNION ALL SELECT 'table_party_group_members', count(*) FROM public.table_party_group_members
UNION ALL SELECT 'dish_feedback', count(*) FROM public.dish_feedback
UNION ALL SELECT 'feedback_sessions', count(*) FROM public.feedback_sessions
UNION ALL SELECT 'abnormal_operations', count(*) FROM public.abnormal_operations
UNION ALL SELECT 'operation_logs', count(*) FROM public.operation_logs
UNION ALL SELECT 'analytics_daily_restaurant_stats', count(*) FROM public.analytics_daily_restaurant_stats
UNION ALL SELECT 'print_agent_support_tokens', count(*) FROM public.print_agent_support_tokens
ORDER BY 1;
SQL
}

echo "=== Ops tables BEFORE ==="
count_ops

if [[ "$DRY_RUN" == "1" ]]; then
  echo "Dry-run only; no truncate."
  echo "Keep-alive spot-check (should stay non-zero if configured):"
  docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" "$MESA_DB_CONTAINER" \
    psql -U postgres -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -q -P pager=off <<'SQL'
SELECT 'restaurants' AS tbl, count(*)::bigint AS n FROM public.restaurants
UNION ALL SELECT 'restaurant_tables', count(*) FROM public.restaurant_tables
UNION ALL SELECT 'menu_items', count(*) FROM public.menu_items
UNION ALL SELECT 'restaurant_staff_accounts', count(*) FROM public.restaurant_staff_accounts
UNION ALL SELECT 'print_agent_devices', count(*) FROM public.print_agent_devices
ORDER BY 1;
SQL
  exit 0
fi

echo "Applying ${SQL_FILE} ..."
sql_exec_file "$SQL_FILE"

echo "=== Ops tables AFTER (expect all 0) ==="
count_ops

echo "=== Config still present (spot-check) ==="
docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" "$MESA_DB_CONTAINER" \
  psql -U postgres -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -q -P pager=off <<'SQL'
SELECT 'restaurants' AS tbl, count(*)::bigint AS n FROM public.restaurants
UNION ALL SELECT 'restaurant_tables', count(*) FROM public.restaurant_tables
UNION ALL SELECT 'menu_items', count(*) FROM public.menu_items
UNION ALL SELECT 'restaurant_staff_accounts', count(*) FROM public.restaurant_staff_accounts
UNION ALL SELECT 'print_agent_devices', count(*) FROM public.print_agent_devices
ORDER BY 1;
SQL

echo "DONE. Floor should be idle; staff/menu/license/printer pairing kept."
