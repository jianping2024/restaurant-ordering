# 结账请求页 UI（`/dashboard/checkout`）

> 组件：`CheckoutRequestsManager`、`CheckoutRequestListCard`、`CheckoutRequestDetail`  
> 结算计算：`checkout-settlement.ts`  
> 续结业务规则：[`checkout-resume-ordering.zh.md`](./checkout-resume-ordering.zh.md)

## 1. 页面任务

服务员在忙时打开本页，按优先级完成：

1. **扫视队列** — 哪桌在等、等了多久、还差多少没收  
2. **核对金额** — 消费、折扣、已收、待收  
3. **确认收款** — 按分单结果逐人收款（主操作）  
4. **次要操作** — 打印账单、打印发票（财政开关开且已收款后）、恢复点单、强制关台  
5. **路径选择（零收款整桌）** — `path_chooser`：整桌一起付 | 分单；确认分单后进入 `settle`  
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
- 收款进度（多人分账时 `已收人数/总人数`）  
- 状态：`待结账` 或 `部分已收`  
- **主数字：待收金额**（应收 − 已收台账）；有已收时副行显示消费总额  

## 4. 详情区信息顺序

1. **页头** — 桌号；**有顾客税号时紧随桌号强调展示**（标签清晰 + 数字 `text-lg font-semibold` + `font-mono tabular-nums` / `formatPortugueseNif`）；再是呼叫/meta、分单模式、状态。无税号不占位。  
2. **路径 / 分单编辑**（`path_chooser` | `split_edit`，仅整桌且已收=0）— 选整桌或分单（均摊 / 按菜 / 自定义）  
3. **结算摘要条** — 左侧：消费 · 应收 · 已收 · **待收**（待收高亮）；右侧：**折扣 % 输入**（默认 0，改值后应收/待收即时更新；有收款后禁用；失焦仍走原因弹窗）  
4. **待收款区（主操作）** — 强调边框；每人**本次应收**为大号数字；按钮文案 `收款 €{amount}`；有历史已收时副行显示应付总额与已收  
5. **已收款项（台账）** — 弱化样式；单行 `姓名 · 时间 — 金额`；分单时每行旁「打印收据」+（财政开）「打印发票」  
6. **本桌菜品** — 默认折叠，标题含道数  
7. **底部操作** — 打印账单；整桌已收款后「打印发票」；恢复点单；强制关台  

## 5. 金额规则

- **本次应收** = 该客人折后应付 − 本餐次已确认收款（`checkoutRowCollectAmount`）  
- **待收（摘要）** = 折后应收合计 − `session_collected_payments` 合计  
- 界面最大字号必须对应当前要收的钱，避免与分单应付总额混淆  

## 6. 财政发票（`bill_sync_to_fiscal`）

- 门禁：功能开关 + `mayFiscalBillQueue`（`checkout.sync_bill` ∧ `tables.checkout_close`）  
- 唯一编排：`runStaffPrintFiscalInvoice`（`auto_issue` 入队 → 等成功；**不关台**）  
- 文档类型：付款方式 `CASH` → `FS`，否则 `FT`  
- 桌台详情：开关开 → 隐藏关台结账、显示呼叫结账；关 → 相反。强制关台始终可有  

## 7. 相关文件

- `apps/web/src/components/dashboard/CheckoutRequestsManager.tsx` — 数据加载、主从布局  
- `apps/web/src/components/dashboard/checkout/CheckoutRequestListCard.tsx` — 队列卡片  
- `apps/web/src/components/dashboard/checkout/CheckoutRequestDetail.tsx` — 详情面板  
- `apps/web/src/components/dashboard/checkout/PrintFiscalInvoiceModal.tsx` — 发票弹窗  
- `apps/web/src/lib/checkout-settlement.ts` — 结算摘要与列表 meta  
- `apps/web/src/lib/format-dashboard-date.ts` — `formatCollectedPaymentTime`  
- `apps/web/src/lib/run-staff-print-fiscal-invoice.ts` — 打印发票编排  
- `apps/web/src/lib/bill-sync-permission.ts` — `mayFiscalBillQueue`  
