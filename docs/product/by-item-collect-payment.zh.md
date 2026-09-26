# 按菜收款（by_item）定稿

本文是职员台 **按菜分单确认收款** 的唯一产品定稿。与实现冲突时以本文为准。

相关 UI 壳见 [`../checkout-dashboard-ui.zh.md`](../checkout-dashboard-ui.zh.md)；付款方式 / IVA / FS·FT 见 [`collect-payment-receipt-iva.zh.md`](./collect-payment-receipt-iva.zh.md)。

## 原子单位

- 一票 = 一次收款/打票闭环（不是「同名这个人」）。
- 票有稳定 `party_id`；显示名只是标签，**允许重复**。
- 身份与匹配优先 `party_id`，禁止再用纯名字当唯一 scope。

## 点「收款」（打开弹窗）

1. 当前票要有名字。
2. **本次应收** = 该票应付（分菜 × 单价）− 该票已收台账。  
   **不要**再和整桌摘要「待收」取较小。
3. 金额 ≤ 0 → 不弹窗。
4. 弹窗上人 + 金额定死。

## 点「确认」

1. **认弹窗金额**，不再算、不换成落库后的新数。
2. **只核这一票**：现有分菜算出来的还欠是否仍等于弹窗金额（分币相等）；不对就失败。
3. **只写这一票**：分菜 + 应付（并盖 `locked_amount`）合并进账单；**其它票的应付/份额不得被这次确认改写**。  
   落库 upsert 必须带 `allow_partial_by_item: true`（职员确认收款路径）：已付金额冻结后 Σ 可能 ≠ 整桌消费，或池尚未分完；**禁止**为凑齐合计再整桌拧数。
4. 按弹窗金额写一笔 `session_collected_payments`。
5. 收齐打钩；焦点去下一张还欠的票。整桌是否收齐 = 所有票还欠是否都为 0。

## 禁止

- 确认收款时 **整桌重算** 再落库（旧 `persistBeforePay` 整单 `calcByItemSplitResults`）。
- 用落库后的新 `result` **覆盖**弹窗金额。
- 已付票应付被后一次确认/合并抬高或改贱（含 1¢）。
- 往已付票上继续叠菜；同人续消费 → **新开一票**（可同名）。
- 用摘要「待收」`Math.min` 夹断单票本次应收。

## 已付票

- 份额锁 + 金额锁：收款确认盖章后，后续分菜/余数重算 **只动未付票**。
- 线级：`item_shares.locked_amount`；结果行：`result.paid` 后 merge **保留原 amount**（TS + SQL 同口径）。
- 已付份额只读（`paidLocked`）；同菜再分 → 新行/新票，不 merge 进已付行。

## 已落库 vs 未付草稿（UI 唯一）

- **已落库 / 已收款**：只来自服务器 `bill_splits.persons`（+ 台账锁）→ committed。Realtime 刷新只重建这一层。
- **未付进行中草稿**：只活在本机 draft，直到该票点收款落库；远端刷新 **不得** 重置 draft。
- 界面唯一写法：`mergeByItemCommittedAndDraft`（`by-item-committed-draft.ts`）+ `useByItemSplitState`；禁止再整表 `setByItemAllocations(hydratedFromPersons)`。

## 摘要待收（整桌）

- **待收** = 折后应收合计 − 台账已收合计。  
- 只用于摘要；**不**夹断单人本次应收。

## 均摊 / 手填

- 本篇只定按菜。均摊/手填确认前仍可整单落库分单计划（`persistBeforePay`）；**不得**把按菜确认接到这条整单路径上。

## 实现落点（唯一）

| 职责 | 唯一写法 |
|------|----------|
| 打开弹窗目标金额 | `resolveByItemCollectTarget` |
| 确认前校验弹窗金额 | `collectModalAmountStillValid` |
| 确认只合并当前票 | `mergeCurrentByItemTicketForCollect` + `onRegisterCollectTicket` |
| 份额盖章 | `stampCollectTicketFrozenAmounts` → `locked_amount` |
| 已付结果金额不被 merge 改写 | `mergeByItemSplitResultWithLedger`（TS）+ SQL `merge_by_item_split_result_with_ledger` |
| 确认写台账 | `confirm_bill_split_payment` / `requestCheckoutConfirmPayment`（金额 = 弹窗） |
| 收款 upsert 允许部分/冻结差额 | `allow_partial_by_item: true`（仅职员 by-item 确认收款） |
| 已落库 + 未付草稿 UI | `mergeByItemCommittedAndDraft` + `useByItemSplitState`（Realtime 只重建 committed） |

已删除：按菜确认路径上的整桌 `persistBeforePay`；`reconcileByItemResultsToBillTotal`（整桌拧合计）。均摊/手填仍用 `persistBeforePay`。
