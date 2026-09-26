# 结账请求页 UI（`/dashboard/checkout`）

> 组件：`CheckoutRequestsManager`、`CheckoutRequestListCard`、`CheckoutRequestDetail`  
> 结算计算：`checkout-settlement.ts`  
> 续结业务规则：[`checkout-resume-ordering.zh.md`](./checkout-resume-ordering.zh.md)

## 1. 页面任务

服务员在忙时打开本页，按优先级完成：

1. **扫视队列** — 哪桌在等、等了多久、还差多少没收  
2. **核对金额** — 消费、折扣、已收、待收  
3. **确认收款** — 按分单结果逐人收款（主操作）  
4. **次要操作** — 恢复点单、强制关台。打印发生在确认收款之后的询问，不在详情底栏  
5. **路径选择（零收款整桌）** — 一行三个按钮：整桌结账、分单结账、恢复点单。桌面不显示「返回列表」  
6. **关台** — 仍由最后一笔收款触发，不由打印发票触发  

版式按上述任务组织，而非按数据库表字段堆叠。

## 2. 布局

| 视口 | 行为 |
|------|------|
| **桌面（lg+）** | 主从分栏：左侧待结账列表常驻，右侧详情；未选桌时右侧显示提示文案 |
| **手机/平板** | 列表与详情互斥：选桌后全屏详情，顶部「返回列表」回到队列 |

## 3. 列表卡片

每张卡片展示：

- 桌号、**呼叫时间 + 已等待时长**（`Europe/Lisbon`，与收款时间一致）  
- 分单模式标签（整桌 / 均摊 / 按菜分单 / 自定义）  
- 收款进度（有已收时：`已收 €{collected} / €{payable}`，与摘要条同口径；sole `formatCheckoutBillCollectionProgressLabel` — 禁止 `N/N 人已收`）  
- 状态：`待结账` 或 `部分已收`  
- **主数字：待收金额**（应收 − 已收台账）；有已收时副行显示消费总额  

## 4. 详情区信息顺序

1. **结算摘要条** — 左侧：消费 · 应收 · 已收 · **待收**（待收高亮）；右侧：**折扣 % 输入**（默认 0，改值后应收/待收即时更新；有收款后禁用；失焦仍走原因弹窗）。sticky 底唯一 `brand-bg`（对齐米纸，金条圆角不外露 card 白边）；路径只差偏移：`/dashboard/checkout` 用 `checkoutSettlementBarStickyShellClass`（`belowStaffTopBar`），楼面 sheet 用 `checkoutSettlementBarSheetStickyShellClass`（`top-0`）。窄屏「返回列表」在条内。  
2. **页头** — 桌号；**有顾客税号时紧随桌号强调展示**（标签清晰 + 数字 `text-lg font-semibold` + `font-mono tabular-nums` / `formatPortugueseNif`）；再是呼叫/meta、分单模式、状态。无税号不占位。  
3. **路径 / 分单编辑** — 均摊、按菜、手填一直停在 `split_edit` 按人收款（无「确认分单」、无第二页「收款 €」）。按菜唯一壳 `StaffByItemSplitWorkbench`（池上 `1/N` 跟当前人分母，默认 1/2；行尾垃圾桶把该份额退回池）。均摊/手填在结果行末尾「收款」；手填另有垃圾桶。折扣条在首笔收款前可改   
4. **分单人条（settle）** — 多人分单时顶上 `CheckoutSettlePersonRail`：chip + **收款完成 ✓**（`settlementStatus === 'settled'`）；点 chip 定位待收款行；**不**表示开票  
5. **待收款区（主操作）** — 强调边框；每人**本次应收**为大号数字；按钮文案 `收款 €{amount}`；有历史已收时副行显示应付总额与已收  
6. **已收款项（台账）** — 弱化样式；单行 `姓名 · 时间 — 金额`；分单时每行旁「打印收据」+（财政开）「打印发票」  
7. **本桌菜品** — 默认折叠，标题含道数  
8. **底部操作** — 取消（未收款且仍可回到三个按钮时）、恢复点单、强制关台  

## 5. 金额规则

- **本次应收（按菜）** = 该票折后应付 − 本餐次该票已确认收款；**不要**与摘要待收取较小（定稿 [`product/by-item-collect-payment.zh.md`](./product/by-item-collect-payment.zh.md)）
- **待收（摘要）** = 折后应收合计 − `session_collected_payments` 合计
- **按菜确认**认弹窗金额；只写当前票；禁止确认时整桌重算
- **按菜 person_index** = `result[]` 创建序（禁止名字排序下标）；票身份优先 `party_id`；芯片 ✓ = settled
- 界面最大字号必须对应当前要收的钱，避免与分单应付总额混淆
## 6. 财政发票（`bill_sync_to_fiscal`）

- 门禁：功能开关 + `mayFiscalBillQueue`（`checkout.sync_bill` ∧ `tables.checkout_close`）  
- 唯一编排：`runStaffPrintFiscalInvoice`（`auto_issue` 入队 → 等成功；**不关台**）  
- 付款三选 / `payment_lines` / 证件类型（现金≤€100→FS，现金>€100 或 Multibanco/混合→FT）见定稿 [`product/collect-payment-receipt-iva.zh.md`](./product/collect-payment-receipt-iva.zh.md)  
- 桌台详情：开关开 → 隐藏关台结账、显示呼叫结账；关 → 相反。强制关台始终可有  

## 7. 相关文件

- `apps/web/src/components/dashboard/CheckoutRequestsManager.tsx` — 数据加载、主从布局  
- `apps/web/src/components/dashboard/checkout/CheckoutRequestListCard.tsx` — 队列卡片  
- `apps/web/src/components/dashboard/checkout/CheckoutRequestDetail.tsx` — 详情面板  
- `apps/web/src/components/dashboard/checkout/StaffCheckoutSplitEditor.tsx` — 员工分单编辑
- `apps/web/src/components/dashboard/checkout/StaffByItemSplitWorkbench.tsx` — 按菜唯一工作台（Fatura 式）
- `apps/web/src/components/dashboard/checkout/CheckoutSettlePersonRail.tsx` — settle 人条 + 收款完成 ✓
- `apps/web/src/lib/staff-by-item-workbench.ts` — 剩余池 / 有理数份额 / 加人份额 helpers（具名-only）
- `apps/web/src/components/menu/ByItemQtyInput.tsx` — 整+分子/分母唯一录入（客人菜卡与员工当前人共用）
- `apps/web/src/components/dashboard/checkout/PrintFiscalInvoiceModal.tsx` — 发票弹窗  
- `apps/web/src/lib/checkout-settlement.ts` — 结算摘要与列表 meta  
- `apps/web/src/lib/format-dashboard-date.ts` — `formatCollectedPaymentTime`  
- `apps/web/src/lib/run-staff-print-fiscal-invoice.ts` — 打印发票编排  
- `apps/web/src/lib/bill-sync-permission.ts` — `mayFiscalBillQueue`  
