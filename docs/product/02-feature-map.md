# 功能地图

> **状态**：阶段 2 已填充（2026-06-30）  
> **读者**：产品、开发、AI 代理

## 用途

按模块列出「已有功能 / 业务边界 / 当前不做 / 代码位置」。是防止 AI 乱加功能的核心索引。

每个模块结构：**已有功能** · **业务边界** · **当前不做** · **相关代码位置**

---

## 1. 桌位管理

### 已有功能

- 桌位 CRUD：`display_name`（1–16 字）、排序
- 桌位分组：命名分组、组成员、备注
- 桌位看板：空闲 / 用餐 / 待结账等状态展示
- **同行组（看板标记）**：在待结账区下方创建「同行组」，仅开台用餐中桌可加入（空闲/待结账过滤；无可选桌时提示先开台）；进组后只在该组显示；组内呼叫结账仍留在组内、不进待结账置顶；关台后自动退出同行组（空组不自动解散）；与结账/并台无关
- 软删除桌位（`deleted_at`），不硬删历史订单
- HTML `window.print()` 桌位二维码/列表兜底打印

### 业务边界

- 桌位身份 = `table_id`（UUID）；展示名 = `display_name`
- 纸面与小票**禁止**暴露 `table_id`
- 一桌同时最多一个活跃会话（`uniq_active_table_session`）
- 看板状态由活跃 `table_sessions` + 订单/结账请求推导，非独立「桌位状态列」

### 当前不做

- 桌位平面图拖拽布局
- 预定 / 候位排队
- 按区域计费
- 同行组与结账/并台/打印业务联动（仅看板标记）

### 相关代码位置

| 类型 | 路径 |
|------|------|
| 页面 | `apps/web/src/app/dashboard/tables/page.tsx` |
| UI | `apps/web/src/components/dashboard/TablesManager.tsx` |
| 分组 UI | `apps/web/src/components/dashboard/TableGroupsManager.tsx` |
| 同行组 UI | `apps/web/src/components/waiter/WaiterBoardPartySections.tsx` |
| Lib | `apps/web/src/lib/restaurant-tables.ts`、`restaurant-table-groups.ts`、`table-party-groups.ts` |
| API | `apps/web/src/app/api/dashboard/tables/route.ts`、`table-groups/route.ts`、`.../staff/waiter/table-parties/route.ts` |

---

## 2. 开台流程

### 已有功能

- 自助餐开台：服务员录入成人/儿童数，写入 `buffet_base` 订单行
- 改人数：仅更新自助餐行金额，不动已有 menu 行与厨房状态
- 无变化 no-op：成人/儿童分项比较（非总人数），未变则不写库
- 非自助餐场景：服务员操作可创建 `open` 会话（`openTableSessionIfAbsent`）
- 开台优先：无 active `buffet_base` 时顾客与服务员均不可加菜

### 业务边界

- 开台是会话 `status=open` + 存在有效自助餐基准行的组合条件（见 `guestOrderingEnabled`）
- 计价依赖 `resolve_buffet_prices` RPC 与日历规则（工作日/周末/节假日）
- 乐观 UI 更新后与服务端 `fetchWaiterTableDetail` 对齐

### 当前不做

- 顾客自助开台（无服务员）
- 非自助餐餐厅的独立「开台费」SKU（无 buffet 配置时逻辑不同）
- 开台时预选菜品

### 相关代码位置

| 类型 | 路径 |
|------|------|
| API | `apps/web/src/app/api/restaurants/[slug]/staff/waiter/buffet/route.ts` |
| Lib | `apps/web/src/lib/buffet-open-table.ts`、`buffet-order.ts`、`table-session-open.ts` |
| 门禁 | `apps/web/src/lib/guest-table-ordering.ts` |
| UI | 服务员桌台详情内自助餐面板（`WaiterTableDetail.tsx` / Layout） |
| 设置 | `apps/web/src/app/dashboard/settings/buffet`、`BuffetSettingsManager.tsx` |

---

## 3. 点餐流程

### 已有功能

- 顾客扫码菜单：`/{slug}/menu`，三语切换、分类浏览、购物车
- 服务员协助点餐：从看板带 `from=waiter` 跳转菜单，回桌台路径编码在 URL
- 加菜入队：`POST .../orders/append`，合并同会话订单项
- 地理围栏：可配置 `order_radius_meters`，超距拒绝下单
- 点餐门禁：会话 `open` + 已开台；`billing` 时禁止加菜
- Demo 菜单：`/demo/menu` 无后端

### 业务边界

- 仅 `available=true` 的菜品可加菜
- 价格以服务端 `resolve-append-cart-items` 为准，不信任客户端价格
- 新单默认进入 `pending`，订单级状态由 items 推导
- 加菜成功后自动触发出品联入队（`station-ticket-enqueue`）

### 当前不做

- 顾客账号登录 / 历史订单
- 套餐组合定价（除自助餐人头外）
- 桌边支付
- 无开台时跳过自助餐规则的纯点餐模式（当前代码强制 buffet_base）

### 相关代码位置

| 类型 | 路径 |
|------|------|
| 页面 | `apps/web/src/app/[slug]/menu/page.tsx`、`demo/menu/page.tsx` |
| UI | `apps/web/src/components/menu/MenuPage.tsx`、`CartDrawer.tsx` |
| API | `apps/web/src/app/api/restaurants/[slug]/orders/append/route.ts` |
| Lib | `apps/web/src/lib/resolve-append-cart-items.ts`、`customer-menu-order-gate.ts`、`customer-geo-order.ts` |
| 顾客会话 | `apps/web/src/app/api/restaurants/[slug]/customer/session/route.ts` |

---

## 4. 菜品管理

### 已有功能

- 分类树：多语言名称、排序、打印档口绑定、`item_code`
- 菜品 CRUD：中葡英名称与描述、价格、VAT、emoji、图片上传
- 打印档口管理：kitchen / beverage / standard 布局
- 菜品排序：分类内与全局 sort_order
- 备注预设键（`note_preset_keys`）

### 业务边界

- 店主与 frontdesk 可通过 `/dashboard/menu` 管理（角色见 feature registry）
- `/dashboard/settings/menu` 已重定向到 settings 主页；**菜单管理主入口是 `/dashboard/menu`**
- 分类与菜品变更即时影响顾客菜单（无草稿发布流）

### 当前不做

- 菜单版本 / 定时上下架（除 `available` 开关外）
- 多规格 SKU（大小杯、辣度加价等）
- 配方 / BOM
- 批量 Excel 导入

### 相关代码位置

| 类型 | 路径 |
|------|------|
| 页面 | `apps/web/src/app/dashboard/menu/page.tsx` |
| UI | `apps/web/src/components/dashboard/MenuManager.tsx` |
| Lib | `apps/web/src/lib/dashboard-menu-server.ts`、`dashboard-menu-client.ts`、`menu-admin.ts`、`print-station-admin.ts` |
| API | `apps/web/src/app/api/dashboard/menu/items/route.ts`、`categories/route.ts`、`print-stations/route.ts` |

---

## 5. 今日菜单（上下架）

### 已有功能

- 菜品 `available` 布尔字段：一键上架/下架（「今日不在菜单」）
- 下架菜品在管理页显示 badge；加菜 API 返回 `menu_item_unavailable`
- 无独立「日结菜单」表或按日快照

### 业务边界

- **「今日菜单」= 当前 `menu_items.available` 状态**，不是按自然日自动重置的菜单计划
- 下架不删除菜品数据，可随时重新上架
- 自助餐规则与日历覆盖影响的是**人头价格**，不是单品上下架

### 当前不做

- 按日期预设明日菜单
- 沽清数量（卖完自动下架）
- 时段菜单（午餐/晚餐不同列表）

### 相关代码位置

| 类型 | 路径 |
|------|------|
| UI 切换 | `apps/web/src/components/dashboard/MenuManager.tsx`（`toggleAvailableTitle`） |
| 加菜校验 | `apps/web/src/lib/resolve-append-cart-items.ts` |
| Schema | `menu_items.available`（见 `docs/ai-schema.md`） |

---

## 6. 订单管理

### 已有功能

- Dashboard 订单历史：按日期范围、桌位筛选
- 订单列表展示：菜品 chip、数量、客人标签、金额
- 首页概览：今日订单数、营业额、进行中订单、最近订单
- 厨房/服务员看板：活跃订单实时刷新（Realtime）
- 订单数据存于 `orders.items` JSONB，含行级 `item_status`

### 业务边界

- 历史页为**只读查看**，不在此修改订单状态
- 订单归属 `session_id` + `table_id` + `display_name` 快照
- 订单级 `status` 由 items 聚合（`deriveOrderStatusFromItems`）
- 合并/转台后订单挂到目标会话与桌位

### 当前不做

- 订单导出 CSV / 会计对接
- 跨餐厅订单搜索
- 厨房历史单归档查询（看板侧重活跃单）

### 相关代码位置

| 类型 | 路径 |
|------|------|
| 页面 | `apps/web/src/app/dashboard/orders/page.tsx`、`dashboard/page.tsx` |
| UI | `apps/web/src/components/dashboard/OrdersHistoryManager.tsx`、`DashboardPageClient.tsx` |
| Lib | `apps/web/src/lib/staff-board.ts`、`order-list-display.ts`、`dashboard-overview.ts` |
| 状态 | `apps/web/src/lib/order-status.ts` |
| 类型 | `apps/web/src/types/index.ts`（`Order`、`OrderItem`） |

---

## 7. 退菜 / 修改数量

### 已有功能

- 后厨：将订单行标为 `voided`（须 `VoidItemReasonDialog` 填原因）
- 楼面（前台 / 收银员）：`/dashboard/waiter` 桌台详情减数量（`decrement-item`），`pending`/`cooking` 可减；点减号直接生效，无弹框
- 服务员（`/{slug}/waiter`）：**不可**菜单减数量（API `403 menu_decrement_not_allowed`）
- 减到 0 等价退菜，写 `void_reason`（reason 默认 `qty_adjustment`），不写 `operation_logs`，不进异常队列
- 风险等级（后厨 void）：pending→LOW、cooking→MEDIUM、done→HIGH

### 业务边界

- 已 `done` 的菜品由**后厨**退菜时风险更高，须记录 `ITEM_DELETED` 类异常
- 退菜后重算订单 status；全 void 时订单特殊处理
- 厨房 Demo 模式允许本地 void，不写库

### 当前不做

- 顾客自助退菜
- 退菜自动退款（无支付网关）
- 退菜后自动重打厨房联（P2）

### 相关代码位置

| 类型 | 路径 |
|------|------|
| Lib | `apps/web/src/lib/order-item-void/*`、`apps/web/src/lib/order-item-decrement/decrement-policy.ts` |
| API | `apps/web/src/app/api/restaurants/[slug]/staff/waiter/orders/[orderId]/decrement-item/route.ts` |
| UI | `KitchenDisplay.tsx`（后厨 void + 原因弹框）、`WaiterTableDetail.tsx` + `WaiterOrderQtyMinus.tsx`（楼面减号，无弹框） |
| 审计 | `apps/web/src/lib/audit/builders/item-deleted.ts` |

---

## 8. 结账流程

### 已有功能

- 顾客呼叫结账：`checkout/request`，会话进入 `billing`
- 结账台队列：按桌展示等待时长、分单模式、待收金额
- 按人确认收款：`confirm-payment`，写入 `session_collected_payments`
- 折扣：折后金额 + 原因，有收款后不可再改
- 恢复点餐：`resume-ordering`，会话回 `open`
- 关台：收讫或强制未付关台（原因 + 异常记录）
- 收银员角色仅见结账页

### 业务边界

- 结账以 **bill_split + 收款台账** 为准，不是直接改 `orders.total`
- 多人分账须逐人收款；摘要「待收」= 折后应收 − 已收合计
- 确认收款与并发安全见专项文档（RPC / 竞态防护）
- `bill_receipt_print` 功能关时跳过自动账单 print_jobs，手动打印不受影响

### 当前不做

- 银行卡 / MB Way 等在线支付
- 自动小费 / 服务费行
- 发票税务系统对接（仅有顾客 NIF 字段）
- 跨会话合并结账

### 相关代码位置

| 类型 | 路径 |
|------|------|
| 页面 | `apps/web/src/app/dashboard/checkout/page.tsx` |
| UI | `apps/web/src/components/dashboard/CheckoutRequestsManager.tsx`、`checkout/*` |
| API | `apps/web/src/app/api/restaurants/[slug]/checkout/*` |
| Lib | `apps/web/src/lib/checkout-confirm-payment.ts`、`checkout-settlement.ts`、`checkout-session-payments.ts`、`table-checkout-pending.ts` |
| 关台 | `apps/web/src/components/dashboard/CloseTableSessionAction.tsx`、`lib/table-session/close-table-session.*` |

---

## 9. 打印流程

### 已有功能

- 出品联：加菜后 `station_ticket` 自动入队
- 账单类：`order_receipt`、`pre_bill` 入队（受 `bill_receipt_print` 门控）
- 打印代理：配对码、claim JWT、轮询 `pending-jobs`、TCP/WinSpool 打印
- Dashboard：打印助手、设备列表、吊销、档口映射、重试失败任务
- 手动打印账单：结账详情「打印账单」
- 无代理时：`TablesManager` HTML 打印兜底

### 业务边界

- 打印成功**不驱动**订单状态变更
- `print_jobs` 租户隔离；代理 JWT 绑定 `restaurant_id` + device
- 纸面语言读 `restaurants.print_locale`（默认 `pt`）
- 任务状态：pending → processing → done | failed

### 当前不做

- Mac 代理
- 58mm 模板
- 按单档选择性重打 UI（P2）
- 打印队列离线缓存（代理需能访问云 API）

### 相关代码位置

| 类型 | 路径 |
|------|------|
| Web API | `apps/web/src/app/api/print-agent/*`、`order-receipt/print/route.ts`、`station-tickets/auto/route.ts` |
| Lib | `apps/web/src/lib/order-receipt-enqueue.ts`、`station-ticket-enqueue.ts`、`print-agent-*` |
| UI | `PrintAgentPairingPanel`、`PrintAgentDevicesPanel`、`PrintStationsManager`、`ReceiptBillPrinterPanel` |
| 代理 | `apps/print-agent/`（`escpos.go`、`poll.go`、`job_route.go` 等） |
| 共享 | `packages/shared/src/print-agent-*.ts` |

---

## 10. 分单流程

### 已有功能

- 顾客账单页 `/{slug}/bill`：查看会话消费
- 三种模式：`even`（均摊）、`by_item`（按菜）、`custom`（自定义金额）
- 按菜分单：菜品分配到消费者姓名、数量拆分
- 消费者姓名 roster、自助餐菜品分配 UI
- 分单确认 → `bill_splits` 持久化 → 可发起结账请求
- 结账台展示分单结果与逐人应收

### 业务边界

- 分单数据在 `bill_splits.persons` / `result` JSONB
- 按菜分单金额算法以 `bill-split-by-item.ts` 为唯一真相
- 会话 `billing` 后菜单禁止加菜；恢复点单须走 checkout resume
- 纸面展示桌名用 `display_name`

### 当前不做

- 分单中途切换模式（已确认分单后的迁移规则需专项定义）
- 电子发票按分单人开具
- 与外部 POS 同步分单

### 相关代码位置

| 类型 | 路径 |
|------|------|
| 页面 | `apps/web/src/app/[slug]/bill/page.tsx` |
| UI | `apps/web/src/components/menu/BillPage.tsx`、`ByItemSplitSection.tsx`、`BuffetDishAllocator.tsx` |
| Lib | `apps/web/src/lib/bill-split-by-item.ts`、`bill-split-draft.ts`、`bill-split-validate.ts`、`use-by-item-split-state.ts` |
| API | `apps/web/src/app/api/restaurants/[slug]/customer/bill/route.ts` |

---

## 11. 经营分析

### 已有功能

- 增值分析页 `/dashboard/value-analytics`（**仅店主**）
- 7 天 / 30 天切换：营业额趋势、客单趋势
- Top 菜品消费与备货参考（备货固定最近 7 天）
- 口径：已收款关台的 `table_sessions`，归属日按 Lisbon `closed_at`

### 业务边界

- 只读；不改变营业数据
- 营业额优先 `bill_splits` 实收，无 paid split 时回退 orders 合计
- 排除 voided 行；自助餐基准行特殊处理（`isBuffetBaseItem`）
- API 不接受客户端 `restaurant_id`，服务端从 owner 会话解析

### 当前不做

- 实时大屏 / TV 模式
- 导出 PDF 报表
- 员工绩效 / 服务员提成
- 快照表或预聚合 cron（V1 纯查询聚合）

### 相关代码位置

| 类型 | 路径 |
|------|------|
| 页面 | `apps/web/src/app/dashboard/value-analytics/page.tsx` |
| UI | `apps/web/src/components/dashboard/ValueAnalyticsPageClient.tsx` |
| API | `apps/web/src/app/api/analytics/value-overview/route.ts` |
| Lib | `apps/web/src/lib/analytics/*` |

---

## 12. 设置管理

### 已有功能

- 餐厅资料：名称、地址、电话、Logo、国家码、点餐地理半径
- 员工账号：kitchen / waiter / cashier / frontdesk CRUD、禁用、重置密码
- 功能开关：`kitchen_board`、`bill_receipt_print`
- 自助餐规则：时段、价格矩阵、周五晚周末、日历覆盖
- 打印助手：配对、设备、档口、账单打印机、营业时间 schedule
- 桌位与分组：也可从 `/dashboard/tables` 进入（设置 hub 外）

### 业务边界

- 设置子导航见 `settings-nav.ts`：profile / staff / features / buffet / print-assistant
- 桌位、菜单管理在 Dashboard 主导航，不在 settings 子页（`settings/menu` 已 redirect）
- `plan`（free/pro）影响功能限制（如桌位数），非完整计费系统
- 餐厅暂停（`suspended_at`）后顾客见维护页

### 当前不做

- 店主自助升级 Stripe 订阅
- `print_locale` Dashboard 三选一 UI（**DB 已用，UI 缺失**）
- 多门店连锁总部账号

### 相关代码位置

| 类型 | 路径 |
|------|------|
| 页面 | `apps/web/src/app/dashboard/settings/**` |
| UI | `SettingsForm.tsx`、`StaffAccountsManager.tsx`、`FeatureFlagsManager.tsx`、`BuffetSettingsManager.tsx`、打印相关 Panel |
| API | `apps/web/src/app/api/restaurant/settings/route.ts`、`features/route.ts`、`dashboard/staff/*` |
| Lib | `apps/web/src/lib/settings-nav.ts`、`restaurant-features.ts`、`staff-account.ts` |

---

## 13. 语言设置

### 已有功能

- **界面语言**（顾客 / 员工 / Dashboard）：pt / en / zh，浏览器端 `LanguageProvider` + `LanguageSwitcher`
- **菜单文案**：菜品与分类 `name_pt` / `name_en` / `name_zh`（缺失时回退）
- **打印语言**：`restaurants.print_locale`（zh | en | pt），用于 ESC/POS 出票
- **代理 UI 语言**：print-agent 自有 `ui_locale`（Windows 托盘/向导）

### 业务边界

- 界面语言与打印语言**解耦**（顾客看中文菜单，小票仍可葡语）
- 界面语言存在 localStorage，按页面切换
- `country_code`（ISO-2）在设置页可编辑，与票面语言无关

### 当前不做

- 店主配置默认顾客语言（每次靠用户切换）
- Dashboard 修改 `print_locale` 的 UI（当前仅 DB/API 侧读取，默认 `pt`）
- 自动翻译菜品（须人工维护三语字段）

### 相关代码位置

| 类型 | 路径 |
|------|------|
| 界面 i18n | `apps/web/src/lib/i18n/messages.ts`、`i18n/menu-page-messages.ts`、`components/providers/LanguageProvider.tsx` |
| 打印 locale | `restaurants.print_locale`；读取于 `station-ticket-enqueue.ts`、`order-receipt-enqueue.ts`、`print-agent/claim` |
| 设置 | `apps/web/src/components/dashboard/SettingsForm.tsx`（country_code；**无 print_locale 表单项**） |

---

## 14. 异常状态处理

### 已有功能

- 自动记录：折扣、退菜（item deleted）、未付关台
- 风险等级 LOW / MEDIUM / HIGH
- 店主队列：待确认 / 已确认 / 已忽略
- 筛选：日期范围、类型、状态、桌位
- 与 `operation_logs` 审计链关联

### 业务边界

- **仅店主**可确认/忽略（`/dashboard/abnormal-operations`）
- 异常记录不自动阻断营业，但形成对账与追溯义务
- 状态迁移受 `canTransitionAbnormalStatus` 约束

### 当前不做

- 异常自动告警（邮件/短信）
- 服务员端异常 inbox
- AI 风险评分

### 相关代码位置

| 类型 | 路径 |
|------|------|
| 页面 | `apps/web/src/app/dashboard/abnormal-operations/page.tsx` |
| UI | `apps/web/src/components/dashboard/AbnormalOperationsManager.tsx` |
| API | `apps/web/src/app/api/dashboard/abnormal-operations/*` |
| Lib | `apps/web/src/lib/abnormal-operations/*`、`audit/*` |

---

## 模块依赖简图

```text
开台 → 点餐 → 订单 → 厨房/退菜
              ↓
         分单 → 结账 → 关台 → 经营分析
              ↓
            打印（出品联 / 账单）
              ↓
         异常操作（折扣/退菜/未付关台）
```

---

## 相关专题文档

| 领域 | 文档 |
|------|------|
| 桌位 / 分组 | [`../restaurant-tables-design.zh.md`](../restaurant-tables-design.zh.md) |
| 转台 / 并台 | [`../table-transfer-merge-plan.zh.md`](../table-transfer-merge-plan.zh.md) |
| 结账 UI | [`../checkout-dashboard-ui.zh.md`](../checkout-dashboard-ui.zh.md) |
| 打印 | [`../print-agent-flow.zh.md`](../print-agent-flow.zh.md) |
| 自助餐 | [`../buffet-open-table.zh.md`](../buffet-open-table.zh.md) |
| 经营分析 | [`../value-analytics-design.zh.md`](../value-analytics-design.zh.md) |
| 功能开关 | [`../restaurant-features.zh.md`](../restaurant-features.zh.md) |
