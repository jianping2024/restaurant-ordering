# 恢复点单与分单续结（需求口径）

> 结账收款 UI：`CheckoutRequestsManager`、顾客账单 `BillPage`  
> 数据：`session_collected_payments`、`bill_splits`（`split_mode`、`persons`、`result`）  
> 相关 RPC：`resume_table_session_ordering`、`confirm_bill_split_payment`  
> 关台语义（强制结束餐次）：[`table-session-close.zh.md`](./table-session-close.zh.md)

## 1. 场景

一桌客人已**呼叫结账**，并选择了**按菜分单**（或其它分单模式）。服务员在后台**可能已确认部分客人收款**（写入「已收款项」），且：

- 仍有客人未付清，或
- 客人/服务员需要**继续加菜**，

于是执行 **恢复点单**：餐次从 `billing` 回到 `open`，允许继续下单。

恢复点单的业务含义是 **「续餐续结」**，不是作废本餐次已发生的结账进度。

## 2. 核心原则

| 原则 | 说明 |
|------|------|
| **已收款项不可动** | `session_collected_payments` 为本餐次收款台账；恢复点单**不得**冲销、覆盖或丢失已有记录。再次结账时须完整展示历史收款与合计。 |
| **分单快照可保留、锁定看收款** | **按菜分单**恢复点单时，RPC 将 `bill_splits` 置为 `confirmed` 以保留 `persons` / `result` 快照，供账单页预填。**是否锁定可编辑**由是否已开始收款决定，而非 `confirmed` 状态本身。 |
| **未收款可改分单** | 本餐次**零收款**（`result` 无 `paid: true` 且 `session_collected_payments` 为空）时，恢复点单后顾客可重新选择分单模式、调整按菜归属，再次呼叫结账时以新方案为准。 |
| **收款后锁定** | 一旦出现确认收款（`result` 行 `paid: true` 和/或 `session_collected_payments` 有记录），分单模式锁定；按菜分单仅锁定**已付客人**名下菜品行（台账有记录但 `result` 尚未标 `paid` 时，保守锁定全部已分配行）。 |
| **整桌已收不可恢复** | 若整桌（单条总计分账）已收款，或业务上视为整桌已结清，**禁止**恢复点单（与现有 `whole_table_paid` 拦截一致）。 |

## 3. 服务员侧结账详情（`CheckoutRequestsManager`）

与 [`research.md`](../research.md) §9 一致，并补充续结语义。  
**UI 版式与信息层级**见 [`checkout-dashboard-ui.zh.md`](./checkout-dashboard-ui.zh.md)。

- **已收款项**：展示本餐次全部历史确认收款（含恢复点单之前发生的）。
- **分单结果**：仅展示**尚未确认收款**的客人；已收款者不在此重复出现。
- **恢复点单**后再次进入结账详情：已收款项与待收名单须与恢复前一致（仅因新加菜而增加待结金额或新增待分配行，见 §4）。
- **确认弹窗**：文案须与 RPC 分支一致——按菜分单统一为「保留分单快照」；均摊 / 自定义无收款时为「撤销结账请求」；有部分收款时为「保留分单与已收款项」。

## 4. 按菜分单（`split_mode = by_item`）续结规则

### 4.1 恢复点单时保留分单快照（与收款无关）

客人已按菜分单并呼叫结账后，执行恢复点单时：

- `bill_splits` 置为 **`confirmed`**，保留 `split_mode`、`persons`（含 `item_shares`）、`result`。
- **不**因「零收款」而将分单 `cancelled`。
- 业务含义：快照用于账单页**预填**上次分配；**零收款时顾客仍可修改**（见 §4.4）。

### 4.2 恢复点单前已存在的菜

| 收款状态 | 顾客账单页行为 |
|----------|----------------|
| **零收款** | 所有已存在菜品行**可编辑**（可改归属、份额、消费者姓名）。 |
| **部分收款** | **已付客人**名下菜品行 **只读**；**未付客人**名下行可编辑。 |
| **台账有记录但 result 未标 paid** | 已分配行保守 **只读**（与 `lockedByItemLineKeys` + `hasCollectedLedger` 一致）。 |

### 4.3 恢复点单后新加的菜

- 新订单行纳入**同一餐次**、**同一按菜分单框架**。
- **零收款**：新菜与旧菜一样可自由分配。
- **已有收款**：新菜可分配；**不得**改动已锁定行的归属。
- 新菜金额并入对应客人的应付；服务员确认收款时，「建议本次收」须扣除该客人历史已收（`session_collected_payments` + `suggestedCollectionAmount` 语义）。

### 4.4 顾客账单页（`BillPage`）

锁定由 `isCheckoutSplitLocked` / `lockedByItemLineKeys`（`checkout-split-continuation.ts`）统一判定：

| 条件 | 分单模式切换 | 按菜分配区 |
|------|--------------|------------|
| 零收款（含 `confirmed` + `open` 恢复后） | **可切换** | **全部可编辑** |
| 已有收款 | **禁用** | 仅**已付客人**菜品行只读；其余可编辑 |
| 首次结账、从未呼叫结账 | 与现网一致 | 可选模式、可编辑 |

**提交成功页（`submitted=true`）**：分单结果展示须与服务员台一致，由 `result.amount`（应付）与 `session_collected_payments`（已收）推导，**不得**仅依赖 `result.paid` 显示「已收款」。部分已收客人（续结后仍有待付差额）显示「部分已收」、待付金额及应付/已收明细；仅当 ledger 覆盖义务时显示「已收款」。

`isPausedCheckoutSplit`（`open` + `confirmed`）仅用于控制**是否仍展示「已呼叫结账」成功页**，**不**单独触发锁定。

## 5. 与其它分单模式

| 模式 | 恢复点单时的分单处理 |
|------|-------------------|
| **按菜分单**（`by_item`） | RPC **始终**保留为 `confirmed`（快照）。**零收款**时顾客页可重选模式与归属；**有收款**后锁定。 |
| **整桌总计**（单行 / 无分人） | 已有收款或台账非空 → **禁止**恢复点单（现状）。无收款时可恢复，分单 `cancelled`。 |
| **均摊 / 自定义** | 已有部分收款 → 分单 **锁定**（`confirmed`）。**零收款** → 分单 `cancelled`，再次结账可重选。部分收款后不可改模式或推翻已 `paid` 行。 |

## 6. 允许与禁止（一览）

**允许**

- 继续点新菜、加单。
- **零收款**恢复后，重新选择分单模式、调整任意菜品归属。
- **部分收款**后，对未锁定行（未付客人菜品、新菜）继续分配。
- 对**未收款**客人继续「确认收款」。
- 查看已收款项与待收名单。

**禁止**

- **已有收款**后切换分单模式（均摊 / 按菜 / 自定义）。
- 修改**已收款客人**已锁定的菜品归属或份额。
- 丢失或篡改 `session_collected_payments`。
- 整桌已收后仍恢复点单。

## 7. 顾客端感知恢复点单（无轮询）

| 页面 | 行为 |
|------|------|
| **菜单** `MenuPage` | 无后台轮询。恢复点单后，顾客点「+ 加入」或提交购物车时 **先拉** `customer/session`，服务端已 `open` 则立即加菜。 |
| **账单成功页** `BillPage` | 无 5s 自动检测。停在「账单已提交、请到前台支付」时，顾客点 **「刷新状态」** 拉 `customer/bill`；若已恢复点单则回到可编辑账单（保留分单快照规则同 §4）。 |
| **返回菜单** | 进入菜单时首屏拉一次 session，与上表加菜前刷新一致。 |

员工端结账台仍用 Realtime + 兜底轮询，与顾客端策略分离。

## 8. 实现状态（文档与代码对照）

| 能力 | 目标（本文） | 当前实现（摘要） |
|------|----------------|------------------|
| 已收款项跨恢复保留 | ✓ | ✓ `session_collected_payments` 不随恢复删除 |
| 多人分账部分收款后可恢复 | ✓ | ✓ 非整桌单行时可恢复 |
| 按菜分单恢复时保留快照 | ✓ | `20260710120000`：`by_item` 始终 `confirmed` |
| 零收款恢复后顾客可改分单 | ✓ | `isCheckoutSplitLocked` 仅在有 `paid` 或台账时 true |
| 部分收款后锁定已付菜品行 | ✓ | `lockedByItemLineKeys` + `paidSplitPersonNames` |
| 均摊/自定义零收款恢复 | 撤销分单 | `cancelled` |
| 均摊/自定义部分收款恢复 | 保留分单 | `confirmed` |
| 服务端续结校验 | 与 UI 一致 | `validateCheckoutContinuation` |
| 恢复点单确认弹窗文案 | 与 RPC 分支一致 | `resumeOrderingConfirmVariant` + i18n |

## 9. 相关文件

- `apps/web/src/components/dashboard/CheckoutRequestsManager.tsx` — 结账详情、恢复点单入口
- `apps/web/src/components/menu/MenuPage.tsx` — 加菜前 session 刷新
- `apps/web/src/components/menu/BillPage.tsx` — 顾客分单、成功页手动刷新
- `apps/web/src/lib/customer-bill-split-display.ts` — 成功页分单展示（ledger + result）
- `apps/web/src/lib/customer-bill-checkout-resume.ts` — 成功页刷新结果判定
- `apps/web/src/lib/checkout-split-continuation.ts` — 锁定判定、`paidSplitPersonNames`、`lockedByItemLineKeys`
- `apps/web/src/lib/checkout-session-payments.ts` — 已收台账、待收行过滤、恢复拦截、确认文案分支
- `supabase/migrations/20260710120000_resume_ordering_preserve_by_item_split.sql` — 按菜分单恢复保留 RPC
