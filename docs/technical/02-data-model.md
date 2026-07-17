# 数据模型

> **状态**：阶段 5 已填充（2026-06-30）  
> **读者**：开发、AI 代理

## 用途

业务实体、关系与关键约束的可读说明。  
**SQL 真相源**：`supabase/migrations/`；紧凑索引：[`../ai-schema.md`](../ai-schema.md)。

---

## 租户根：餐厅

### `restaurants`

| 字段（要点） | 说明 |
|--------------|------|
| `slug` | 唯一，URL 与 API 路径 |
| `owner_id` | 店主 Auth 用户 |
| `plan` | `free` \| `pro`（桌位等限制） |
| `feature_flags` | jsonb，如 `kitchen_board`、`bill_receipt_print` |
| `print_locale` | `zh` \| `en` \| `pt`，票面语言 |
| `country_code` | ISO-2，与票面语言解耦 |
| `print_agent_config` | jsonb，代理 TTL、schedule 等 |
| `geo_*`、`order_radius_meters` | 顾客点餐地理围栏 |
| `suspended_at` | 暂停营业 |

**视图** `restaurants_public`：顾客可见字段，无密码。

---

## 桌位与会话

### `restaurant_tables`

- `id`（UUID）= **`table_id`**，稳定身份
- `display_name`：1–16 字符，纸面与 UI 展示
- `deleted_at`：软删，不参与新业务

### `restaurant_table_groups` + `restaurant_table_group_members`

- 分组命名；每桌最多属于一组（`UNIQUE (restaurant_id, table_id)`）

### `table_party_groups` + `table_party_group_members`

- 服务员看板「同行组」运行时标记（客人一起）；与楼面分组正交；组内桌不可自己发起转台/并台，组外并台目标排除组内桌
- 每桌最多属于一个同行组；仅开台用餐中（看板 `dining`）可加入；展示归属优先于待结账置顶
- 同店组名唯一（`lower(btrim(name))`）；创建后可改名（失焦提交）
- 关台成功后清除该桌成员关系（空组不自动解散）

### `table_sessions`

| 字段 | 说明 |
|------|------|
| `status` | `open` \| `billing` \| `closed` |
| `table_id` | 当前桌位 |
| `merge_into_session_id` | 并台来源追踪 |
| `closed_reason` | 如 `merged`、`waiter_closed`、`auto_nightly` |
| `opened_by_user_id` / `closed_by_user_id` | 操作人 |

**约束**：`(restaurant_id, table_id)` 在 `open|billing` 时唯一（`uniq_active_table_session`）。

---

## 订单

### `orders`

| 字段 | 说明 |
|------|------|
| `session_id` | 餐次 |
| `table_id` + `display_name` | 快照（转台后更新） |
| `status` | `pending` \| `cooking` \| `done`（由 items 推导） |
| `items` | **jsonb 数组**，订单行真相源 |
| `total_amount` | 与有效行合计一致（触发器维护） |

### `orders.items[]` 行结构（逻辑模型）

| 字段 | 说明 |
|------|------|
| `id` | menu_item_id 或合成 key |
| `kind` | `menu` \| `buffet_base` 等 |
| `name_*`、`price`、`qty` | 快照 |
| `item_status` | `pending` \| `cooking` \| `done` \| `voided` |
| `void_reason` | 退菜原因 |

无独立 `order_items` 表；经营分析、分单、厨房均读 JSONB。

---

## 菜单

### `menu_categories`

树形：`parent_id`；`print_station_id`；`item_code`；多语言 `name_*`。

### `menu_items`

价格、`vat_rate`、`available`（上下架）、`category_id`、`print_station_id`、`image_url`（Storage）。

### `print_stations`

每店多行；`name_pt/en/zh` 展示名；`sort_order` 排序。类目/菜品通过 `print_station_id` 绑定出品路由。

---

## 结账与分单

### `bill_splits`

| 字段 | 说明 |
|------|------|
| `session_id`、`table_id`、`display_name` | 关联餐次与桌 |
| `order_ids` | uuid[] |
| `split_mode` | `even` \| `by_item` \| `custom` |
| `persons` | jsonb（姓名、`item_shares` 等） |
| `result` | jsonb 数组 `{ name, amount, paid? }` |
| `status` | `pending` \| `confirmed` \| `requested` \| `paid` \| `cancelled` |
| `discount_rate`、`discount_reason*` | 折扣 |
| `customer_nif` | 葡税号 |

**约束**：每会话最多一条活跃 split（`pending|confirmed|requested`）。

### `session_collected_payments`

按人确认收款台账：`person_name`、`amount`、`bill_split_id`、`session_id`。

---

## 打印

### `print_jobs`

| 字段 | 说明 |
|------|------|
| `type` | `station_ticket` \| `order_receipt` \| `pre_bill` |
| `payload` | jsonb（桌名、行项目、locale 等） |
| `status` | `pending` \| `processing` \| `done` \| `failed` |
| `claimed_by` | 代理设备标识 |
| `table_display`、`table_id` | 生成列，来自 payload |

### `print_agent_pairings` / `print_agent_devices`

配对码、JWT 有效期、`revoked_at`、`routing_snapshot`、心跳字段。

---

## 自助餐

- `buffets`、`buffet_time_slots`、`buffet_price_rules`、`buffet_calendar_overrides`
- 计价 RPC：`resolve_buffet_prices`

---

## 员工与平台

### `restaurant_staff_accounts`

`role`：`kitchen` \| `waiter` \| `cashier` \| `frontdesk`；`disabled_at`。

### `platform_admin_accounts` / `platform_admin_audit_log`

运营后台身份与审计（ops app）。

---

## 审计与异常

### `operation_logs`

全量操作审计：`action_type`、`before_data` / `after_data`、`reason`。

### `abnormal_operations`

`type`：`DISCOUNT_APPLIED` \| `ITEM_DELETED` \| `UNPAID_TABLE_CLOSED`；`status`：`PENDING` \| `CONFIRMED` \| `IGNORED`。

---

## 经营分析数据源

只读聚合，无快照表：

| 来源 | 用途 |
|------|------|
| `table_sessions`（`closed`） | 统计单元、Lisbon 日归属 |
| `orders` | 菜品销量、回退营业额 |
| `bill_splits`（`paid`） | 优先营业额口径 |
| `menu_items` | 分类 enrich |

---

## 关键 RPC（写路径）

| RPC | 作用 |
|-----|------|
| `upsert_bill_split_request` | 呼叫结账，会话→`billing` |
| `confirm_bill_split_payment` | 确认收款，可关台 |
| `resume_table_session_ordering` | 恢复点餐 |
| `close_table_session_operational` / `close_table_session_manual` | 强制关台清理 |
| `transfer_table_session` / `merge_table_sessions` | 转台/并台 |
| `resolve_buffet_prices` | 自助餐计价 |

完整列表见 [`../ai-schema.md`](../ai-schema.md) § RPC。

---

## Realtime 发布表

`orders`、`table_sessions`、`bill_splits`、`print_jobs`、buffet 相关表等（`REPLICA IDENTITY FULL` 用于过滤订阅）。

---

## 身份与展示约定（强制）

1. **`table_id`**：库内关联；**禁止**纸面打印 UUID  
2. **`display_name`**：顾客/员工/小票唯一桌名  
3. 禁止恢复 **`table_number`**

---

## 相关文档

- [`01-architecture.md`](./01-architecture.md)
- [`../product/04-business-rules.md`](../product/04-business-rules.md)
- [`../restaurant-tables-design.zh.md`](../restaurant-tables-design.zh.md)
- [`../db-migration-runbook.zh.md`](../db-migration-runbook.zh.md)
