# 桌位模型实施进度

> 设计定稿：[`restaurant-tables-design.zh.md`](./restaurant-tables-design.zh.md)  
> 开始：2026-05-26

## 阶段总览

| # | 阶段 | 状态 | 说明 |
|---|------|------|------|
| 1 | DB migration + 清业务数据 | ✅ 完成 | `20260530100000_restaurant_tables_model.sql` |
| 2 | `restaurant-tables.ts` + 类型 | ✅ 完成 | 已删 `restaurant-table-numbers.ts` |
| 3 | RPC / RLS | ✅ 完成 | 含在 migration |
| 4 | API 路由 | ✅ 完成 | append、receipt、buffet、waiter、kitchen board |
| 5 | 页面与组件 | ✅ 完成 | menu/bill、看板、TablesManager |
| 6 | 打印 payload + print-agent | ✅ 完成 | Web 入队 + agent **v0.2.27** |
| 7 | Demo / seed | ⏳ 待核对 | `supabase/seed.sql` 若仍写 `table_numbers` 需改 |
| 8 | 构建验证 | ✅ 完成 | `npm run build` 通过 |
| 9 | 远端 migration | ✅ 完成 | `20260530100000_restaurant_tables_model.sql` 已 push |

图例：✅ 完成 · 🔄 进行中 · ⏳ 待做

**部署前：** 在目标库执行 `supabase db push`（或应用 migration），会 **清空** 订单/餐次/打印队列等业务数据。

---

## 1. 数据库（阶段 1）— ✅

- [x] Truncate：`print_jobs`、`dish_feedback`、`feedback_sessions`、`bill_splits`、`orders`、`table_sessions`
- [x] 新建 `restaurant_tables`（`deleted_at`、部分唯一 `(restaurant_id, display_name)`）
- [x] 为现有餐厅 seed **A-01…A-10**
- [x] `table_sessions` / `orders` / `bill_splits`：`table_id` + `display_name`，drop `table_number`
- [x] `uniq_active_table_session` → `(restaurant_id, table_id)`
- [x] Drop `restaurants.table_numbers`、`rename_restaurant_table_number`
- [x] 重建 `restaurants_public`（无 `table_numbers`）
- [x] `print_jobs` 生成列：`table_display`、`table_id`
- [x] RPC：`transfer_table_session` / `merge_*`（UUID + display 快照）
- [x] Trigger：新店 seed 10 桌
- [x] RLS：`restaurant_tables`

---

## 2. 应用代码 — ✅（除 seed 核对）

### 2.1 库与类型

- [x] `src/lib/restaurant-tables.ts`
- [x] `src/types/index.ts`
- [x] 删除 `src/lib/restaurant-table-numbers.ts`

### 2.2 API

- [x] `orders/append`（`table_id` + 校验活跃桌）
- [x] `order-receipt/print`
- [x] `staff/waiter/buffet`、`sessions/close`、`tables/action`
- [x] `staff/kitchen/board`、`kitchen/orders/[orderId]`

### 2.3 页面路由

- [x] `[slug]/menu?table_id=`
- [x] `[slug]/bill?table_id=`（并台 redirect）
- [x] `[slug]/waiter/[tableId]`
- [x] demo 路由

### 2.4 组件

- [x] `TablesManager`（CRUD、软删 Modal、转并台 UUID）
- [x] `WaiterDisplay` / `KitchenDisplay` / `WaiterTableDetail`
- [x] `MenuPage` / `BillPage`
- [x] `OrdersHistoryManager` / Dashboard 筛选

### 2.5 打印

- [x] `station-ticket-enqueue.ts`、`order-receipt-enqueue.ts`
- [x] `PrintJobsQueuePanel`（`table_display`）
- [x] `apps/print-agent` **0.2.27**（`display_name` 印纸，`table_id` 仅日志）

---

## 变更日志

| 日期 | 内容 |
|------|------|
| 2026-05-26 | 创建进度文件；migration + 全应用改造 + print-agent；`npm run build` 通过 |
| 2026-05-26 | 修复 migration：`TRUNCATE … CASCADE`；`gen_random_uuid()`；先 `DROP VIEW restaurants_public` 再 drop 列；**远端 `supabase db push` 成功** |

---

## 待办（可选）

- [x] 远端执行 `supabase db push`（2026-05-26 已成功）
- [ ] 核对 `supabase/seed.sql`、admin create-restaurant 与 trigger 不重复插桌
- [ ] TablesManager 删桌 i18n 专用文案（当前英文 fallback）
- [ ] 手工验收：[`table-transfer-merge-acceptance.md`](./table-transfer-merge-acceptance.md)
