# 业务规则

> **状态**：阶段 3 已填充（2026-06-30）  
> **读者**：产品、开发、AI 代理

## 用途

集中定义状态规则、数据口径与异常处理边界。**代码变更涉及下列规则时，须同步更新本文档。**

---

## 1. 桌位状态规则

### 数据事实

- `restaurant_tables` **无**独立 `status` 列；桌位仅有 `display_name`、`sort_order`、`deleted_at`
- 活跃餐次：`table_sessions` 中 `status IN ('open','billing')` 且同一 `(restaurant_id, table_id)` 最多一条（`uniq_active_table_session`）

### 展示状态（推导）

| 看板表现 | 判定条件 |
|----------|----------|
| 空闲 | 无活跃会话，或会话无订单行且无 buffet |
| 用餐中 | 活跃 `open` 会话，有 menu 行或 buffet_base |
| 待结账 | 存在 `bill_splits.status='requested'` 或会话 `billing` |
| 已删除 | `restaurant_tables.deleted_at IS NOT NULL`，不参与新业务 |

### 硬规则

1. **`table_id`** 为稳定 UUID；**`display_name`** 为唯一纸面桌名（1–16 字符）
2. **禁止**恢复 `table_number` 或纸面打印 UUID
3. 订单/分单/打印 payload 须同时带 `table_id` + `display_name` 快照
4. 转台/并台/关台须原子 RPC，禁止只改 `table_sessions` 一行
5. **并台**：来源桌与目标桌均不得处于待结账（与看板 `checkout` 判定一致）；目标选择列表不展示待结账桌；API 双端校验，禁止并入或并出结算中会话
6. **停用桌位（软删）**：须 `PasswordConfirmDialog` 输入当前登录密码；服务端 `verifyStaffPassword` 通过后才执行；支持 `table_ids` 批量（整批原子：任一桌有 `open`/`billing` 会话则全部不删）
7. **桌位设置保存**：仅提交有改动的桌位（桌号 / 座位范围）；服务端在合并后校验全店 `display_name` 唯一；新增、停用桌位仍走独立 API

### 相关代码

`lib/restaurant-tables.ts`、`lib/waiter-table-occupancy.ts`、`lib/table-checkout-pending.ts`、`docs/restaurant-tables-design.zh.md`

---

## 2. 订单状态规则

### 订单级 `orders.status`

| 值 | 含义 |
|----|------|
| `pending` | 厨房相关行均为 pending，或全 void 后的空厨房列 |
| `cooking` | 至少一行 `cooking` 或 `done`，且未全部完成 |
| `done` | 厨房相关行均为 `done` 或 `voided`；或仅含 buffet_base |

### 推导规则（`deriveOrderStatusFromItems`）

1. **厨房相关行** = 非 `buffet_base` 的 menu 行（`kitchenRelevantItems`）
2. 无厨房行但有 `buffet_base` → 订单 `done`（厨房列不展示）
3. 厨房行全 `voided` → 订单 `pending`
4. 厨房行全 `done|voided` → 订单 `done`
5. 存在 `cooking` 或 `done` → 订单 `cooking`
6. 否则 → `pending`

### 硬规则

- 订单 status **不得**与 items 手动脱节；持久化前须 `deriveOrderStatusFromItems`
- `orders.items` 为 JSONB 真相源；`total_amount` 须与有效行一致
- 订单绑定 `session_id`、`table_id`、`display_name` 快照

### 相关代码

`types/index.ts`、`lib/order-status.ts`、`lib/order-items.ts`

---

## 3. 菜品状态规则

### 菜单侧（`menu_items`）

| 字段 | 规则 |
|------|------|
| `available` | `true` 可加菜；`false` 顾客不可见/不可点 |
| `active`（分类） | 分类层级控制 |

### 订单行侧（`orders.items[]`）

| `item_status` | 含义 |
|---------------|------|
| `pending` | 待厨房处理 |
| `cooking` | 制作中 |
| `done` | 已出餐 |
| `voided` | 已退菜 |

### 推导与兼容

- 旧数据无 `item_status` 时，按订单 `status` fallback（`normalizeOrderItemStatus`）
- `kind=buffet_base` 为自助餐人头行，服务员不可 decrement

### 硬规则

- 退菜必须 `voided` + 原因（厨房/减至 0）
- void 行不参与分单金额加总（过滤 voided）
- 厨房 void `done` 行 → 高风险异常

### 相关代码

`lib/order-item-void/*`、`lib/resolve-append-cart-items.ts`、`components/kitchen/KitchenDisplay.tsx`

---

## 4. 今日菜单规则

### 定义

**「今日菜单」= 当前时刻 `menu_items.available === true` 的菜品集合。**

- **不是**按自然日自动重置的日结菜单
- **不是**独立「今日菜单」表或计划任务

### 行为

| 操作 | 效果 |
|------|------|
| 店主下架（`available=false`） | 立即从顾客菜单消失；append 拒绝 |
| 重新上架 | 立即恢复可点 |
| 删除菜品 | 软逻辑删除或 unavailable，历史订单仍保留名称快照 |

### 硬规则

- 加菜价格与可点性以 **append 时服务端查询** 为准
- 下架不影响已在订单中的行（除非 void）

### 相关代码

`components/dashboard/MenuManager.tsx`、`lib/resolve-append-cart-items.ts`

---

## 5. 退菜规则

### 操作入口

| 入口 | 允许状态 | 须原因 |
|------|----------|--------|
| 后厨 void | 任意非 voided | 是 |
| 前台 decrement | `pending`/`cooking` | qty→0 时必填 |
| 服务员 decrement | — | **禁止**（菜单减菜仅前台；自助餐改人数走 buffet API） |
| 强制关台 | 批量 void | 系统原因 |

### 风险等级（`riskLevelForVoidedItem`）

| 原 `item_status` | 风险 |
|------------------|------|
| `pending` | LOW |
| `cooking` | MEDIUM |
| `done` | HIGH |

### 审计

- 每次 void / 减至 0 写 `operation_logs`
- **后厨** void 创建 `abnormal_operations` 类型 `ITEM_DELETED`（按原 `item_status` 定风险）
- **服务员** decrement 减至 0 写 `ITEM_VOIDED`，不进异常队列 → **已废止**：服务员不可菜单 decrement
- **前台** decrement 减至 0 写 `ITEM_VOIDED`，不进异常队列

### 硬规则

- 自助餐 `buffet_base` 行不可通过 decrement 删除（须改人数流程）
- `billing` 会话下前台不可 void/decrement（服务员同样不可）
- void 后必须重算 `orders.status` 与 `total_amount`

### 相关代码

`lib/order-item-void/decrement-order-item.service.ts`、`lib/audit/builders/item-deleted.ts`、`lib/abnormal-operations.ts`

---

## 6. 结账规则

### 会话状态

| 状态 | 允许操作 |
|------|----------|
| `open` | 加菜、配置分单、首次呼叫结账 |
| `billing` | 确认收款、折扣（无收款前）、恢复点餐、强制关台；**禁止**加菜、转台、并台、服务员自助餐变更 |
| `closed` | 只读历史 |

### 分单状态机

```text
pending / confirmed ──(顾客确认分单)──→ requested
requested ──(逐人收款)──→ result[].paid=true
requested ──(全员付清 RPC)──→ paid（整单）
pending|confirmed|requested ──(强制关台)──→ cancelled
```

- **队列定义**：`bill_splits.status='requested'` 驱动结账台与 nav badge
- **呼叫结账 RPC** 同时将 `table_sessions.status` 设为 `billing`

### 收款规则

1. **本次应收** = 该人折后应付 − `session_collected_payments` 中该人累计
2. **摘要待收** = 折后应收合计 − 已收台账合计
3. 确认收款走 `confirm_bill_split_payment` RPC（原子、防并发）
4. 有收款记录后：**禁止**丢失 `session_collected_payments`；折扣通常禁用

### 折扣

- `apply-discount` 写 `bill_splits.discount_rate` + 原因
- 折扣率 ≥10% MEDIUM、≥30% HIGH 异常风险
- 须记 `DISCOUNT_APPLIED` 审计

### 恢复点餐（`resume_table_session_ordering`）

| 分单模式 | 零收款 | 有收款 |
|----------|--------|--------|
| `by_item` | 保留 `confirmed` 快照，顾客可改 | 锁定已付行人菜品行 |
| `even`/`custom` | 可撤销 request | 保留分单与已收 |

- 整桌已付清 → 禁止恢复（`whole_table_paid`）

### 关台（付清 vs 强制）

| 路径 | 条件 | 结果 |
|------|------|------|
| 正常付清 | RPC `should_close_session` | `paid` + session `closed` |
| 强制关台 | `confirm_close: true` | 未付 split→`cancelled`；订单 void；session `closed` |

### 相关代码

`lib/checkout-request-server.ts`、`lib/checkout-confirm-payment.ts`、`lib/checkout-split-continuation.ts`、`supabase/migrations/*checkout*rpc*.sql`、`docs/table-session-close.zh.md`

---

## 7. 打印规则

### 任务类型

| `print_jobs.type` | 触发 |
|-------------------|------|
| `station_ticket` | 加菜自动 |
| `pre_bill` | 自动账单 variant `pre_bill` |
| `order_receipt` | `split_payment`、`final`、`checkout_bill` 等 |

### 任务状态

`pending` → `processing` → `done` | `failed`（可 retry）

### 自动 vs 手动

| variant | `bill_receipt_print` 门控 |
|---------|---------------------------|
| `pre_bill`、`split_payment`、`final` | 受开关限制 |
| `checkout_bill`（手动打印账单） | **不受**限制 |
| `station_ticket` | **不受**限制 |

### 硬规则

1. 打印成功/失败 **不**改变订单/会话/分单状态
2. 纸面语言：`restaurants.print_locale`（默认 `pt`）
3. 租户隔离：代理 JWT 仅访问本店 `print_jobs`
4. 幂等：checkout 类 receipt 有 idempotency key（bill_split + person_index）
5. 无代理时允许 HTML 打印兜底，不替代主路径设计

### 相关代码

`lib/order-receipt-enqueue.ts`、`lib/station-ticket-enqueue.ts`、`lib/restaurant-features.ts`、`docs/print-agent-flow.zh.md`

---

## 8. 分单规则

### 模式

| `split_mode` | 规则 |
|--------------|------|
| `even` | N 人均分；**分币+余分**在此阶段完成（`allocateEvenAmounts`）；`sum(result)=total` 精确到分 |
| `by_item` | 每行（含自助餐）按份额 **分币+余分**；各 `result.amount` 为各行分摊之和 |
| `custom` | 手动录入各人 amount；末人吸收余额；`sum(result)=total` 精确到分 |

### 折扣（`checkout-split-math`）

- 折后各行：`round(折前[i] × (1−率))`，**不再二次分摊余分**
- 汇总栏应付：`round(total × (1−率))`；可能与 `sum(折后[i])` 差几分，**关台以各 index 台账为准**
- 已有收款台账时折扣锁定

### 收款台账

- `session_collected_payments.person_index` 为结算主键；`person_name` 仅展示
- 待收[i] = 折后[i] − 台账[i]；RPC 拒绝超收与重复收满
- 续结时 **保留已有 result 行顺序**（`merge_split_result_with_ledger`），按名更新金额、新名追加末尾

### 校验（`validateBillSplit`）

| 错误码 | 条件 |
|--------|------|
| `unassigned_items` | by_item 有行未分配 |
| `incomplete_qty` | 份额不足 |
| `amount_mismatch` | 各人合计 ≠ 消费总额（**精确到分**） |

### 续结与锁定（`checkout-split-continuation`）

- **零收款**：可切换模式、可改 by_item 分配
- **有收款**：模式锁定；by_item 已付消费者行只读
- 恢复点单后新菜可分配，不得修改已锁定行

### 硬规则

- 单会话同时仅一条活跃 split：`pending|confirmed|requested`
- `merge_split_result_paid` 保留已付 result 行
- 顾客可选葡语 NIF（`customer_nif`），校验 `parsePortugueseNif`

### 相关代码

`lib/bill-split-by-item.ts`、`lib/bill-split-validate.ts`、`lib/checkout-split-continuation.ts`

---

## 9. 经营分析数据口径

### 统计单元

- **驱动表**：`table_sessions` 且 `status='closed'`
- **时间窗**：页面选 7d/30d；按 **Lisbon** 自然日解析 `closed_at`
- **最大范围**：近 30 天 closed session（控制 DB 压力）

### 会话准入（`isQualifyingSession`）

满足其一即纳入：

1. 存在 `bill_splits.status='paid'`
2. 或 `orders.total_amount` 合计 > 0

### 营业额（`sessionRevenue`）

1. **优先**：`paid` 的 split 中 `result[].paid=true` 的 amount 之和
2. **回退**：`paid` split 的 `total_amount`
3. **无 paid split**：该会话 `orders.total_amount` 之和
4. 金额经 `auditMoney` 四舍五入

### 客数

- 来自会话订单中 active `buffet_base` 的成人/儿童数（`aggregateBuffetForOrders`）
- 无 buffet 行 → 0

### 菜品聚合

- 排除 `voided` 行
- 排除/特殊处理 `buffet_base`（`isBuffetBaseItem`）
- **备货参考**：永远最近 7 天销量，与页面 range 解耦

### 硬规则

- API **仅 owner**；客户端不可传 `restaurant_id`
- 只读，不写快照表
- 与营业主流程解耦（不改变订单/结账）

### 相关代码

`lib/analytics/analytics.service.ts`、`lib/analytics/qualifying.ts`、`docs/value-analytics-design.zh.md`

---

## 10. 异常数据处理规则

### 类型（`abnormal_operations.type`）

| 类型 | 触发 |
|------|------|
| `DISCOUNT_APPLIED` | 结账折扣超阈值 |
| `ITEM_DELETED` | 退菜/void |
| `UNPAID_TABLE_CLOSED` | 强制关台且存在未付分账 |

### 风险等级

| 来源 | 规则 |
|------|------|
| 退菜 | 见 §5 按原 item_status |
| 折扣 | rate≥10% MEDIUM，≥30% HIGH |

### 状态机

| `status` | 可转向 |
|----------|--------|
| `PENDING` | `CONFIRMED`、`IGNORED` |
| `CONFIRMED` | `IGNORED` |
| `IGNORED` | `CONFIRMED` |

### 处理规则

1. **仅店主**可 PATCH 确认/忽略
2. 确认须写 `confirmed_by`、`confirmed_at`、`owner_note`（可选）
3. 异常记录 **不自动阻断** 现场操作；用于事后对账
4. 须关联 `operation_logs`（`source_action_id` 可选）

### 硬规则

- 不可非法状态跳转（`canTransitionAbnormalStatus`）
- 列表按日期范围筛选，Lisbon 日历对齐异常模块

### 相关代码

`lib/abnormal-operations/owner-query.ts`、`lib/abnormal-operations/types.ts`、`components/dashboard/AbnormalOperationsManager.tsx`

---

## 状态对照总表

| 实体 | 状态值 | 文档章节 |
|------|--------|----------|
| `table_sessions` | open / billing / closed | §1、§6 |
| `bill_splits` | pending / confirmed / requested / paid / cancelled | §6、§8 |
| `orders` | pending / cooking / done | §2 |
| `orders.items` | pending / cooking / done / voided | §3、§5 |
| `menu_items` | available boolean | §4 |
| `print_jobs` | pending / processing / done / failed | §7 |
| `abnormal_operations` | PENDING / CONFIRMED / IGNORED | §10 |

---

## 相关文档

- 用户流程：[`03-user-flows.md`](./03-user-flows.md)
- Schema：[`../ai-schema.md`](../ai-schema.md)
- 桌位身份：[`../restaurant-tables-design.zh.md`](../restaurant-tables-design.zh.md)
