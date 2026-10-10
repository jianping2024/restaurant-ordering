# 恢复点单与分单续结（需求口径）

> 结账收款 UI：`CheckoutRequestsManager`、顾客账单 `BillPage`  
> 数据：`session_collected_payments`、`bill_splits`（`split_mode`、`persons`、`result`）  
> 相关 RPC：`resume_table_session_ordering`、`confirm_bill_split_payment`  
> 关台语义（强制结束餐次）：[`table-session-close.zh.md`](./table-session-close.zh.md)

## 1. 场景

一桌客人已**呼叫结账**（整桌或均摊）。服务员在后台**可能已确认部分客人收款**（写入「已收款项」），且：

- 仍有客人未付清，或
- 客人/服务员需要**继续加菜**，

于是执行 **恢复点单**：餐次从 `billing` 回到 `open`，允许继续下单。

恢复点单的业务含义是 **「续餐续结」**，不是作废本餐次已发生的结账进度。

**按菜（`by_item`）不走本场景的会话脚恢复。** 按菜不靠整桌 `billing` 锁桌；需要某手机再点单时，员工在份额区点「恢复点单」（文案与会话恢复相同，API 为解锁该票）。客人手机无此按钮。详见 [`guest-individual-checkout.zh.md`](./guest-individual-checkout.zh.md) §15。

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
- **确认弹窗**：文案须与 RPC 分支一致——均摊无收款时为「撤销结账请求」；有部分收款时为「保留分单与已收款项」。按菜会话脚不出现此弹窗。
- **恢复点单出门禁**（sole `prepareStaffCheckoutResumeOrdering`）：整桌/均摊会话恢复用。均摊零收款（撤销分单）不做默认名门禁。按菜票级解锁另走 unlock API。

## 4. 按菜分单（`split_mode = by_item`）续结规则

按菜**不**使用会话脚「恢复点单」。员工解锁未收款票后：

- 该票退回可编辑；本机可再点、再呼叫。
- 已付票只读；续消费开**新票**（新 `party_id`）。
- 新菜进池，供未占用手机 / 员工分配；不得改写已付份额。
- 职员确认收款：认弹窗金额、只写本票（见 [`product/by-item-collect-payment.zh.md`](./product/by-item-collect-payment.zh.md)）。
- 楼面再次进结账：唯一入口 `ensureStaffCheckoutEntryForTable` / `POST …/checkout/ensure-entry`——有活跃 split 则 reopen；无则 mint `whole_table`。

客人账单阶段 sole `resolveGuestBillSurfacePhase`：`editing` / `awaiting_payment` / `settled`。全额付清关台后停在 `settled`，不自动回菜单。

## 5. 与其它分单模式

| 模式 | 会话「恢复点单」 |
|------|-------------------|
| **按菜**（`by_item`） | **无会话脚恢复**；仅员工票级解锁（按钮文案仍是「恢复点单」）。 |
| **整桌总计** | 已有收款或台账非空 → **禁止**恢复。无收款时可恢复，分单 `cancelled`。 |
| **均摊**（`even`） | 已有部分收款 → 分单 **锁定**（`confirmed`）。**零收款** → 分单 `cancelled`，再次结账可重选。 |
| ~~自定义~~ | **已删除**。 |

## 6. 允许与禁止（一览）

**允许**

- 继续点新菜、加单。
- **零收款**恢复后，重新选择分单模式、调整任意菜品归属。
- **部分收款**后，对未锁定行（未付客人菜品、新菜）继续分配。
- 对**未收款**客人继续「确认收款」。
- 查看已收款项与待收名单。

**禁止**

- **已有收款**后切换分单模式（整桌 / 均摊 / 按菜）。
- 修改**已收款客人**已锁定的菜品归属或份额。
- **已有收款**后将自助餐开台人数降到低于已付（或台账锁定）客人已分配的大人/小孩数（`buffet_headcount_below_paid_floor`；实现见 `buffet-paid-headcount-floor.ts` + waiter buffet 管道）。
- 丢失或篡改 `session_collected_payments`。
- 整桌已收后仍恢复点单。
- 按菜详情会话脚出现「恢复点单」（应隐藏）。
- 客人手机出现「恢复点单」或「刷新页面」。

## 7. 顾客端感知恢复点单（无轮询）

| 页面 | 行为 |
|------|------|
| **菜单** `MenuPage` | 无后台轮询。恢复点单后，顾客点「+ 加入」或提交购物车时 **先拉** `customer/session`，服务端已 `open` 则立即加菜。 |
| **账单编辑态** `BillPage` | 无常驻轮询。进入页 / 从后台回到前台时 sole `useCustomerBillReadModel` → `syncCustomerBill` → `customer/bill` **full**（订单 + `existing_split` + `collected_payments` + session 态）；与 SSR 同口径。呼叫结账前 `resolveFreshBill` 做权威校验（15s 内刚同步过可去重）。同桌加菜等变化若未触发上述事件，提交前会发现并 toast，不静默按旧单结账。 |
| **账单成功页** `BillPage` | 同一进页 reconcile（不因 `submitted` 关掉）。职员恢复/解锁后，软停留或再进账单会翻成可编辑态并带上台账；**不依赖**硬刷新，成功页不提供「刷新页面」。 |
| **返回菜单** | 唯一入口为底栏描边「返回点单」（`GuestBillBottomDock`）；进入菜单时首屏拉一次 session，与上表加菜前刷新一致。客人无「恢复点单」「刷新页面」。 |

员工端结账台用 Realtime；可见性/焦点回前台时一次 reconcile（无间隔轮询读模型）。

## 8. 实现状态（文档与代码对照）

| 能力 | 目标（本文） | 当前实现（摘要） |
|------|----------------|------------------|
| 已收款项跨恢复保留 | ✓ | ✓ `session_collected_payments` 不随恢复删除 |
| 整桌部分收款后可恢复 | ✓ | ✓ |
| 均摊无会话脚恢复 | ✓ | `resumeCheckoutBlockReason` → `even_session` |
| 按菜无会话脚恢复 | ✓ | `resumeCheckoutBlockReason` → `individual_session` |
| 按菜票级解锁文案「恢复点单」 | ✓ | 份额区 sole `checkout.resumeOrdering` |
| 部分收款后锁定已付菜品行 | ✓ | `lockedByItemLineKeys` + `paidSplitPersonNames` |
| 已收款后禁止降自助餐人数低于锁定座位 | ✓ | `lockedBuffetHeadcountByBuffetId` + buffet 管道 409 |
| 均摊零收款恢复 | 撤销分单 | `cancelled` |
| 均摊部分收款恢复 | 保留分单 | `confirmed` |
| 服务端续结校验 | 与 UI 一致 | `validateCheckoutContinuation` |
| 楼面再次呼叫结账 | reopen 保留分单 / 无则 whole_table | `ensureStaffCheckoutEntryForTable` + `loadActiveBillSplitForSession` |
| 客人底栏无恢复/刷新 | ✓ | `GuestBillBottomDock` |
| 付清关台后客人已结清面 | ✓ | `resolveGuestBillSurfacePhase` → `settled` |

## 9. 相关文件

- `apps/web/src/lib/checkout-active-bill-split.ts` — 活跃 split 唯一查找 + reopen payload
- `apps/web/src/lib/checkout-request-server.ts` — `ensureStaffCheckoutEntryForTable` / `submitCheckoutRequestForTable`
- `apps/web/src/app/api/restaurants/[slug]/checkout/ensure-entry/route.ts` — 楼面呼叫结账
- `apps/web/src/components/waiter/WaiterTableDetailLayout.tsx` — 楼面按钮 → ensure-entry
- `apps/web/src/components/dashboard/CheckoutRequestsManager.tsx` — 结账详情、恢复点单入口
- `apps/web/src/components/menu/MenuPage.tsx` — 加菜前 session 刷新
- `apps/web/src/components/menu/BillPage.tsx` — 顾客分单与阶段面
- `apps/web/src/components/menu/GuestBillBottomDock.tsx` — 客人账单底栏
- `apps/web/src/lib/customer-bill-split-display.ts` — 成功页分单展示（ledger + result）
- `apps/web/src/lib/checkout-split-continuation.ts` — 锁定判定、`paidSplitPersonNames`、`lockedByItemLineKeys`
- `apps/web/src/lib/checkout-session-payments.ts` — 已收台账、待收行过滤、恢复拦截（按菜 `individual_session` / 均摊 `even_session`；UI omit 唯一 `omitsSessionResumeOrdering`）
- `apps/web/src/lib/checkout-resume-ordering-gate.ts` — 恢复点单出门禁
- `apps/web/src/lib/staff-ticket-unlock.ts` / unlock API — 按菜票级解锁
- `supabase/migrations/20260710120000_resume_ordering_preserve_by_item_split.sql` — 历史：按菜会话恢复保留快照（现产品入口已收口为票级解锁）
