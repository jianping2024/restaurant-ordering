# 关台（结束餐次）语义与实现

> 与转台/并台设计文档：`table-transfer-merge-plan.zh.md`  
> 实现入口：`src/lib/close-active-table-session-with-cleanup.ts`  
> 相关 RPC：`close_table_session_settled` / `close_table_session_operational`

## 1. 产品语义（统一口径）

结束餐次有两条**互斥**业务路径，**不要**混称「关台」：

| 产品动作 | 含义 | 营业额 |
|----------|------|--------|
| **关台结账** | 前台 / 收银（及授权角色）确认客人已付清后收台：写收款账本、保留订单金额、关闭餐次 | **计入** |
| **强制关台** | 店主 / 服务员 / 夜间任务在**未走完正常结账**时清场：取消未付分账、作废订单金额、关闭餐次 | **通常不计** |

另有一条并行入口：**确认收款 / 分账付清**（`checkout-confirm-payment`）：把分账标为 `paid`，全员付清时关台。它与「关台结账」同属「已结算收台」，都保留订单并计入营业额；与「强制关台」不同。

无论哪条路径，结束餐次都 **不是** 仅把 `table_sessions.status` 改为 `closed`。否则会出现：

- `bill_splits` 仍停留在 `requested`（顾客已呼叫结账）→ 服务员看板仍按「有待处理结账」标绿；
- 看板与详情对「活跃 session」过滤不一致 → 状态错乱。

代码中只允许走下文两条 RPC（或确认收款付清关台），禁止业务层「只 `update table_sessions`」。

### 1.1 关台结账（settled）

**适用：** 桌台详情「关台结账」——客人已付款、前台收台（前台可先打 `checkout_bill`；收银员不打印）。

**RPC：** `close_table_session_settled`

**效果（同一事务）：**

1. 餐次须为 `open` 或 `billing`（无活跃餐次 → **404** `no_session`）。不校验厨房状态；楼面可关能力与改前 operational「关台结账」一致。
2. **未支付分账**：将该餐次下 `bill_splits.status ∈ (pending, confirmed, requested)` 的行更新为 **`cancelled`**（已 `paid` 的不动）。
3. 若尚无 `paid` 分账且应付额大于 0：写入整桌 `bill_splits`（`status = paid`）+ `session_collected_payments`。
4. **保留**订单行与 `total_amount`（**不** void、**不**清零）。
5. `table_sessions` → `closed`，`closed_reason` 为 `frontdesk_closed` / `cashier_closed` / `owner_closed`（按操作人角色），写入 `closed_by_user_id`。

分析侧按已结算餐次计入营业额。UI 在真·结账中（`billing` / `requested`）可锁「关台结账」按钮并提示走结账台；服务器 settled 不另造厨房/分账拒绝闸。

### 1.2 强制关台（operational）

**适用：** 放弃当次结账、清场、纠错、夜间批量收口——**不**替代已发生的收款记录，也**不**当作正常收银收台。

**RPC：** `close_table_session_operational`（经 JS 包装 `closeActiveTableSessionWithOperationalCleanup` 或手动关台服务）

**效果（同一事务，顺序固定）：**

1. **未支付分账**：将该餐次下 `bill_splits.status ∈ (pending, confirmed, requested)` 的行更新为 **`cancelled`**（已 `paid` 的不动）。
2. **订单行**：将该餐次下仍属 `pending` / `cooking` / `done` 的订单，**逐行作废**（`item_status → voided`，含自助餐底行规则），`orders.status → done`，`total_amount → 0`（保留订单行与 JSON 便于审计，不做物理删除）。
3. **餐次**：`table_sessions` → `closed`，写入 `closed_at`、`closed_reason`（`waiter_closed` | `owner_closed` | `auto_nightly`）、`closed_by_user_id`（手动关台的操作人；夜间自动关台为 null）。

**关台前校验：** 服务员 / 店主手动强制关台须 `confirm_close: true`；否则 **409** `close_confirm_required`。若存在 `requested` 分账，UI 可使用更强警告文案。夜间 `auto_nightly` 不经过此校验。未收款强制关台须填写原因并写审计。

**留痕：** 手动强制关台写入 `closed_by_user_id`（对应 `restaurant_staff_accounts.user_id` 或店主 `restaurants.owner_id`）。查询时可 join 展示登录名。

因订单金额被清零，分析侧通常**不**把此类餐次计入营业额。

## 2. 调用入口（必须一致）

| 场景 | 入口 |
|------|------|
| 前台 / 收银员桌台详情「关台结账」 | `POST /api/dashboard/checkout-close-table-session` → `closeTableSessionFrontdeskCheckout` → **`close_table_session_settled`** |
| 前台 / 店主强制关台 | `POST /api/dashboard/close-table-session` → `closeTableSessionManual`（未收款须原因 + 审计）→ **`close_table_session_operational`** |
| 服务员强制关台 | `POST /api/restaurants/[slug]/staff/waiter/sessions/close` → `closeActiveTableSessionWithOperationalCleanup` |
| 里斯本 05:00 夜间批量关台 | `closeAllOpenBillingSessions(admin)` → 按桌循环调用 **operational** |

### Settled vs operational（速查）

| 模式 | RPC | 订单 | 分单 / 收款 | 营业额 |
|------|-----|------|-------------|--------|
| **Settled**（关台结账） | `close_table_session_settled` | 保留 | 写 `session_collected_payments` + `bill_splits.paid` | 计入 |
| **Operational**（强制 / 夜间 / 服务员） | `close_table_session_operational` | void + zero | cancel 未付 split | 通常不计 |

关台成功后（含付清关台、关台结账）会清除该桌的同行组成员关系；若该组已无成员则自动解散。

## 3. 数据库

- `bill_splits.status` 在 `paid` 之外增加 **`cancelled`**，见迁移 `20260531120000_bill_splits_status_cancelled.sql`。
- settled 收台 RPC：`20260721140500_close_table_session_settled.sql`；楼面能力恢复：`20260725120000_close_table_session_settled_restore_floor_ability.sql`。

## 4. 部署注意

上线前需在目标库执行相关迁移：缺少 `cancelled` 约束时 operational 写入会失败；缺少 `close_table_session_settled` 时「关台结账」API 会失败。
