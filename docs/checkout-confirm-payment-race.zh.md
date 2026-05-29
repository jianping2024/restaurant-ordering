# Checkout `confirm-payment` 并发确认丢失更新（Lost Update）

> **风险等级**：High  
> **状态**：阶段 0–5 已完成（2026-05-29）；阶段 6（发布）待运维  
> **关联路由**：`POST /api/restaurants/{slug}/checkout/confirm-payment`  
> **关联代码**：`src/lib/checkout-confirm-payment.ts`（`confirmBillSplitPayment`，约 L52–92）  
> **推荐方案**：Postgres RPC + `SELECT … FOR UPDATE`（与 `transfer_table_session` / `merge_table_sessions` 一致）

## 问题摘要

`confirmBillSplitPayment` 对 `bill_splits` 执行 **读 → 改 `result` → 按 `id` 写回**，无行锁、无版本校验：

1. `SELECT *` 加载当前 `result`（含各 `paid` 标志）。
2. 在内存中将 `person_index` 对应行标为 `paid: true`，计算 `allPaid` / `finalAmount`。
3. `UPDATE bill_splits SET result = nextResult, status = … WHERE id = billSplitId`（仅此条件）。

当同一 `bill_split_id` 上 **两个不同 `person_index`** 的确认请求几乎同时到达时，两次读取可能都看到「双方均未付」，各自只写入自己的 `paid`，**后写覆盖先写**，导致：

- `bill_splits.result` 中仅保留最后一次确认的 `paid`；
- 另一人显示未付但可能已打小票；
- `all_paid` / `status: paid` / `table_sessions` 关闭时机错误；
- `split_payment` / `final` 小票重复或遗漏。

**根因**：支付状态变更不是原子事务；副作用（打印、关 session）建立在可能已过时的读取结果之上。

## 数据与约束（来自 `docs/ai-schema.md`）

| 实体 | 相关字段 |
|------|----------|
| `bill_splits` | `id`, `restaurant_id`, `result` (jsonb，`SplitResult[]`), `total_amount`, `status`, `session_id`, `table_id`, `display_name`, `order_ids` |
| `table_sessions` | `id`, `status`, `closed_at` |
| `print_jobs` | 由 `enqueueReceiptPrint` 插入，类型含 `order_receipt` |

**说明**：`bill_splits` **无** `updated_at` 列；乐观锁需新增列或比对 `result` 全文，成本高且易碎。**优先 RPC + 行锁**，与仓库内 `merge_table_sessions` 对 `bill_splits` 的 `FOR UPDATE` 模式一致。

**鉴权（不得削弱）**：路由经 `staffAuthFromRequestWithRoles`（waiter/cashier）或 owner；业务层始终带 `restaurant_id` 过滤。RPC 必须为 `SECURITY DEFINER`，入参校验 `restaurant_id` + `bill_split_id` 归属。

## 目标行为

1. 同一 `bill_split_id` 上任意并发确认：**每次成功确认恰好合并一个 `person_index` 的 `paid`**，不丢失其它已付行。
2. 重复确认同一 `person_index`：仍返回 `409 already_paid`（或 RPC 等价错误码）。
3. 仅当 **合并后的** `result` 全部 `paid` 时：将 split 标为 `paid`、更新 `total_amount`、关闭 `table_sessions`（一次）。
4. 打印副作用：仅在 **本次 RPC 实际新标记为 paid** 后入队；避免基于陈旧快照重复打印（阶段 4 细化）。

**范围外**：guest 自助结账 UI、折扣业务规则变更、`bill_splits` 创建/拆分算法、RLS 策略重写。

---

## 分阶段任务

### 阶段 0 — 确认与复现（只读）

| 项 | 内容 |
|----|------|
| **Goal** | 用可重复步骤证明 lost-update；固定修复前基线。 |
| **Files affected** | 无（只读）；参考 `src/lib/checkout-confirm-payment.ts`、`src/app/api/.../confirm-payment/route.ts` |
| **Risk level** | 低 |
| **What will be changed** | 无。 |
| **What must not be changed** | 无。 |
| **Manual tests required** | 见下 |

**操作**

1. 准备测试店：一张桌、一个 `session_id`、一条 `bill_splits`，`result` 至少 2 行且均未 `paid`（例如均分两人）。
2. 使用 waiter/cashier 或 owner 凭证，对同一 `bill_split_id` **并发** 发送两次 `POST .../checkout/confirm-payment`：`person_index: 0` 与 `person_index: 1`（可用 `curl` 并行或脚本 `Promise.all`）。
3. 查询 `bill_splits.result`：修复前常见现象为 **仅一行 `paid: true`**，另一行仍为 `false`，尽管两次 HTTP 均可能 `200`。
4. 可选：查 `print_jobs` 是否出现两条 `split_payment` 但 DB 仅一人 paid。

**不修改代码。**

#### 阶段 0 产出（2026-05-29）

**环境**：本地 `node scripts/phase0-checkout-confirm-race.mjs restaurant-mo9y14xc`（逻辑与 `confirmBillSplitPayment` L52–92 一致；`.env.local` 联调库，非生产）。

**前置**：复用已有 `bill_splits` `8846b5e1-…`（两人均分）；重置为 `status: requested`、两行 `paid: false`。

| 检查项 | 预期（修复前） | 实际 |
|--------|----------------|------|
| 并发 `person_index` 0 与 1 | 两次 HTTP/调用均可 `ok: true` | 两次均 `ok: true`（`elapsed_ms` ≈ 286） |
| `bill_splits.result` 最终状态 | **仅一行** `paid: true`（丢失另一次更新） | 客人 1 `paid: true`，客人 2 `paid: false` |
| `paid_rows_in_db` | `1` | `1` |
| `lost_update_detected` | `true` | `true` |

**并发返回（内存中的 `nextResult`，非 DB 终态）**

- `person_0` 返回：客人 1 paid、客人 2 未付。
- `person_1` 返回：客人 1 未付、客人 2 paid。

**DB 终态**：与 `person_0` 的写入一致，**`person_1` 的 paid 被覆盖丢失**。

复现脚本：`scripts/phase0-checkout-confirm-race.mjs`（会重置目标 split 为未付；仅用于联调店）。

---

### 阶段 1 — RPC 契约与错误码设计

| 项 | 内容 |
|----|------|
| **Goal** | 定义 `confirm_bill_split_payment` 的入参、返回值、异常码，与现有 TS 行为对齐。 |
| **Files affected** | 本文档（本阶段更新契约表）；实施时 `supabase/migrations/<timestamp>_confirm_bill_split_payment.sql` |
| **Risk level** | 低（设计） |
| **What will be changed** | 文档化 RPC 签名；明确与 `ConfirmPaymentResult` 的映射。 |
| **What must not be changed** | HTTP 路由请求/响应 JSON 形状；`SplitResult` 类型字段。 |

**建议 RPC 签名（草案）**

```sql
confirm_bill_split_payment(
  p_restaurant_id uuid,
  p_bill_split_id uuid,
  p_person_index int,
  p_discount_rate numeric default 0
) returns jsonb  -- { ok, all_paid, result, final_amount, session_id, table_id, display_name, order_ids, row_name, row_amount, should_print_split, should_close_session }
```

**错误映射（与现 TS 一致）**

| 条件 | HTTP / code |
|------|-------------|
| split 不存在或非本店 | 404 `bill_split_not_found` |
| `result` 为空 | 400 `empty_split` |
| `person_index` 越界 | 400 `invalid_person_index` |
| 该行已 `paid` | 409 `already_paid` |
| 更新失败 | 500 `bill_update_failed` |
| 关 session 失败 | 500 `session_close_failed` |

**折扣**：在 RPC 内复现 `applyDiscountToRows` 逻辑（`factor = 1 - clamp(rate,0,100)/100`），避免客户端传入已折扣的 `result` 导致双折。

**What must not be changed**

- 不在此阶段改 RLS；不暴露 service role 给浏览器。
- 不改变 `discount_rate` 的 HTTP 语义。

**Manual tests required**

- 设计评审：双人 split、单人 split、`result` 为空、已付再付 — 每场景预期 RPC 返回行。

---

### 阶段 2 — 数据库迁移（原子更新）✅

| 项 | 内容 |
|----|------|
| **Goal** | 在单事务内 `FOR UPDATE` 锁定 split 行，合并 `paid`，写回 `status` / `result` / `total_amount`；必要时在同一事务关闭 session。 |
| **Files affected** | `supabase/migrations/20260531160000_confirm_bill_split_payment.sql`；`docs/ai-schema.md` |
| **Risk level** | 高（资金/结账状态） |
| **What will be changed** | 新增 `public.confirm_bill_split_payment`：`SECURITY DEFINER`、`SET search_path = public`；`SELECT * FROM bill_splits WHERE id = … AND restaurant_id = … FOR UPDATE`；jsonb 数组按 index 设 `paid`；`all_paid` 时 `status = 'paid'`；`UPDATE table_sessions SET status = 'closed', closed_at = now() WHERE id = … AND status <> 'closed'`（或仅当 `all_paid`）。 |
| **What must not be changed** | 既有 `transfer_table_session` / `merge_*` 函数行为；`bill_splits` 列含义；历史 migration 文件。 |
| **Manual tests required** | 见下 |

**实现要点**

- 锁定顺序：仅锁目标 `bill_splits` 一行；若关 session，再锁对应 `table_sessions` 行（`FOR UPDATE`），避免与 transfer/merge 死锁 — 保持锁粒度最小、锁顺序固定（先 split 后 session）。
- `normalizeSplitRows` 边界：若 `result` 为空但 `total_amount > 0`，RPC 与 TS 一致合成单行 `{ name: 'Total', amount }`。
- 授予：`REVOKE` `public`/`anon`；`GRANT EXECUTE` 给 `authenticated`, `service_role`。

#### 阶段 2 产出（2026-05-29）

**迁移**：`supabase/migrations/20260531160000_confirm_bill_split_payment.sql`（已 `supabase db push` 至联调库）。

**验证**：`node scripts/phase0-checkout-confirm-race.mjs restaurant-mo9y14xc --rpc`

| 检查项 | 预期 | 实际 |
|--------|------|------|
| 并发 `person_index` 0 与 1 | DB 两行均 `paid: true` | `paid_rows_in_db: 2` |
| `lost_update_detected` | `false` | `false` |
| `bill_splits.status`（两人付清） | `paid` | `paid` |
| 串行锁顺序 | 两请求均 `ok: true`，响应体为各自提交时快照 | 先完成 index 1 仅客人 2 paid；后完成 index 0 返回两人 paid |

**Manual tests required**（迁移应用后，SQL 或 API）

1. 阶段 0 并发脚本再跑：`result` 中 **两行均为 `paid: true`**。
2. 同一 `person_index` 连点两次：第二次 `409`。
3. 付清最后一人后：`bill_splits.status = 'paid'`，`table_sessions.status = 'closed'`。
4. 跨 `restaurant_id` 的 `bill_split_id`：404/异常，无更新。

---

### 阶段 3 — TypeScript 接入 RPC ✅

| 项 | 内容 |
|----|------|
| **Goal** | `confirmBillSplitPayment` 将读-改-写委托给 RPC；保留纯函数供 UI 预览。 |
| **Files affected** | `src/lib/checkout-confirm-payment.ts` |
| **Risk level** | 中 |
| **What will be changed** | `admin.rpc('confirm_bill_split_payment', …)`；按 `should_print_split` / `should_close_session` 入队小票；移除 TS 内 `bill_splits`/`table_sessions` 直写。 |
| **What must not be changed** | `normalizeSplitRows`、`applyDiscountToRows` 导出；`confirm-payment` 路由 JSON 契约。 |

**Manual tests required**

1. Dashboard / Bill 页各付一人：UI 与 DB 一致，无「付过仍显示未付」。
2. Owner 与 cashier 各测一条确认路径。
3. `discount_rate` 非 0：金额与修复前单次顺序确认一致。

`npm run lint` 已通过。

---

### 阶段 4 — 副作用顺序与打印去重 ✅

| 项 | 内容 |
|----|------|
| **Goal** | 在原子更新 **成功之后** 再 `enqueueReceiptPrint`；避免重复小票。 |
| **Files affected** | `20260531170000_confirm_bill_split_payment_print_flags.sql`；`checkout-confirm-payment.ts`；`order-receipt-enqueue.ts` |
| **Risk level** | 中 |
| **What will be changed** | RPC 增加 `newly_paid`、`should_print_final`；TS 仅在 `newly_paid` 时打印；`print_jobs.payload.idempotency_key` 去重。 |
| **What must not be changed** | 小票展示字段；print agent 解析逻辑（忽略未知 payload 字段）。 |

#### 阶段 4 产出（2026-05-29）

**验证**：`npx tsx scripts/phase4-verify-checkout-print.mts restaurant-mo9y14xc`

| 用例 | 预期 | 实际 |
|------|------|------|
| 并发付两人 | 2×`split:*` + 1×`final` | split=2, final=1 · **通过** |
| 重复 `person_index: 0` | 409；print_jobs 数量不变 | already_paid；3→3 · **通过** |
| 重复 `person_index: 1` | 409；`:split:1` 至多 1 条 | already_paid；key1_jobs=1 · **通过** |

**Idempotency key**：`checkout:{bill_split_id}:split:{index}` / `checkout:{bill_split_id}:final`

---

### 阶段 5 — 自动化回归 ✅

| 项 | 内容 |
|----|------|
| **Goal** | 防止 RPC 折扣/合并逻辑回退。 |
| **Files affected** | `src/lib/checkout-confirm-payment.test.ts`；`checkout-confirm-payment.ts`（导出 `httpStatusForConfirmPaymentRpcCode`）；`package.json`（`test:unit`） |
| **Risk level** | 低 |
| **What will be changed** | 14 项 checkout/idempotency 单测 + 复用既有 append 11 项。 |
| **What must not be changed** | 不新增 npm 依赖（`tsx` 经 `npx` 运行）。 |

**运行**：`npm run test:unit` → **25/25 通过**（2026-05-29）

**覆盖**：`normalizeSplitRows`、`applyDiscountToRows`、`httpStatusForConfirmPaymentRpcCode`、`checkoutReceiptIdempotencyKey`、`confirmBillSplitPayment` RPC 错误映射与成功路径（无打印副作用）。

**并发 DB 行为**：仍由 `scripts/phase3-verify-checkout-confirm.mts` / `phase4-verify-checkout-print.mts` 联调验证（非 CI 单测）。

---

### 阶段 6 — 发布与运维

| 项 | 内容 |
|----|------|
| **Goal** | 先迁移后代码；生产无半部署窗口。 |
| **Files affected** | 部署流程；`docs/ai-schema.md` |
| **Risk level** | 中（部署顺序） |
| **What will be changed** | `supabase db push`（或 CI 迁移）；随后部署 Vercel；更新 schema 文档 RPC 条目。 |
| **What must not be changed** | 不回滚已应用 migration 文件内容；不 force push。 |
| **Manual tests required** | 见下 |

**Manual tests required**

1. 预发/生产：阶段 0 并发脚本在 **一条真实测试 split** 上验证（非高峰）。
2. 观察 `print_jobs` 与收银台 UI 与 `bill_splits.result` 一致。
3. 回归：transfer/merge 桌台后结账流程仍正常。

---

## 备选方案（不优先）

| 方案 | 说明 | 缺点 |
|------|------|------|
| 乐观锁 `updated_at` | `UPDATE … WHERE id = ? AND updated_at = ?` + 重试 | 需新列；`result` jsonb 并发仍易冲突；重试逻辑分散 |
| 仅 TS 重试 | 读 `result` 比对后重试 | 仍非原子；高并发下体验差 |
| 应用层 Redis 锁 | 按 `bill_split_id` 互斥 | 新依赖；多实例需共享 Redis；与 DB 状态仍可能漂移 |

---

## 验收标准（全部阶段完成后）

- [ ] 并发确认不同 `person_index`：`bill_splits.result` 保留 **所有** 已确认行的 `paid: true`。
- [ ] 重复确认同一 index：`409 already_paid`，`result` 不变。
- [ ] 全部付清：`status = paid`，session `closed`，`final` 小票至多一次（业务规则允许时）。
- [ ] 租户隔离：`restaurant_id` 不匹配时无法更新他店 split。
- [ ] `npm run lint` 通过；触及 API/类型时 `npm run build` 通过。

---

## 参考代码位置

```52:92:src/lib/checkout-confirm-payment.ts
  const { data: split, error: loadErr } = await admin
    .from('bill_splits')
    .select('*')
    ...
  const { error: billErr } = await admin
    .from('bill_splits')
    .update({
      status: allPaid ? 'paid' : 'requested',
      total_amount: allPaid ? finalAmount : bill.total_amount,
      result: nextResult,
    })
    .eq('id', billSplitId);
```

现有行锁先例：`transfer_table_session` 中对 `table_sessions` / `bill_splits` 的 `FOR UPDATE`（`supabase/migrations/20260530100000_restaurant_tables_model.sql`）。
