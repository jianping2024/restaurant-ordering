# 结账请求页 UI（`/dashboard/checkout`）

> 组件：`CheckoutRequestsManager`、`CheckoutRequestListCard`、`CheckoutRequestDetail`  
> 结算计算：`checkout-settlement.ts`  
> 续结业务规则：[`checkout-resume-ordering.zh.md`](./checkout-resume-ordering.zh.md)

## 1. 页面任务

服务员在忙时打开本页，按优先级完成：

1. **扫视队列** — 哪桌在等、等了多久、还差多少没收  
2. **核对金额** — 消费、折扣、已收、待收  
3. **确认收款** — 按分单结果逐人收款（主操作）  
4. **次要操作** — 打印账单、恢复点单、关台、折扣  

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

1. **页头** — 桌号、呼叫/meta、分单模式、状态、税号（如有）  
2. **结算摘要条** — 消费 · 折扣 · 应收 · 已收 · **待收**（待收高亮）  
3. **待收款区（主操作）** — 强调边框；每人**本次应收**为大号数字；按钮文案 `收款 €{amount}`；有历史已收时副行显示应付总额与已收  
4. **已收款项（台账）** — 弱化样式；单行 `姓名 · 时间 — 金额`  
5. **本桌菜品** — 默认折叠，标题含道数  
6. **折扣** — 有收款后禁用并说明原因  
7. **底部操作** — 打印、恢复点单、关台  

## 5. 金额规则

- **本次应收** = 该客人折后应付 − 本餐次已确认收款（`checkoutRowCollectAmount`）  
- **待收（摘要）** = 折后应收合计 − `session_collected_payments` 合计  
- 界面最大字号必须对应当前要收的钱，避免与分单应付总额混淆  

## 6. 相关文件

- `apps/web/src/components/dashboard/CheckoutRequestsManager.tsx` — 数据加载、主从布局  
- `apps/web/src/components/dashboard/checkout/CheckoutRequestListCard.tsx` — 队列卡片  
- `apps/web/src/components/dashboard/checkout/CheckoutRequestDetail.tsx` — 详情面板  
- `apps/web/src/lib/checkout-settlement.ts` — 结算摘要与列表 meta  
- `apps/web/src/lib/format-dashboard-date.ts` — `formatCollectedPaymentTime`  
