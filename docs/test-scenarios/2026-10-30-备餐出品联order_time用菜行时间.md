# 本次改动业务场景测试报告：备餐出品联时间用菜行下单时间

日期：2026-10-30  
分支：`fix/prep-ticket-order-time-added-at`  
UAT 基座：`MESA_UAT_BASE=http://localhost:3002` · 店 `restaurant-mohnrib5` · 桌 A-02

## 1. 本次修改

- **内容**：厨显「备餐」打出的档口出品联上的下单时间，改为「这张纸上勾选菜行里最早的下单时刻」，与自动出票、当日菜品列表同一口径；不再误用整单开单时间。
- **文件**：
  - `apps/web/src/lib/table-guest-count.ts`（唯一 `earliestOrderItemAddedAtIso`；`stationTicketOrderTimeIso` 批内过滤后复用）
  - `apps/web/src/lib/station-ticket-prep-enqueue.ts`（备餐入队改用上述 helper）
  - `apps/web/src/lib/table-guest-count.test.ts`、`package.json`（纳入 `test:unit`）
  - `docs/agent-sole-index.zh.md`（sole 一行）
- **角色 / 页面**：后厨备餐出票；当日菜品列表只读对照
- **流程**：同桌先下一轮 → 隔一段时间再加菜 → 只备后一轮 → 任务 `order_time` = 后一轮菜的时间

## 2. 核心业务规则

1. 【本次新增】`station_ticket.order_time` 的 ISO 唯一来自 `earliestOrderItemAddedAtIso`（自动票经批过滤；备餐票经本张勾选行）。
2. 【已实现】当日菜品列表时间 = 行 `added_at`（没有则订单 `created_at`）。
3. 【已实现】开了厨显的档口不下单自动打纸，只在备餐时入队。
4. 【已实现】一张备餐票勾了多轮菜时，票面时间取其中最早那道（与自动票「一批最早」一致）。

## 3. 详细测试场景

### 场景 1：同桌加菜后再备餐 — 票面时间跟加菜行

- **前置状态**：A-02 开台；整单 `created_at≈23:17`；先加 Mojito（23:18）再隔 ≥1 分钟加 Caipirinha（23:19:50）。
- **操作过程**：店主 jar `POST …/staff/kitchen/prep`，只选 Caipirinha `item_index=2`，档口寿司（厨显开）。
- **预期结果**：`print_jobs` `batch_id=prep:…` 的 `order_time=2026-10-30 23:19`；不是整单 `23:17`。
- **数据验证**：本地库任务 `255191bb-…` 行码 `115×1`，`order_time=2026-10-30 23:19`。
- **异常恢复**：测完关台。
- **标签**：【已验证】

### 场景 2：自动出票档口 — 批时间仍用批内最早 added_at（回归）

- **前置状态**：A-02 再开台；加吧台菜 Café（901）。
- **操作过程**：`POST …/station-tickets/auto`。
- **预期结果**：`order_time=2026-10-30 23:20`，与行 `added_at=23:20:58` 到分钟一致。
- **数据验证**：`batch_id=1793402458415-1tf4og`。
- **异常恢复**：关台。
- **标签**：【已验证】

### 场景 3：行无 added_at — 用订单 created_at（兼容）

- **前置状态**：单测构造无 `added_at` 的行。
- **操作过程**：跑 `table-guest-count.test.ts` fallback 用例。
- **预期结果**：回落到 fallback ISO。
- **数据验证**：单测 pass。
- **异常恢复**：无。
- **标签**：【已验证】

### 场景 4：当日菜品列表与备餐票对齐

- **前置状态**：场景 1 之后、关台前。
- **操作过程**：`GET …/staff/dish-history?q=115&table_ids=A-02`。
- **预期结果**：`added_at=2026-10-30T23:19:50.217Z`，到分钟与票面 `23:19` 一致。
- **数据验证**：API 返回一条。
- **异常恢复**：无。
- **标签**：【已验证】

### 场景 5：权限 / 跨角色

- **前置状态**：前台 `qiantai1` 无厨显备餐权限。
- **操作过程**：同 prep body 用 staff jar。
- **预期结果**：401 `unauthorized`（既有）；改用 owner 后成功。
- **数据验证**：证据中 staff prep exit 非 0（已从正式证据区剔除，过程中已观察到）。
- **异常恢复**：owner 重试。
- **标签**：【已验证】（既有鉴权，本改未动）

### 场景 6：并发 / 多行最早

- **前置状态**：单测两行不同 `added_at`。
- **操作过程**：`earliestOrderItemAddedAtIso`。
- **预期结果**：取更早那条。
- **数据验证**：单测 pass。
- **异常恢复**：无。
- **标签**：【已验证】

## 4. 实际测试结果

| 项 | 结果 |
|---|---|
| 清冗余 | **pass** — sole `earliestOrderItemAddedAtIso`；备餐不再裸用 `orders.created_at` 当票面时间 |
| 唯一写法自检 | **pass** — diff 内票面 ISO 只有这一份；`stationTicketOrderTimeIso` 仅批过滤后转发 |
| 单测 `table-guest-count` | **pass**（7） |
| `mesa-local-uat` 场景 1–5 | **pass**（见 `.mesa-agent-gates/fix__prep-ticket-order-time-added-at/uat.md`） |
| lint + typecheck | **pass**（`gate.sh check`） |

## 5. 风险与待确认

- 旧已打出的备餐票不会回写；线上 luckytea 军舰历史错票不在本改回填范围。
- `mesa-local-uat close-session` 助手仍只传 `session_id`，与现 API 要 `table_id` 不一致——本轮用 `POST /api/dashboard/close-table-session` 清理（【设计建议】可另开任务修助手）。
