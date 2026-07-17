# 布局模式

> **状态**：阶段 4 已填充（2026-06-30）  
> **读者**：设计、前端开发、AI 代理

## 用途

记录各主要页面的布局结构与信息优先级。新功能须落入相近模式，避免另起炉灶。

**通用页面壳**

```text
┌─────────────────────────────────────┐
│ 导航（侧栏 / 顶栏 / StaffToolbar）     │
├─────────────────────────────────────┤
│ 可选：Banner（暂停营业、打印到期）    │
├─────────────────────────────────────┤
│ 主内容区（p-4 sm:p-6 lg:p-8）        │
│   └─ 卡片 / 分栏 / 网格              │
└─────────────────────────────────────┘
```

---

## 1. 桌位看板（`/dashboard/tables`）

**组件**：`TablesManager`、`TableGroupsManager`

| 区域 | 布局 |
|------|------|
| 顶栏 | 标题 + 操作（新建桌位、打印列表） |
| 主体 | 桌位卡片网格；分组可折叠 |
| 模态 | 创建/编辑桌位、删除确认 |

**要点**

- 桌位以 **卡片** 展示 `display_name`，非表格行
- 打印二维码用浏览器 `window.print()` 隐藏 `.no-print` 控件
- 分组管理与桌位列表可在同页分区，避免跳转过多

---

## 2. 点餐页面（`/{slug}/menu`）

**组件**：`MenuPage`、`MenuItemCard`、`CartDrawer`

| 区域 | 布局 |
|------|------|
| 顶栏 | 餐厅名、桌号、语言切换（PT/EN/中） |
| 分类 | 顶部分类 Tab（一级 + 可选二级） |
| 菜品 | 响应式网格 `MenuItemCard` |
| 购物车 | 底部贴底固定条 → **选菜态**打开 `CartDrawer`；**已点态**显示已点份数 + 「查看已点」 |
| 已点 | `OrderedDrawer`：已提交列表 + 「继续点菜」/「查看账单」（跳转现有 `BillPage`） |
| 服务员协助 | 带 `returnToWaiterHref` 时提交后自动回桌台 |

**要点**

- 未开台/结账中：门禁提示替代菜单网格
- 购物车为 **drawer** 非独立路由；已提交订单通过 **OrderedDrawer** 查看，不在主内容区嵌列表
- 加菜成功 Toast；服务员流 1.2s 后 redirect

---

## 3. 订单列表（`/dashboard/orders`）

**组件**：`OrdersHistoryManager`

| 区域 | 布局 |
|------|------|
| 筛选 | 日期范围（DayPicker）、桌位多选（react-select） |
| 列表 | 订单卡片：meta 行 + 菜品 chips |
| 空态 | 无订单提示 |

**要点**

- **只读**；不用表格编辑
- 菜品展示用 `order-list-display` chips，保持与结账/厨房一致
- 筛选器在窄屏纵向堆叠

---

## 4. 菜品管理（`/dashboard/menu`）

**组件**：`MenuManager`（大页，Tab 分栏）

| Tab | 内容 |
|-----|------|
| 菜品 | 分类树 + 菜品列表（内联编辑、上下架、图片） |
| 分类 | 分类 CRUD |
| 打印档口 | 嵌入 `PrintStationsManager` 或跳转 settings |

**要点**

- 默认 Tab 可由 URL `?tab=` 控制
- 长表单在卡片内分段；**不在手机端塞宽表**
- 下架 = `available` badge + 切换，见业务规则「今日菜单」

---

## 5. 结账页面（`/dashboard/checkout`）

**组件**：`CheckoutRequestsManager`、`CheckoutRequestListCard`、`CheckoutRequestDetail`

**任务顺序**（信息架构固定）：扫队列 → 核金额 → 收款 → 次要操作

| 视口 | 布局 |
|------|------|
| `lg+` | 左：请求列表（约 1/3）；右：详情 `sticky` |
| `<lg` | 列表全屏 ↔ 详情全屏；详情顶「← 返回列表」 |

**详情区内顺序**（不可打乱）

1. 桌号大标题 + 等待时长 + 分单模式 badge
2. `SettlementBar`（消费/折扣/应收/已收/待收）
3. **待收款区**（`border-2 border-brand-gold/35`）— 主操作
4. 已收台账（弱化 `text-[12px]`）
5. 本桌菜品（折叠）
6. 折扣区
7. 底部：打印、恢复点单、关台

详见 [`../checkout-dashboard-ui.zh.md`](../checkout-dashboard-ui.zh.md)

---

## 6. 分单页面（`/{slug}/bill`）

**组件**：`BillPage`、`ByItemSplitSection`、`BuffetDishAllocator`

| 阶段 | 布局 |
|------|------|
| 浏览消费 | 订单行列表 + 合计 |
| 选模式 | 均摊 / 按菜 / 自定义 分段控件 |
| 按菜分单 | 每道菜一张分配卡 `ByItemDishAllocator` + 顶部进度条 |
| 确认 | 固定底栏或显眼 gold 按钮「呼叫结账」 |

**要点**

- 按菜分单：**逐菜卡片纵向滚动**，不按宽表一行多列
- 锁定行只读样式须与可编辑行区分（`lockedLineKeys`）
- 分单模式切换在锁定后 disabled + 说明

---

## 7. 经营分析页面（`/dashboard/value-analytics`）

**组件**：`ValueAnalyticsPageClient`、`ValueAnalyticsTrendChart`、`ValueAnalyticsTopTable`

| 区域 | 布局 |
|------|------|
| 顶栏 | 标题 + 7d/30d Toggle |
| 图表 | 两行趋势图（营业额、客数） |
| 表格 | Top 菜品两张表（消费 / 备货参考） |

**要点**

- 只读 Dashboard；图表下附数据口径 disclaimer
- 表格在 `sm+` 可用；极窄屏允许横向滚动而非缩小字号到不可读

---

## 8. 设置页面（`/dashboard/settings/*`）

**组件**：`DashboardSettingsShell`、`SettingsTabs` / `settings-nav`  hub

| 结构 | 说明 |
|------|------|
| Hub | `/dashboard/settings` 卡片入口（资料、员工、功能、自助餐、打印） |
| 子页 | 各 `*Manager` / `*Panel` 单任务 |

**子页示例**

| 路径 | 主组件 |
|------|--------|
| `/settings` | `SettingsForm` |
| `/settings/staff` | `StaffAccountsManager` |
| `/settings/features` | `FeatureFlagsManager` |
| `/settings/buffet` | `BuffetSettingsManager` |
| `/settings/print-assistant` | 打印配对/设备/schedule 多个 Panel |

**要点**

- 设置页 **不** 承担菜单/桌位主管理（那些在主导航）
- 打印相关设置允许较长表单，但按 Panel 折叠分段

---

## 9. 其他高频页面（简表）

| 页面 | 路由 | 布局模式 |
|------|------|----------|
| 服务员看板 | `/{slug}/waiter` | 筛选 chip + 分组折叠区 + 桌位卡片网格 |
| 桌台详情 | `.../waiter/[tableId]` | 身份吸顶（桌号）→ 自助餐条 → 订单列表（小标题吸顶）→ 底栏操作 |
| 后厨看板 | `/{slug}/kitchen` | 分状态列（pending/cooking）+ 全屏行卡片 |
| Dashboard 首页 | `/dashboard` | 指标卡 + 列表（订单、待办） |

---

## 相关文档

- [`01-design-principles.md`](./01-design-principles.md)
- [`03-component-rules.md`](./03-component-rules.md)
- 产品流程：[`../product/03-user-flows.md`](../product/03-user-flows.md)
