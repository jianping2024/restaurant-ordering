# 转台与并台实施方案

> **标识模型：** 桌位身份为 `table_id`（UUID），界面展示为 `display_name`（如 `A-01`）。  
> 总设计见 [餐厅桌位模型设计](./restaurant-tables-design.zh.md)。本文描述转台 / 并台 / 关台在 **`table_id` 模型下** 的行为与 RPC 改造；实施前需先完成桌位 migration。  
> **并台产品规则已定稿，见 [并台产品规则](./table-merge-product.zh.md)**（本文 §并台 为旧实现说明；新并台以该文档为准）。

---

## 范围

本文定义转台与并台功能的简化实现方案，目标是：

- 以「当前状态正确」为第一优先
- 并台后自动形成单账单流
- 最小化数据结构变更（在 `table_id` 模型上仅改 RPC 参数与关联字段）
- 通过后端原子操作避免半成功状态

## 业务规则

### 转台

- 将 **来源桌**（`from_table_id`）的一个活跃餐次迁移到 **目标桌**（`to_table_id`）。
- 目标桌不能已有活跃餐次（`uniq_active_table_session` 约束 `(restaurant_id, table_id)`）。
- 会话、关联订单、活跃结账请求须一并更新 **`table_id`**；活跃行的 **`display_name` 快照** 更新为目标桌当前显示名（看板与小票一致）。

### 并台

- 将来源桌活跃餐次并入目标桌活跃餐次。
- 来源桌与目标桌都必须有活跃餐次，且 **`table_id` 不同**。
- 来源订单改挂到目标 **`session_id`**，并更新为目标桌的 **`table_id` + `display_name` 快照**。
- 来源会话关闭并记录并台关系。
- 结账流收敛为目标会话下的一条活跃账单流。

### 关台（服务员 / 老板）

- 按 **`table_id`** 定位活跃 `table_sessions`；逻辑与旧版一致，不涉及桌位字符串。

---

## 数据模型

### 复用表

- `restaurant_tables` — 校验 `table_id` 属于本店且 **`deleted_at IS NULL`**
- `table_sessions` — 关联 **`table_id`**（无 `table_number`）
- `orders` — 关联 **`table_id`** + **`display_name` 快照**
- `bill_splits` — 关联 **`table_id`** + **`display_name` 快照**

### 会话扩展字段（已有）

- `table_sessions.merge_into_session_id`（可空 UUID）
- `table_sessions.closed_reason`（可空文本）

### `closed_reason` 常见取值

- `merged`：并台时关闭**来源桌**会话。
- `waiter_closed`：服务员在观察页对当前桌点击 **「关台」** 结束餐次。
- 老板在后台确认收款关台时，会话标记为 `closed`（实现上可不依赖 `closed_reason` 区分）。

### 约束（桌位 migration 后）

- 活跃餐次唯一：`UNIQUE (restaurant_id, table_id) WHERE status IN ('open', 'billing')`
- RPC 入参 `table_id` 须通过 FK / 查询校验：存在、本店、未软删

---

## 后端操作设计

采用三个 RPC 作为原子写入边界（**参数由 text 桌号改为 UUID `table_id`**）：

| RPC | 新签名（定稿） |
|-----|----------------|
| 转台 | `transfer_table_session(p_restaurant_id uuid, p_from_table_id uuid, p_to_table_id uuid) returns uuid` |
| 并台 | `merge_table_sessions(p_restaurant_id uuid, p_source_table_id uuid, p_target_table_id uuid) returns uuid` |
| 多源并台 | `merge_multiple_table_sessions(p_restaurant_id uuid, p_source_table_ids uuid[], p_target_table_id uuid) returns uuid` |

**权限：** 仅 `authenticated`（staff / owner）；**不**授予 `anon`（与现网一致）。

### 转台流程

1. 校验 `p_from_table_id`、`p_to_table_id` 均属于 `p_restaurant_id` 且未软删；二者不相等。
2. 读取目标桌当前 `display_name`（`v_target_display`）。
3. 锁定来源桌活跃会话（`table_id = p_from_table_id`，`status IN ('open','billing')`）`FOR UPDATE`。
4. 校验目标桌 **无** 活跃会话。
5. 更新来源会话：`table_id = p_to_table_id`。
6. 更新关联 **活跃** 订单：`table_id = p_to_table_id`，`display_name = v_target_display`（条件：`session_id` 匹配或为空且原 `table_id` 为来源桌，状态 `pending/cooking/done`）。
7. 更新关联 **活跃** `bill_splits`：同上字段（状态 `pending/confirmed/requested`）。
8. 返回来源会话 `id`（迁移后仍为目标桌上的同一会话）。

### 并台流程

1. 校验来源 / 目标 `table_id`；读取目标桌 `display_name`（`v_target_display`）。
2. 锁定来源与目标活跃会话 `FOR UPDATE`。
3. 将无 `session_id` 的 orphan `bill_splits` 先挂到对应会话（与现逻辑一致）。
4. 来源 **活跃** 订单：`session_id = 目标会话`，`table_id = p_target_table_id`，`display_name = v_target_display`。
5. 合并双方活跃 `bill_splits`（`order_ids` / `persons` / `result` / `total_amount` 逻辑不变）；残余 split 的 `table_id` / `display_name` 同步为目标桌。
6. 关闭来源会话：`status = closed`，`closed_at = now()`，`closed_reason = merged`，`merge_into_session_id = 目标会话 id`。
7. 返回 **目标会话** `id`。

### 多源并台

- 对 `p_source_table_ids` 逐元素调用 `merge_table_sessions(..., source_id, p_target_table_id)`（顺序与现实现相同）。
- 任一来源失败则整事务回滚。

---

## 顾客端：并台后的 URL

来源桌 session 关闭后，顾客若仍停留在来源桌 QR（`?table_id=来源UUID`）的 menu / bill 页：

- **账单页**（`bill/page.tsx`）检测到来源 session 已 `merged` 且存在 `merge_into_session_id` 时，应 **redirect** 到目标桌：`/{slug}/menu?table_id={目标 table_id}`（或 bill 等价路径）。
- 不再通过改「字符串桌号」跳转；**只认 `table_id`**。

---

## 前端实施计划

### 主要入口

| 入口 | 文件 |
|------|------|
| 老板后台桌位管理 | `src/components/dashboard/TablesManager.tsx` |
| 服务员桌卡详情 | `src/components/waiter/WaiterTableDetail.tsx` |
| 服务员 API | `src/app/api/restaurants/[slug]/staff/waiter/tables/action/route.ts` |

### 交互设计

- 活跃餐次列表：展示 **`display_name`**，内部携带 **`table_id`**。
- 「转台」「并台」：来源 / 目标选择器展示 **display_name**，提交 RPC 时传 **`table_id`**。
- 确认弹窗：与项目统一 **Modal** 风格（参见桌位软删确认）；并台须明确 **不可逆** 提示。
- 服务员看板桌卡链接：`/{slug}/waiter/[tableId]`（UUID 路径段）。

### 数据加载

- 桌位列表来自 **`restaurant_tables`**（`deleted_at IS NULL`），不再读 `restaurants.table_numbers`。
- 活跃 session 查询按 **`table_id`** 聚合；看板分组键为 **`table_id`**，标签为 **display_name**。

---

## 一致性策略

- 通过 RPC 避免前端串行多次写入造成中间态。
- 对会话状态变化采用乐观失败提示：
  - 「桌台状态已变化，请刷新后重试。」
- 操作成功后立即刷新活跃餐次数据。
- **不**再依赖 `orders.session_id IS NULL` 的兼容路径（桌位 migration 后业务数据已清空）。

---

## 服务员关台与看板可见性

### 后厨 / 服务员看板上的订单范围

- 两页在**员工完成 Supabase Auth 登录并进入看板后**，订阅 Supabase Realtime（`orders`、`table_sessions`），并在进入时拉取最新数据。
- **仅展示仍挂在活跃餐次上的订单**：`table_sessions.status` 为 `open` 或 `billing` 时，对应 `orders.session_id` 的订单会出现在看板。
- 餐次一旦关闭（结账、并台来源桌、服务员关台等），这些订单不再满足「活跃会话」条件，**从后厨与服务员看板消失**。

### 服务员「关台」

- 入口：`/[slug]/waiter` 桌卡上的「关台」（与「转台」「并台」并列）。
- **显示条件**：该桌汇总上 **没有「制作中」、没有「可端菜」**。
- **效果**：将本桌（`table_id`）当前活跃 `table_sessions` 更新为 `closed`，`closed_reason = waiter_closed`；不迁移订单行，仅结束会话。

---

## 验证清单

功能验证：

- 转台后 session / orders / bill_splits 的 **`table_id` 一致** 为目标桌，**`display_name` 快照** 为目标桌当前显示名。
- 并台后仅保留一个活跃会话与一条活跃账单流；来源 session `closed_reason = merged`。
- 顾客在来源桌 URL 打开 bill 时，**自动 redirect** 到目标 `table_id`。
- 并台 / 转台后，厨房与服务员看板按 **display_name** 显示、按 **table_id** 分组，无重复列或丢单。

并发验证：

- 同一来源桌的并发操作不会产生重复活跃状态（`uniq_active_table_session`）。
- 第二个冲突操作友好失败并提示刷新。

跨页面验证：

- 顾客端 menu / bill、后厨看板、服务员看板均反映操作后状态。
- 服务员「关台」后，该桌订单从看板消失；顾客用同一 QR（`table_id` 未变）可 **新开餐次** 点单。

边界：

- 来源或目标桌已 **软删**（`deleted_at` 非空）时 RPC 拒绝。
- 目标桌 display_name 与来源不同并台后，来源订单在 UI / **新打印** 上显示 **目标 display_name**；`print_jobs.payload` 含 **`table_id`（目标 UUID）+ `display_name`（快照）**，纸面 **只印 display_name**（见 [`restaurant-tables-design.zh.md`](./restaurant-tables-design.zh.md) §8）。

### 打印 payload（转台 / 并台后）

- 转台或并台后新入队的 **`station_ticket` / `order_receipt` / `pre_bill`**：`payload` **成对含** 目标桌 **`table_id` + `display_name` 快照**。
- Agent **只打印 `display_name`**；`table_id` 用于日志与队列筛选。
- 并台 **之前** 已入队、尚未打印的任务：仍用 **入队时快照**（不 retroactive 改 payload）。

完整手工用例见 [table-transfer-merge-acceptance.md](./table-transfer-merge-acceptance.md)。

---

## 上线说明

- 在桌位 migration（`restaurant_tables` + 业务表 `table_id`）与 RPC 替换 **之后** 再启用 UI。
- 与 [restaurant-tables-design.zh.md](./restaurant-tables-design.zh.md) **同步发版**；旧 `?table=字符串` 与 text 参数 RPC 不保留。
- 后续如有需要可加 feature flag 做灰度控制。

---

## 后续可选增强

- 并台前预览（菜品数量、金额变化）
- 最近一次操作短时撤销
- 结构化操作审计日志表（记录 `from_table_id` / `to_table_id` / 操作人）

---

**版本：** 2026-05-26（对齐 `table_id` + `display_name` 桌位模型 v2）
