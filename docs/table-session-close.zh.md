# 关台（结束餐次）语义与实现

> 与转台/并台设计文档：`table-transfer-merge-plan.zh.md`  
> 实现入口：`src/lib/close-active-table-session-with-cleanup.ts`

## 1. 产品语义（统一口径）

**「关台」**指：在**未走正常「分账全部 paid」结账闭环**的情况下，由 **店主** 或 **服务员**（或夜间定时任务）**强制结束**当前桌的 `open` / `billing` 餐次，使该桌恢复可接新客状态。

关台 **不是** 仅把 `table_sessions.status` 改为 `closed`，否则会出现：

- `bill_splits` 仍停留在 `requested`（顾客已呼叫结账）→ 服务员看板仍按「有待处理结账」标绿；
- `orders` 仍挂在已关闭的 `session_id` 上 → 看板订单列表按「仅活跃 session」过滤后，详情页无单可看，看板却仍异常。

因此关台必须 **一次性** 完成下列 **操作顺序**（同一业务语义，代码中只允许走这一条路径）：

1. **未支付分账**：将该餐次下 `bill_splits.status ∈ (pending, confirmed, requested)` 的行更新为 **`cancelled`**（已 `paid` 的不动）。
2. **订单行**：将该餐次下仍属 `pending` / `cooking` / `done` 的订单，**逐行作废**（`item_status → voided`，含自助餐底行规则），`orders.status → done`，`total_amount → 0`（保留订单行与 JSON 便于审计，不做物理删除）。
3. **餐次**：`table_sessions` → `closed`，写入 `closed_at`、`closed_reason`（`waiter_closed` | `owner_closed` | `auto_nightly`）、`closed_by_user_id`（手动关台的操作人 Supabase auth user id；夜间自动/并台/付清关台为 null）。

**关台前校验：** 所有服务员/店主手动关台须 `confirm_close: true`；否则 **409** `close_confirm_required`。若存在 `requested` 分账，UI 可使用更强警告文案。夜间 `auto_nightly` 不经过此校验。

**留痕：** 服务员/店主强制关台时写入 `closed_by_user_id`（对应 `restaurant_staff_accounts.user_id` 或店主 `restaurants.owner_id`）。查询时可 join `restaurant_staff_accounts` 或 auth 用户展示登录名。

**与「确认收款 / 分账付清」的区别**：正常结账在 `checkout-confirm-payment` 路径中把分账标为 `paid` 并在全员付清时关台；**强制关台**用于放弃当次结账流程、清场、纠错，**不**替代已发生的收款记录。

## 2. 调用入口（必须一致）

| 场景 | 入口 |
|------|------|
| 服务员关台 | `POST /api/restaurants/[slug]/staff/waiter/sessions/close` → `closeActiveTableSessionWithOperationalCleanup` |
| 店主订单历史关台 | `POST /api/dashboard/close-table-session` → 同上 |
| 里斯本 05:00 夜间批量关台 | `closeAllOpenBillingSessions(admin)` → 按桌循环调用同上 |

禁止在业务代码中再写「只 `update table_sessions`」的关台分支。

## 3. 数据库

- `bill_splits.status` 在 `paid` 之外增加 **`cancelled`**，见迁移 `20260531120000_bill_splits_status_cancelled.sql`。

## 4. 部署注意

上线前需在目标库执行迁移，否则 `cancelled` 写入会因约束失败。
