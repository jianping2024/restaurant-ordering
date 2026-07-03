#!/usr/bin/env python3
"""Generate batch-5.json knowledge graph fragment."""
import json

PROJECT = "/Users/chenjianping/Documents/restaurant-ordering"
EXTRACT = f"{PROJECT}/.understand-anything/tmp/ua-file-extract-results-5.json"
OUTPUT = f"{PROJECT}/.understand-anything/intermediate/batch-5.json"

with open(EXTRACT) as f:
    extract = json.load(f)

batch_import = {
    "apps/web/src/app/api/dashboard/abnormal-operations/[id]/route.ts": ["apps/web/src/lib/abnormal-operations-rate-limit.ts", "apps/web/src/lib/abnormal-operations/load-owner-context.ts", "apps/web/src/lib/abnormal-operations/patch-abnormal-operation.service.ts", "apps/web/src/lib/abnormal-operations/types.ts"],
    "apps/web/src/app/api/dashboard/abnormal-operations/route.ts": ["apps/web/src/lib/abnormal-operations-rate-limit.ts", "apps/web/src/lib/abnormal-operations/load-owner-context.ts", "apps/web/src/lib/abnormal-operations/owner-query.ts", "apps/web/src/lib/abnormal-operations/parse-list-query.ts"],
    "apps/web/src/app/api/dashboard/close-table-session/route.ts": ["apps/web/src/lib/close-table-session-ui.ts", "apps/web/src/lib/restaurant-tables.ts", "apps/web/src/lib/table-session/close-table-session.service.ts", "apps/web/src/lib/table-session/load-close-table-actor.ts"],
    "apps/web/src/app/api/restaurants/[slug]/checkout/apply-discount/route.ts": ["apps/web/src/lib/checkout-confirm-payment-auth.ts", "apps/web/src/lib/checkout-discount/apply-bill-split-discount.ts"],
    "apps/web/src/app/api/restaurants/[slug]/staff/kitchen/orders/[orderId]/route.ts": ["apps/web/src/lib/audit/index.ts", "apps/web/src/lib/order-item-void/patch-order-items.service.ts", "apps/web/src/lib/staff-api-auth.ts", "apps/web/src/lib/supabase/admin.ts", "apps/web/src/types/index.ts"],
    "apps/web/src/app/api/restaurants/[slug]/staff/waiter/orders/[orderId]/route.ts": ["apps/web/src/lib/audit/index.ts", "apps/web/src/lib/order-item-void/patch-order-items.service.ts", "apps/web/src/lib/staff-api-auth.ts", "apps/web/src/lib/supabase/admin.ts", "apps/web/src/lib/waiter-session-guard.ts", "apps/web/src/types/index.ts"],
    "apps/web/src/components/dashboard/AbnormalOperationsManager.tsx": ["apps/web/src/components/providers/LanguageProvider.tsx", "apps/web/src/components/ui/Button.tsx", "apps/web/src/components/ui/Modal.tsx", "apps/web/src/components/ui/Toast.tsx", "apps/web/src/lib/abnormal-operations.ts", "apps/web/src/lib/abnormal-operations/client-api.ts", "apps/web/src/lib/abnormal-operations/list-patch-merge.ts", "apps/web/src/lib/abnormal-operations/owner-query.ts", "apps/web/src/lib/abnormal-operations/reason-display.ts", "apps/web/src/lib/abnormal-operations/types.ts", "apps/web/src/lib/i18n/messages.ts"],
    "apps/web/src/lib/abnormal-operations-rate-limit.ts": ["apps/web/src/lib/in-memory-rate-limit.ts"],
    "apps/web/src/lib/abnormal-operations.test.ts": ["apps/web/src/lib/abnormal-operations.ts", "apps/web/src/lib/audit/reasons.ts"],
    "apps/web/src/lib/abnormal-operations.ts": [],
    "apps/web/src/lib/abnormal-operations/client-api.ts": ["apps/web/src/lib/abnormal-operations/owner-query.ts", "apps/web/src/lib/abnormal-operations/types.ts"],
    "apps/web/src/lib/abnormal-operations/list-patch-merge.test.ts": ["apps/web/src/lib/abnormal-operations/list-patch-merge.ts", "apps/web/src/lib/abnormal-operations/owner-query.ts", "apps/web/src/lib/abnormal-operations/types.ts"],
    "apps/web/src/lib/abnormal-operations/list-patch-merge.ts": ["apps/web/src/lib/abnormal-operations/owner-query.ts", "apps/web/src/lib/abnormal-operations/types.ts"],
    "apps/web/src/lib/abnormal-operations/load-owner-context.ts": ["apps/web/src/lib/audit/load-owner-dashboard-actor.ts", "apps/web/src/lib/audit/types.ts", "apps/web/src/lib/dashboard-access.ts", "apps/web/src/lib/supabase/admin.ts"],
    "apps/web/src/lib/abnormal-operations/owner-query.ts": ["apps/web/src/lib/abnormal-operations/types.ts", "apps/web/src/lib/audit/reasons.ts", "apps/web/src/lib/lisbon-calendar.ts", "apps/web/src/types/index.ts"],
    "apps/web/src/lib/abnormal-operations/parse-list-query.test.ts": ["apps/web/src/lib/abnormal-operations/parse-list-query.ts"],
    "apps/web/src/lib/abnormal-operations/parse-list-query.ts": ["apps/web/src/lib/abnormal-operations/owner-query.ts", "apps/web/src/lib/abnormal-operations/types.ts"],
    "apps/web/src/lib/abnormal-operations/patch-abnormal-operation.service.test.ts": ["apps/web/src/lib/abnormal-operations/patch-abnormal-operation.service.ts"],
    "apps/web/src/lib/abnormal-operations/patch-abnormal-operation.service.ts": ["apps/web/src/lib/abnormal-operations/owner-query.ts", "apps/web/src/lib/abnormal-operations/types.ts", "apps/web/src/lib/audit/builders/abnormal-owner-action.ts", "apps/web/src/lib/audit/index.ts", "apps/web/src/lib/audit/types.ts"],
    "apps/web/src/lib/abnormal-operations/reason-display.ts": ["apps/web/src/lib/abnormal-operations/types.ts", "apps/web/src/lib/i18n.ts", "apps/web/src/lib/i18n/messages.ts", "apps/web/src/lib/staff-routes.ts"],
    "apps/web/src/lib/abnormal-operations/types.ts": [],
    "apps/web/src/lib/audit/abnormal-operation.repository.ts": ["apps/web/src/lib/abnormal-operations/types.ts"],
    "apps/web/src/lib/audit/audit.service.test.ts": ["apps/web/src/lib/audit/audit.service.ts", "apps/web/src/lib/audit/types.ts"],
    "apps/web/src/lib/audit/audit.service.ts": ["apps/web/src/lib/audit/abnormal-operation.repository.ts", "apps/web/src/lib/audit/operation-log.repository.ts", "apps/web/src/lib/audit/registry.ts", "apps/web/src/lib/audit/resolve-actor.ts", "apps/web/src/lib/audit/types.ts"],
    "apps/web/src/lib/audit/builders/abnormal-owner-action.test.ts": ["apps/web/src/lib/audit/builders/abnormal-owner-action.ts"],
    "apps/web/src/lib/audit/builders/abnormal-owner-action.ts": ["apps/web/src/lib/abnormal-operations/types.ts", "apps/web/src/lib/audit/types.ts"],
    "apps/web/src/lib/audit/builders/discount-applied.test.ts": ["apps/web/src/lib/audit/builders/discount-applied.ts"],
    "apps/web/src/lib/audit/builders/discount-applied.ts": ["apps/web/src/lib/abnormal-operations/owner-query.ts", "apps/web/src/lib/audit/money.ts", "apps/web/src/lib/audit/types.ts"],
    "apps/web/src/lib/audit/builders/item-deleted.ts": ["apps/web/src/lib/abnormal-operations/owner-query.ts", "apps/web/src/lib/audit/money.ts", "apps/web/src/lib/audit/types.ts", "apps/web/src/lib/cart-totals.ts", "apps/web/src/types/index.ts"],
    "apps/web/src/lib/audit/builders/item-qty-decremented.ts": ["apps/web/src/lib/audit/money.ts", "apps/web/src/lib/audit/types.ts", "apps/web/src/types/index.ts"],
}

FILE_META = {
    "apps/web/src/app/api/dashboard/abnormal-operations/[id]/route.ts": {
        "summary": "Dashboard API 路由：店主 PATCH 更新单条异常操作记录（确认/忽略/备注），含鉴权与限流。",
        "tags": ["api-handler", "dashboard", "abnormal-operations", "rate-limit"],
        "complexity": "moderate",
    },
    "apps/web/src/app/api/dashboard/abnormal-operations/route.ts": {
        "summary": "Dashboard API 路由：店主 GET 分页查询异常操作列表，解析查询参数并调用 owner-query。",
        "tags": ["api-handler", "dashboard", "abnormal-operations", "list"],
        "complexity": "simple",
    },
    "apps/web/src/app/api/dashboard/close-table-session/route.ts": {
        "summary": "Dashboard API 路由：手动关闭桌台会话，校验 actor 与 table_id 后调用 closeTableSessionManual。",
        "tags": ["api-handler", "dashboard", "table-session"],
        "complexity": "moderate",
    },
    "apps/web/src/app/api/restaurants/[slug]/checkout/apply-discount/route.ts": {
        "summary": "结账 API：对 bill split 应用折扣，需 checkout 支付授权后调用 applyBillSplitDiscount。",
        "tags": ["api-handler", "checkout", "discount", "payment"],
        "complexity": "moderate",
    },
    "apps/web/src/app/api/restaurants/[slug]/staff/kitchen/orders/[orderId]/route.ts": {
        "summary": "厨房员工 API：PATCH 订单项（含 void 审计），staff 鉴权后调用 patchOrderItemsWithVoidAudit。",
        "tags": ["api-handler", "kitchen", "order-void", "staff-api"],
        "complexity": "complex",
    },
    "apps/web/src/app/api/restaurants/[slug]/staff/waiter/orders/[orderId]/route.ts": {
        "summary": "服务员 API：PATCH 订单项，含 openTable 鉴权、会话 billing 守卫与 void 审计。",
        "tags": ["api-handler", "waiter", "order-void", "staff-api"],
        "complexity": "complex",
    },
    "apps/web/src/components/dashboard/AbnormalOperationsManager.tsx": {
        "summary": "Dashboard 异常操作管理 UI：筛选、分页、详情弹窗、状态 PATCH 与 i18n 展示。",
        "tags": ["component", "dashboard", "abnormal-operations", "i18n"],
        "complexity": "complex",
        "languageNotes": "大型 React 客户端组件，含 debounce 筛选与 refresh cooldown。",
    },
    "apps/web/src/lib/abnormal-operations-rate-limit.ts": {
        "summary": "异常操作 list/patch API 的内存限流封装，基于 ownerId 与 restaurantId。",
        "tags": ["rate-limit", "utility", "abnormal-operations"],
        "complexity": "simple",
    },
    "apps/web/src/lib/abnormal-operations.test.ts": {
        "summary": "异常操作领域逻辑单元测试：日期范围解析、风险等级与状态流转。",
        "tags": ["test", "abnormal-operations", "validation"],
        "complexity": "moderate",
    },
    "apps/web/src/lib/abnormal-operations.ts": {
        "summary": "异常操作模块 barrel：重导出 owner-query 函数、日历工具与类型定义。",
        "tags": ["barrel", "abnormal-operations", "entry-point"],
        "complexity": "simple",
    },
    "apps/web/src/lib/abnormal-operations/client-api.ts": {
        "summary": "浏览器端 fetch 封装：查询异常操作列表与 PATCH 单条记录。",
        "tags": ["client-api", "abnormal-operations", "fetch"],
        "complexity": "moderate",
    },
    "apps/web/src/lib/abnormal-operations/list-patch-merge.test.ts": {
        "summary": "list-patch-merge 单元测试：验证 PATCH 后列表合并与统计更新逻辑。",
        "tags": ["test", "abnormal-operations", "merge"],
        "complexity": "moderate",
    },
    "apps/web/src/lib/abnormal-operations/list-patch-merge.ts": {
        "summary": "PATCH 成功后合并更新列表数据：替换行、过滤 status 并重算 stats。",
        "tags": ["utility", "abnormal-operations", "state-merge"],
        "complexity": "simple",
    },
    "apps/web/src/lib/abnormal-operations/load-owner-context.ts": {
        "summary": "加载店主 dashboard 上下文：dashboard access、admin client 与 audit actor。",
        "tags": ["service", "auth", "abnormal-operations", "dashboard"],
        "complexity": "simple",
    },
    "apps/web/src/lib/abnormal-operations/owner-query.ts": {
        "summary": "异常操作核心查询层：日期范围解析、列表分页、风险等级、状态 PATCH 与 Supabase 访问。",
        "tags": ["service", "data-model", "abnormal-operations", "supabase"],
        "complexity": "complex",
        "languageNotes": "含 Lisbon 时区日期窗口与 abnormal_operations 表 CRUD。",
    },
    "apps/web/src/lib/abnormal-operations/parse-list-query.test.ts": {
        "summary": "parse-list-query 单元测试：验证 URL 查询参数解析与枚举校验。",
        "tags": ["test", "abnormal-operations", "validation"],
        "complexity": "simple",
    },
    "apps/web/src/lib/abnormal-operations/parse-list-query.ts": {
        "summary": "将 dashboard 列表 API 的 URLSearchParams 解析为 AbnormalOperationsListFilters。",
        "tags": ["validation", "abnormal-operations", "query-parser"],
        "complexity": "simple",
    },
    "apps/web/src/lib/abnormal-operations/patch-abnormal-operation.service.test.ts": {
        "summary": "patch-abnormal-operation.service 单元测试：mock Supabase 验证 PATCH 与 audit 记录。",
        "tags": ["test", "abnormal-operations", "audit"],
        "complexity": "moderate",
    },
    "apps/web/src/lib/abnormal-operations/patch-abnormal-operation.service.ts": {
        "summary": "带审计的异常操作 PATCH 服务：状态变更后按类型 recordAudit（确认/忽略/备注）。",
        "tags": ["service", "audit", "abnormal-operations"],
        "complexity": "moderate",
    },
    "apps/web/src/lib/abnormal-operations/reason-display.ts": {
        "summary": "异常操作原因 i18n 展示与桌台链接生成（waiterTableHref）。",
        "tags": ["utility", "i18n", "abnormal-operations"],
        "complexity": "simple",
    },
    "apps/web/src/lib/abnormal-operations/types.ts": {
        "summary": "异常操作领域类型：行结构、筛选器、列表结果与 PATCH 参数。",
        "tags": ["type-definition", "abnormal-operations", "data-model"],
        "complexity": "simple",
    },
    "apps/web/src/lib/audit/abnormal-operation.repository.ts": {
        "summary": "abnormal_operations 表 insert 仓储：审计事件触发时写入异常操作行。",
        "tags": ["repository", "database", "audit"],
        "complexity": "simple",
    },
    "apps/web/src/lib/audit/audit.service.test.ts": {
        "summary": "audit.service 单元测试：验证 recordAudit 写入 operation_log 与 abnormal_operations。",
        "tags": ["test", "audit", "service"],
        "complexity": "moderate",
    },
    "apps/web/src/lib/audit/audit.service.ts": {
        "summary": "统一审计入口 recordAudit：按 registry 定义构建 payload，写入 operation_log 与可选 abnormal row。",
        "tags": ["service", "audit", "singleton"],
        "complexity": "moderate",
    },
    "apps/web/src/lib/audit/builders/abnormal-owner-action.test.ts": {
        "summary": "abnormal-owner-action builder 单元测试：验证确认/忽略/备注 audit payload。",
        "tags": ["test", "audit", "builder"],
        "complexity": "simple",
    },
    "apps/web/src/lib/audit/builders/abnormal-owner-action.ts": {
        "summary": "店主异常操作 audit event 定义：abnormal_confirmed/ignored/note_added 三类 builder。",
        "tags": ["audit", "builder", "abnormal-operations"],
        "complexity": "simple",
    },
    "apps/web/src/lib/audit/builders/discount-applied.test.ts": {
        "summary": "discount-applied builder 单元测试：验证折扣金额与 risk_level 计算。",
        "tags": ["test", "audit", "discount"],
        "complexity": "simple",
    },
    "apps/web/src/lib/audit/builders/discount-applied.ts": {
        "summary": "discount_applied audit event 定义：计算折扣金额、risk_level 并构建 abnormal payload。",
        "tags": ["audit", "builder", "discount"],
        "complexity": "simple",
    },
    "apps/web/src/lib/audit/builders/item-deleted.ts": {
        "summary": "item_deleted audit event 定义：void 整行时记录金额影响与 risk_level。",
        "tags": ["audit", "builder", "order-void"],
        "complexity": "simple",
    },
    "apps/web/src/lib/audit/builders/item-qty-decremented.ts": {
        "summary": "item_qty_decremented audit event 定义：减数量 void 时记录金额与原因。",
        "tags": ["audit", "builder", "order-void"],
        "complexity": "simple",
    },
}

FUNCTION_META = {
    ("apps/web/src/app/api/dashboard/abnormal-operations/[id]/route.ts", "PATCH"): {
        "summary": "处理单条异常操作 PATCH：鉴权、限流、校验 status 并调用 patchAbnormalOperationWithAudit。",
        "tags": ["api-handler", "patch", "abnormal-operations"],
    },
    ("apps/web/src/app/api/dashboard/abnormal-operations/route.ts", "GET"): {
        "summary": "处理异常操作列表 GET：加载 owner 上下文、限流、解析查询并 listAbnormalOperations。",
        "tags": ["api-handler", "list", "abnormal-operations"],
    },
    ("apps/web/src/app/api/dashboard/close-table-session/route.ts", "POST"): {
        "summary": "处理手动关桌 POST：加载 actor、解析 table_id 与确认参数后关闭会话。",
        "tags": ["api-handler", "table-session", "post"],
    },
    ("apps/web/src/app/api/restaurants/[slug]/checkout/apply-discount/route.ts", "POST"): {
        "summary": "处理 bill split 折扣 POST：校验参数、授权 checkout 后应用折扣。",
        "tags": ["api-handler", "checkout", "discount"],
    },
    ("apps/web/src/app/api/restaurants/[slug]/staff/kitchen/orders/[orderId]/route.ts", "PATCH"): {
        "summary": "厨房 PATCH 订单项：staff 鉴权、加载订单、void audit 更新 items。",
        "tags": ["api-handler", "kitchen", "order-void"],
    },
    ("apps/web/src/app/api/restaurants/[slug]/staff/waiter/orders/[orderId]/route.ts", "PATCH"): {
        "summary": "服务员 PATCH 订单项：openTable 鉴权、billing 守卫、void audit 更新。",
        "tags": ["api-handler", "waiter", "order-void"],
    },
    ("apps/web/src/components/dashboard/AbnormalOperationsManager.tsx", "AbnormalOperationsManager"): {
        "summary": "异常操作管理主组件：筛选 UI、数据加载、详情 Modal 与 PATCH 交互。",
        "tags": ["component", "dashboard", "react"],
    },
    ("apps/web/src/components/dashboard/AbnormalOperationsManager.tsx", "detectDatePreset"): {
        "summary": "根据 start/end 日期检测当前日期预设（today/7d/30d）。",
        "tags": ["utility", "date-filter"],
    },
    ("apps/web/src/lib/abnormal-operations-rate-limit.ts", "abnormalOperationsListRateLimitCheck"): {
        "summary": "列表 API 限流检查，key 为 owner+restaurant。",
        "tags": ["rate-limit", "list"],
    },
    ("apps/web/src/lib/abnormal-operations-rate-limit.ts", "abnormalOperationsPatchRateLimitCheck"): {
        "summary": "PATCH API 限流检查，key 为 owner+restaurant。",
        "tags": ["rate-limit", "patch"],
    },
    ("apps/web/src/lib/abnormal-operations/client-api.ts", "toQuery"): {
        "summary": "将列表筛选参数序列化为 URLSearchParams 查询字符串。",
        "tags": ["utility", "query-string"],
    },
    ("apps/web/src/lib/abnormal-operations/client-api.ts", "fetchAbnormalOperations"): {
        "summary": "fetch GET /api/dashboard/abnormal-operations 并解析 JSON 响应。",
        "tags": ["client-api", "fetch"],
    },
    ("apps/web/src/lib/abnormal-operations/client-api.ts", "patchAbnormalOperationClient"): {
        "summary": "fetch PATCH 单条异常操作并返回更新行或错误。",
        "tags": ["client-api", "fetch", "patch"],
    },
    ("apps/web/src/lib/abnormal-operations/list-patch-merge.ts", "mergePatchedAbnormalOperationRow"): {
        "summary": "PATCH 成功后更新列表 items 与 stats，按 status 过滤。",
        "tags": ["utility", "state-merge"],
    },
    ("apps/web/src/lib/abnormal-operations/load-owner-context.ts", "loadOwnerAbnormalOperationsContext"): {
        "summary": "加载店主异常操作 API 所需 admin client、restaurantId 与 audit actor。",
        "tags": ["auth", "context-loader"],
    },
    ("apps/web/src/lib/abnormal-operations/owner-query.ts", "parseAbnormalOperationsDateRange"): {
        "summary": "解析并校验日期范围，转换为 Lisbon 时区 UTC 窗口。",
        "tags": ["validation", "date-range"],
    },
    ("apps/web/src/lib/abnormal-operations/owner-query.ts", "computeStats"): {
        "summary": "从行集合计算 pending/confirmed 计数与 amount_impact 合计。",
        "tags": ["utility", "aggregation"],
    },
    ("apps/web/src/lib/abnormal-operations/owner-query.ts", "listAbnormalOperations"): {
        "summary": "按筛选条件查询 abnormal_operations 表并分页返回 stats。",
        "tags": ["service", "supabase", "list"],
    },
    ("apps/web/src/lib/abnormal-operations/owner-query.ts", "getAbnormalOperationById"): {
        "summary": "按 restaurantId 与 id 获取单条 abnormal_operation 行。",
        "tags": ["service", "supabase", "query"],
    },
    ("apps/web/src/lib/abnormal-operations/owner-query.ts", "patchAbnormalOperation"): {
        "summary": "校验状态流转后更新 abnormal_operations 行。",
        "tags": ["service", "supabase", "patch"],
    },
    ("apps/web/src/lib/abnormal-operations/owner-query.ts", "riskLevelForVoidedItem"): {
        "summary": "根据 item 状态计算 void 风险等级。",
        "tags": ["utility", "risk-level"],
    },
    ("apps/web/src/lib/abnormal-operations/owner-query.ts", "riskLevelForDiscountRate"): {
        "summary": "根据折扣率计算 risk_level（low/medium/high）。",
        "tags": ["utility", "risk-level"],
    },
    ("apps/web/src/lib/abnormal-operations/parse-list-query.ts", "parseAbnormalOperationsListQuery"): {
        "summary": "解析 URL 查询参数为类型安全的列表筛选对象。",
        "tags": ["validation", "query-parser"],
    },
    ("apps/web/src/lib/abnormal-operations/patch-abnormal-operation.service.ts", "auditContext"): {
        "summary": "从 existing/next 行构建 owner action audit context。",
        "tags": ["utility", "audit"],
    },
    ("apps/web/src/lib/abnormal-operations/patch-abnormal-operation.service.ts", "patchAbnormalOperationWithAudit"): {
        "summary": "PATCH 异常操作并按状态变更类型 recordAudit。",
        "tags": ["service", "audit", "patch"],
    },
    ("apps/web/src/lib/abnormal-operations/reason-display.ts", "abnormalOperationReasonLabel"): {
        "summary": "按 type/reason 返回 i18n 原因标签。",
        "tags": ["i18n", "display"],
    },
    ("apps/web/src/lib/audit/abnormal-operation.repository.ts", "insertAbnormalOperationRow"): {
        "summary": "向 abnormal_operations 表 insert 新行并返回 id。",
        "tags": ["repository", "database", "insert"],
    },
    ("apps/web/src/lib/audit/audit.service.ts", "recordAudit"): {
        "summary": "统一审计记录：registry build → operation_log → 可选 abnormal_operations insert。",
        "tags": ["service", "audit", "entry-point"],
    },
    ("apps/web/src/lib/audit/builders/abnormal-owner-action.ts", "buildPayload"): {
        "summary": "构建店主异常操作 audit payload（before/after/note）。",
        "tags": ["audit", "builder"],
    },
    ("apps/web/src/lib/audit/builders/discount-applied.ts", "computeDiscountAmounts"): {
        "summary": "计算 original/discount/final 金额（auditMoney 格式化）。",
        "tags": ["utility", "money", "discount"],
    },
}

EXPORTED = set()
for r in extract["results"]:
    for ex in r.get("exports", []):
        EXPORTED.add((r["path"], ex["name"]))

def fn_lines(fn):
    return fn["endLine"] - fn["startLine"] + 1

def fn_complexity(fn):
    lines = fn_lines(fn)
    if lines >= 50:
        return "complex"
    if lines >= 20:
        return "moderate"
    return "simple"

def is_significant(path, fn):
    lines = fn_lines(fn)
    name = fn["name"]
    if lines >= 10:
        return True
    if (path, name) in EXPORTED:
        return True
    return False

nodes = []
edges = []

# File nodes
for path, meta in FILE_META.items():
    name = path.split("/")[-1]
    node = {
        "id": f"file:{path}",
        "type": "file",
        "name": name,
        "filePath": path,
        "summary": meta["summary"],
        "tags": meta["tags"],
        "complexity": meta["complexity"],
    }
    if "languageNotes" in meta:
        node["languageNotes"] = meta["languageNotes"]
    nodes.append(node)

# Function nodes from extraction + manual additions
result_by_path = {r["path"]: r for r in extract["results"]}
created_fns = set()

for r in extract["results"]:
    path = r["path"]
    for fn in r.get("functions", []):
        if not is_significant(path, fn):
            continue
        key = (path, fn["name"])
        if key in created_fns:
            continue
        created_fns.add(key)
        meta = FUNCTION_META.get(key, {
            "summary": f"{fn['name']} 函数。",
            "tags": ["utility"],
        })
        fn_node = {
            "id": f"function:{path}:{fn['name']}",
            "type": "function",
            "name": fn["name"],
            "filePath": path,
            "lineRange": [fn["startLine"], fn["endLine"]],
            "summary": meta["summary"],
            "tags": meta["tags"],
            "complexity": fn_complexity(fn),
        }
        nodes.append(fn_node)
        edges.append({
            "source": f"file:{path}",
            "target": fn_node["id"],
            "type": "contains",
            "direction": "forward",
            "weight": 1.0,
        })
        if key in EXPORTED:
            edges.append({
                "source": f"file:{path}",
                "target": fn_node["id"],
                "type": "exports",
                "direction": "forward",
                "weight": 0.8,
            })

# Import edges (all)
import_count = 0
for src, targets in batch_import.items():
    for tgt in targets:
        edges.append({
            "source": f"file:{src}",
            "target": f"file:{tgt}",
            "type": "imports",
            "direction": "forward",
            "weight": 0.7,
        })
        import_count += 1

# Calls edges (in-batch and confident cross-batch)
CALLS = [
    ("function:apps/web/src/app/api/dashboard/abnormal-operations/[id]/route.ts:PATCH", "function:apps/web/src/lib/abnormal-operations/load-owner-context.ts:loadOwnerAbnormalOperationsContext"),
    ("function:apps/web/src/app/api/dashboard/abnormal-operations/[id]/route.ts:PATCH", "function:apps/web/src/lib/abnormal-operations-rate-limit.ts:abnormalOperationsPatchRateLimitCheck"),
    ("function:apps/web/src/app/api/dashboard/abnormal-operations/[id]/route.ts:PATCH", "function:apps/web/src/lib/abnormal-operations/patch-abnormal-operation.service.ts:patchAbnormalOperationWithAudit"),
    ("function:apps/web/src/app/api/dashboard/abnormal-operations/route.ts:GET", "function:apps/web/src/lib/abnormal-operations/load-owner-context.ts:loadOwnerAbnormalOperationsContext"),
    ("function:apps/web/src/app/api/dashboard/abnormal-operations/route.ts:GET", "function:apps/web/src/lib/abnormal-operations-rate-limit.ts:abnormalOperationsListRateLimitCheck"),
    ("function:apps/web/src/app/api/dashboard/abnormal-operations/route.ts:GET", "function:apps/web/src/lib/abnormal-operations/parse-list-query.ts:parseAbnormalOperationsListQuery"),
    ("function:apps/web/src/app/api/dashboard/abnormal-operations/route.ts:GET", "function:apps/web/src/lib/abnormal-operations/owner-query.ts:listAbnormalOperations"),
    ("function:apps/web/src/app/api/dashboard/close-table-session/route.ts:POST", "function:apps/web/src/lib/table-session/load-close-table-actor.ts:loadCloseTableSessionActor"),
    ("function:apps/web/src/app/api/dashboard/close-table-session/route.ts:POST", "function:apps/web/src/lib/restaurant-tables.ts:parseTableIdParam"),
    ("function:apps/web/src/app/api/dashboard/close-table-session/route.ts:POST", "function:apps/web/src/lib/table-session/close-table-session.service.ts:closeTableSessionManual"),
    ("function:apps/web/src/app/api/dashboard/close-table-session/route.ts:POST", "function:apps/web/src/lib/close-table-session-ui.ts:parseCloseConfirmFromBody"),
    ("function:apps/web/src/app/api/restaurants/[slug]/checkout/apply-discount/route.ts:POST", "function:apps/web/src/lib/checkout-confirm-payment-auth.ts:authorizeCheckoutConfirmPayment"),
    ("function:apps/web/src/app/api/restaurants/[slug]/checkout/apply-discount/route.ts:POST", "function:apps/web/src/lib/checkout-discount/apply-bill-split-discount.ts:applyBillSplitDiscount"),
    ("function:apps/web/src/app/api/restaurants/[slug]/staff/kitchen/orders/[orderId]/route.ts:PATCH", "function:apps/web/src/lib/staff-api-auth.ts:staffAuthFromRequest"),
    ("function:apps/web/src/app/api/restaurants/[slug]/staff/kitchen/orders/[orderId]/route.ts:PATCH", "function:apps/web/src/lib/supabase/admin.ts:createAdminClient"),
    ("function:apps/web/src/app/api/restaurants/[slug]/staff/kitchen/orders/[orderId]/route.ts:PATCH", "function:apps/web/src/lib/audit/index.ts:loadStaffAuditActor"),
    ("function:apps/web/src/app/api/restaurants/[slug]/staff/kitchen/orders/[orderId]/route.ts:PATCH", "function:apps/web/src/lib/order-item-void/patch-order-items.service.ts:patchOrderItemsWithVoidAudit"),
    ("function:apps/web/src/app/api/restaurants/[slug]/staff/waiter/orders/[orderId]/route.ts:PATCH", "function:apps/web/src/lib/staff-api-auth.ts:openTableAuthFromRequest"),
    ("function:apps/web/src/app/api/restaurants/[slug]/staff/waiter/orders/[orderId]/route.ts:PATCH", "function:apps/web/src/lib/supabase/admin.ts:createAdminClient"),
    ("function:apps/web/src/app/api/restaurants/[slug]/staff/waiter/orders/[orderId]/route.ts:PATCH", "function:apps/web/src/lib/waiter-session-guard.ts:sessionIdBlocksWaiterMutation"),
    ("function:apps/web/src/app/api/restaurants/[slug]/staff/waiter/orders/[orderId]/route.ts:PATCH", "function:apps/web/src/lib/waiter-session-guard.ts:sessionBillingResponse"),
    ("function:apps/web/src/app/api/restaurants/[slug]/staff/waiter/orders/[orderId]/route.ts:PATCH", "function:apps/web/src/lib/audit/index.ts:loadStaffAuditActor"),
    ("function:apps/web/src/app/api/restaurants/[slug]/staff/waiter/orders/[orderId]/route.ts:PATCH", "function:apps/web/src/lib/order-item-void/patch-order-items.service.ts:patchOrderItemsWithVoidAudit"),
    ("function:apps/web/src/components/dashboard/AbnormalOperationsManager.tsx:AbnormalOperationsManager", "function:apps/web/src/lib/abnormal-operations/client-api.ts:fetchAbnormalOperations"),
    ("function:apps/web/src/components/dashboard/AbnormalOperationsManager.tsx:AbnormalOperationsManager", "function:apps/web/src/lib/abnormal-operations/client-api.ts:patchAbnormalOperationClient"),
    ("function:apps/web/src/components/dashboard/AbnormalOperationsManager.tsx:AbnormalOperationsManager", "function:apps/web/src/lib/abnormal-operations/list-patch-merge.ts:mergePatchedAbnormalOperationRow"),
    ("function:apps/web/src/components/dashboard/AbnormalOperationsManager.tsx:AbnormalOperationsManager", "function:apps/web/src/lib/abnormal-operations/reason-display.ts:formatAbnormalOperationReasonText"),
    ("function:apps/web/src/components/dashboard/AbnormalOperationsManager.tsx:AbnormalOperationsManager", "function:apps/web/src/lib/abnormal-operations/reason-display.ts:abnormalOperationTableHref"),
    ("function:apps/web/src/lib/abnormal-operations-rate-limit.ts:abnormalOperationsListRateLimitCheck", "function:apps/web/src/lib/in-memory-rate-limit.ts:checkInMemoryRateLimit"),
    ("function:apps/web/src/lib/abnormal-operations-rate-limit.ts:abnormalOperationsPatchRateLimitCheck", "function:apps/web/src/lib/in-memory-rate-limit.ts:checkInMemoryRateLimit"),
    ("function:apps/web/src/lib/abnormal-operations/client-api.ts:fetchAbnormalOperations", "function:apps/web/src/lib/abnormal-operations/client-api.ts:toQuery"),
    ("function:apps/web/src/lib/abnormal-operations/load-owner-context.ts:loadOwnerAbnormalOperationsContext", "function:apps/web/src/lib/dashboard-access.ts:loadDashboardAccess"),
    ("function:apps/web/src/lib/abnormal-operations/load-owner-context.ts:loadOwnerAbnormalOperationsContext", "function:apps/web/src/lib/supabase/admin.ts:createAdminClient"),
    ("function:apps/web/src/lib/abnormal-operations/load-owner-context.ts:loadOwnerAbnormalOperationsContext", "function:apps/web/src/lib/audit/load-owner-dashboard-actor.ts:loadOwnerDashboardAuditActor"),
    ("function:apps/web/src/lib/abnormal-operations/owner-query.ts:listAbnormalOperations", "function:apps/web/src/lib/abnormal-operations/owner-query.ts:parseAbnormalOperationsDateRange"),
    ("function:apps/web/src/lib/abnormal-operations/owner-query.ts:listAbnormalOperations", "function:apps/web/src/lib/abnormal-operations/owner-query.ts:computeStats"),
    ("function:apps/web/src/lib/abnormal-operations/owner-query.ts:patchAbnormalOperation", "function:apps/web/src/lib/abnormal-operations/owner-query.ts:getAbnormalOperationById"),
    ("function:apps/web/src/lib/abnormal-operations/patch-abnormal-operation.service.ts:patchAbnormalOperationWithAudit", "function:apps/web/src/lib/abnormal-operations/owner-query.ts:getAbnormalOperationById"),
    ("function:apps/web/src/lib/abnormal-operations/patch-abnormal-operation.service.ts:patchAbnormalOperationWithAudit", "function:apps/web/src/lib/abnormal-operations/owner-query.ts:patchAbnormalOperation"),
    ("function:apps/web/src/lib/abnormal-operations/patch-abnormal-operation.service.ts:patchAbnormalOperationWithAudit", "function:apps/web/src/lib/audit/index.ts:recordAudit"),
    ("function:apps/web/src/lib/abnormal-operations/patch-abnormal-operation.service.ts:patchAbnormalOperationWithAudit", "function:apps/web/src/lib/abnormal-operations/patch-abnormal-operation.service.ts:auditContext"),
    ("function:apps/web/src/lib/audit/audit.service.ts:recordAudit", "function:apps/web/src/lib/audit/abnormal-operation.repository.ts:insertAbnormalOperationRow"),
    ("function:apps/web/src/lib/audit/builders/discount-applied.ts:computeDiscountAmounts", "function:apps/web/src/lib/audit/money.ts:auditMoney"),
    ("function:apps/web/src/lib/audit/builders/item-deleted.ts:itemLineAmount", "function:apps/web/src/lib/cart-totals.ts:lineTotal"),
]

for src, tgt in CALLS:
    edges.append({"source": src, "target": tgt, "type": "calls", "direction": "forward", "weight": 0.8})

# tested_by edges (production -> test)
TESTED_BY = [
    ("file:apps/web/src/lib/abnormal-operations.ts", "file:apps/web/src/lib/abnormal-operations.test.ts"),
    ("file:apps/web/src/lib/abnormal-operations/list-patch-merge.ts", "file:apps/web/src/lib/abnormal-operations/list-patch-merge.test.ts"),
    ("file:apps/web/src/lib/abnormal-operations/parse-list-query.ts", "file:apps/web/src/lib/abnormal-operations/parse-list-query.test.ts"),
    ("file:apps/web/src/lib/abnormal-operations/patch-abnormal-operation.service.ts", "file:apps/web/src/lib/abnormal-operations/patch-abnormal-operation.service.test.ts"),
    ("file:apps/web/src/lib/audit/audit.service.ts", "file:apps/web/src/lib/audit/audit.service.test.ts"),
    ("file:apps/web/src/lib/audit/builders/abnormal-owner-action.ts", "file:apps/web/src/lib/audit/builders/abnormal-owner-action.test.ts"),
    ("file:apps/web/src/lib/audit/builders/discount-applied.ts", "file:apps/web/src/lib/audit/builders/discount-applied.test.ts"),
]

for prod, test in TESTED_BY:
    edges.append({"source": prod, "target": test, "type": "tested_by", "direction": "forward", "weight": 0.5})

# depends_on for component -> UI
edges.append({
    "source": "file:apps/web/src/components/dashboard/AbnormalOperationsManager.tsx",
    "target": "file:apps/web/src/components/ui/Modal.tsx",
    "type": "depends_on",
    "direction": "forward",
    "weight": 0.6,
})

out = {"nodes": nodes, "edges": edges}
with open(OUTPUT, "w", encoding="utf-8") as f:
    json.dump(out, f, ensure_ascii=False, indent=2)

expected_imports = sum(len(v) for v in batch_import.values())
actual_imports = sum(1 for e in edges if e["type"] == "imports")
print(f"nodes={len(nodes)} edges={len(edges)} imports={actual_imports} expected_imports={expected_imports}")
assert actual_imports == expected_imports, f"import mismatch: {actual_imports} != {expected_imports}"
