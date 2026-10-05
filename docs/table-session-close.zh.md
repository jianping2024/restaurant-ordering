# 关台（结束餐次）语义与实现

> 与转台/并台设计文档：`table-transfer-merge-plan.zh.md`  
> 实现入口：`src/lib/close-active-table-session-with-cleanup.ts`  
> 相关 RPC：`close_table_session_operational` / `confirm_bill_split_payment`（最后一笔收款关台）；`close_table_session_settled` 已由迁移 `20261005190000` 删除  
> 强制 `closed_reason`：`apps/web/src/lib/table-session/operational-close-reasons.ts`

## 1. 产品语义（统一口径）

结束餐次有两条**互斥**业务路径，**不要**混称「关台」：

| 产品动作 | 含义 | 营业额 |
|----------|------|--------|
| **呼叫结账 → 收款付清** | 前台 / 收银 / 店主点桌台详情「呼叫结账」进结账页收款，**最后一笔收款确认后自动关台**（`checkout-confirm-payment`）：保留订单金额、关闭餐次 | **计入** |
| **强制关台** | 店主 / 服务员 / 夜间任务在**未走完正常结账**时清场：取消未付分账、保留订单金额、关闭餐次 | **不计**（按关台性质排除，**不**靠清零订单） |

**确认收款 / 分账付清**（`checkout-confirm-payment`）把分账标为 `paid`，全员付清时关台，保留订单并计入营业额；与「强制关台」不同。原桌台详情「关台结账」入口已移除，结账只走呼叫结账。

无论哪条路径，结束餐次都 **不是** 仅把 `table_sessions.status` 改为 `closed`。否则会出现：

- `bill_splits` 仍停留在 `requested`（顾客已呼叫结账）→ 服务员看板仍按「有待处理结账」标绿；
- 看板与详情对「活跃 session」过滤不一致 → 状态错乱。

代码中只允许走下文两条 RPC（或确认收款付清关台），禁止业务层「只 `update table_sessions`」。  
**void 仅用于真实退菜**，不用于任何关台路径。

### 1.1 关台结账（settled）— 入口已移除

桌台详情「关台结账」、`POST /api/dashboard/checkout-close-table-session` 与 `closeTableSessionFrontdeskCheckout` 已删除；`close_table_session_settled` 已由迁移 `20261005190000_drop_close_table_session_settled.sql` 删除（历史迁移文件不改）。以下仅描述历史数据语义：


**RPC（已删除）：** `close_table_session_settled`（写入 `settled_payable_amount` = 与台面相同的 billable 投影）

**效果（同一事务）：**

1. 餐次须为 `open` 或 `billing`（无活跃餐次 → **404** `no_session`）。
2. **未支付分账**：`pending` / `confirmed` / `requested` → **`cancelled`**（已 `paid` 的不动）。
3. **保留**订单行与 `total_amount`（**不** void、**不**清零、**不**为寿司冻结改行）；应付写入 `settled_payable_amount`。
4. `table_sessions` → `closed`，`closed_reason` 为 `frontdesk_closed` / `cashier_closed` / `owner_closed`，写入 `closed_by_user_id`。

分析侧：已关闭且非强制路径的 session，优先用 `settled_payable_amount` 计入营业额（无快照的旧行回退订单合计）。  
订单历史：`closed_reason` 属 settled 集合时 outcome 为 `fully_paid`（已结账关台）；金额认结算快照 / 同投影；`canPrintBill` 仅已结账且有菜；补打走会话级 `checkout_bill`。现网关台结账与分账收款路径不相交。

### 1.2 强制关台（operational）

**适用：** 放弃当次结账、清场、纠错、夜间批量收口。

**RPC：** `close_table_session_operational`

**效果（同一事务）：**

1. **未支付分账** → **`cancelled`**（已 `paid` 的不动）。
2. **保留**订单行与 `total_amount`（**不** void、**不**清零）。
3. `table_sessions` → `closed`，`closed_reason` 为强制专用值：`waiter_closed` | `owner_forced` | `frontdesk_forced` | `cashier_forced` | `auto_nightly`（**不要**与 settled 的 `owner_closed` / `frontdesk_closed` / `cashier_closed` 混用）。

**关台前校验：** 手动强制关台须 `confirm_close: true`；未收款强制关台须原因 + `UNPAID_TABLE_CLOSED` 审计。夜间 `auto_nightly` 不经过确认校验。

**营业额排除（一种表示）：**  
`closed_reason` 属于强制集合，**或**存在 `abnormal_operations.type = UNPAID_TABLE_CLOSED` → 不计入今日营业额 / 增值分析。  
**不**再靠把订单金额清零来排除。

## 2. 调用入口（必须一致）

| 场景 | 入口 |
|------|------|
| 前台 / 收银 / 店主桌台详情「呼叫结账」（`tables.checkout_close`） | `POST /api/restaurants/[slug]/checkout/ensure-entry` → 结账页收款 → 最后一笔 `confirm_bill_split_payment` 自动关台 |
| 有 `tables.force_close` 的员工强制关台（含勾选后的收银） | `POST /api/dashboard/close-table-session` → `closeTableSessionManual`（映射为 `*_forced`）→ **`close_table_session_operational`** |
| 服务员强制关台 | waiter sessions close → `waiter_closed` → **operational** |
| 里斯本 05:00 夜间批量关台 | `auto_nightly` → **operational** |

### Settled vs operational（速查）

| 模式 | RPC | 订单 | 未付分账 | 营业额 |
|------|-----|------|----------|--------|
| **Settled**（历史关台结账，入口与 RPC 均已移除） | `close_table_session_settled` | 保留 | cancel | **计入** |
| **Operational**（强制 / 夜间 / 服务员） | `close_table_session_operational` | 保留 | cancel | **不计**（按 reason / 异常） |

关台成功后会清除该桌的同行组成员关系；若该组已无成员则自动解散。

## 3. 数据库

- `bill_splits.status` 含 **`cancelled`**。
- settled：`20260721140500` → 楼面能力 `20260725120000` → 去掉发明 ledger `20260725181000`。
- operational 保留订单：`20260725180000_close_table_session_operational_preserve_orders.sql`。

## 4. 部署注意

目标库需执行上述 migration（含删除 `close_table_session_settled` 的 `20261005190000`）；旧版仍 void 的 operational 会导致行为与文档不一致。
