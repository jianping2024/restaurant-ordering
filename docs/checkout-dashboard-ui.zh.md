# 结账请求页 UI（`/dashboard/checkout`）

> 组件：`CheckoutRequestsManager`、`CheckoutRequestListCard`、`StaffCheckoutSplitEditor`  
> 结算计算：`checkout-settlement.ts`  
> 续结业务规则：[`checkout-resume-ordering.zh.md`](./checkout-resume-ordering.zh.md)

## 1. 页面任务

服务员在忙时打开本页，按优先级完成：

1. **扫视队列** — 哪桌在等、等了多久、还差多少没收  
2. **核对金额** — 消费、折扣、已收、待收  
3. **确认收款** — 在唯一详情（三 tab）上按结账方式收款  
4. **次要操作** — 取消回桌台详情；整桌/均摊可「恢复点单」。按菜会话脚不放「恢复点单」（份额区票级按钮文案仍是「恢复点单」）。打印在确认收款之后询问，不在详情底栏  
5. **结账方式** — 唯一详情即「结账方式」三 tab（整桌 / 按菜 / 均摊）；无 path_chooser、无楼面全屏结账层  
6. **关台** — 默认由最后一笔收款触发；打印发票不关台；`quick_table_close` 开时楼面走「关台结账」  

## 2. 布局

| 视口 | 行为 |
|------|------|
| **桌面（lg+）** | 主从分栏：左侧待结账列表常驻，右侧详情；未选桌时右侧显示提示文案 |
| **手机/平板** | 列表与详情互斥：选桌后全屏详情，顶部「返回列表」回到队列 |

**唯一结账壳：** 只有本页（带列表）。楼面待结账桌卡跳转 `/dashboard/checkout?table_id=…`，不再弹无列表全屏层。

## 3. 列表卡片

每张卡片展示：

- 桌号、**呼叫时间 + 已等待时长**（`Europe/Lisbon`，与收款时间一致）  
- 结账方式标签（整桌 / 均摊 / 按菜）  
- 收款进度（有已收时：`已收 €{collected} / €{payable}`）  
- 状态：`待结账` 或 `部分已收`  
- **主数字：待收金额**

## 4. 详情区（唯一页面2）

1. **结算摘要条** — 消费 · 应收 · 已收 · 待收；折扣 %（有收款后禁用）。sticky：`checkoutSettlementBarStickyShellClass`  
2. **结账方式** — `BillSplitPanel` 三 tab + 分单结果；整桌/均摊行尾「收款」；按菜为 `StaffByItemSplitWorkbench`  
3. **本桌菜品** — 唯一 `CheckoutTableItemsSection` + `checkoutLinesFromOrders`（与订单历史同一套纸面行）；默认折叠，标题含道数  
4. **方式锁定** — 整桌未收款可改按菜/均摊；按菜/均摊已提交不可改、不可回整桌；开收后锁（`isStaffCheckoutSplitModeFrozen` + `isCheckoutSplitLocked`）  
5. **人数** — 均摊默认/下限 1（`splitDraftPersonCount`）、可加；按菜串行一票一人  
6. **底部** — 「取消」→ 该桌桌台详情（单仍在队列）；整桌/均摊另有「恢复点单」；按菜无会话脚恢复；**无关台钮**（关台在楼面/收款闭环）  

客人手机：整桌已呼叫后不能自行改方式；改分单只在本页由员工操作。队列做完变空 → 回楼面看板。

## 5. 金额规则

- **本次应收（按菜）** = 该票折后应付 − 本餐次该票已确认收款  
- **待收（摘要）** = 折后应收合计 − `session_collected_payments` 合计  
- 详见定稿 product 文档

## 6. 财政发票

- 门禁与编排不变（`mayFiscalBillQueue` / `runStaffPrintFiscalInvoice`）  
- 楼面「呼叫结账」→ 跳本页；关台仍走收款闭环 / 强制关台  

## 7. 相关文件

- `CheckoutRequestsManager.tsx` — 队列 + 详情  
- `CheckoutRequestDetailHost.tsx` — 详情 Host（始终 `StaffCheckoutSplitEditor`）  
- `StaffCheckoutSplitEditor.tsx` / `BillSplitPanel.tsx` / `StaffByItemSplitWorkbench.tsx`  
- `checkout-split-continuation.ts` — 人数下限、方式锁定  
- `waiter-board-card-action.ts` — 待结账桌卡 → 结账队列 URL  
