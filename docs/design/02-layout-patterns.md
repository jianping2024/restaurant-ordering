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

**组件**：`MenuPage`、`MenuItemCard`、`CustomerMenuItemDetailSheet`、`CartDrawer`

| 区域 | 布局 |
|------|------|
| 顶栏 | 紧凑身份行：客人点餐页左侧唯一桌号 chip（`CustomerTableIdentityBadge`，店名只在店面信息带）；结账 / 代点仍可带店名；语言+主题 sole `AppearanceChromeGroup` 胶囊；可选返回。类目不在顶栏 |
| 店面带 | 客人经典/寿司页 sole `CustomerMenuStorefrontScroll` + `CustomerStorefrontBand`（封面/Logo/营业时间 Lisbon/简介/地址电话）；空封面 sole 默认图；员工嵌入/账单页不挂 |
| 分类 | 唯一 `CustomerMenuCategoryNav`：左侧竖向一级类目栏；客人页 / 员工嵌入 **同一双栏独立滚**；右列唯一顺序 **推荐 `catalogLeading` → sticky 二级 soft chip → 菜列表**。宽壳类目栏可至 112px |
| 推荐 | 唯一 `CustomerRecommendedRail`：经 `catalogLeading`；4:3 海报卡 + 价；点开详情；勿复用 `MenuItemCard` |
| 菜品 | `MenuItemCard`；列表 qty sole 金圆 `+`/数量 → 展开 pill −/n/+；卡身 `min-h` 跟缩略图，内容多时可长高；无列表描述 |
| 同桌飘窗 | sole `CustomerMenuPeerFloats`（躲开左类目栏）；经典=他人加菜；寿司=轮次同行+收费加菜 |
| 购物车 | 底部贴底固定条（`customerBottomDockSurfaceClass` + 菜单壳宽）→ `CartDrawer`；提交成功 sole 底栏 ✓ + 袋 pop（菜单页无成功 toast）；角标在 `FooterIconSlot` 盒内 |
| 已点 | `OrderedDrawer`：已提交列表 + 「继续点菜」/「查看账单」 |
| 服务员协助 | 带 `returnToWaiterHref` 时提交后自动回桌台 |

**要点**

- 壳宽唯一：`CUSTOMER_MENU_SHELL_WIDTH_CLASS`（`max-w-mobile` + `lg:max-w-[68rem]`）— 页面根、底栏、notice、cart/已点 sheet 同宽；详情 Dialog 面板用独立 `max-w-lg`，不跟宽壳
- 菜品图画幅合同：上传 sole `compressMenuImageForUpload` 将静态图 letterbox 成 `MENU_IMAGE_ASPECT_RATIO`（4:3）；本地菜图 same-origin，不写死 LAN host
- 未开台/整桌结账中：门禁提示替代菜单网格；按菜仅本机占用时锁本机
- 购物车 / 菜品详情为 **同页层**；详情 sole `CustomerMenuItemDetailSheet`
- 服务员流提交后自动回桌台（无成功 toast）

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
| 推荐 | 已选有序列表 + 弹窗多选挑菜：勾选框（已推荐勾上禁用）+ `MenuItemListThumb` + 一级分类 chip + 确认一次提交；不是点一行即加、不是顾客 `MenuItemCard`、不是照片网格 |

**要点**

- 默认 Tab 可由 URL `?tab=` 控制
- 长表单在卡片内分段；**不在手机端塞宽表**
- 下架 = `available` badge + 切换，见业务规则「今日菜单」
- 后台目录行缩略图唯一 `MenuItemListThumb`（菜品 Tab 列表、推荐已选、推荐弹窗共用）

---

## 5. 结账页面（`/dashboard/checkout`）

**组件**：`CheckoutRequestsManager`、`CheckoutRequestListCard`、`CheckoutRequestDetail`

**任务顺序**（信息架构固定）：扫队列 → 核金额 → 收款 → 次要操作

| 视口 | 布局 |
|------|------|
| `lg+` | 左：请求列表（约 1/3）；右：详情 `sticky` |
| `<lg` | 列表全屏 ↔ 详情全屏；详情顶「← 返回列表」 |

**详情区内顺序**（不可打乱）

1. **`SettlementBar`**（消费/折扣/应收/已收/待收）— sticky 底唯一 `brand-bg`；`/dashboard/checkout` 用 `checkoutSettlementBarStickyShellClass`（`belowStaffTopBar`，禁止裸 `top-0`）；窄屏「返回列表」挂在条内 leading
2. **结账方式** — `BillSplitPanel` 三 tab + 分单结果（整桌/均摊收款；按菜 `StaffByItemSplitWorkbench`）
3. **本桌菜品（折叠）** — 唯一 `CheckoutTableItemsSection`（与订单历史同组件）
4. 底部：取消回桌台详情；整桌/均摊「恢复点单」；按菜会话脚不放恢复（打印在收款确认后询问，不在底栏）

详见 [`../checkout-dashboard-ui.zh.md`](../checkout-dashboard-ui.zh.md)

---

## 6. 分单页面

### 客人手机（`/{slug}/bill`）

**组件**：`BillPage`、`GuestClaimPanel`、`GuestClaimDishCard`、`GuestBillBottomDock`

| 阶段 | 布局 |
|------|------|
| 浏览消费 | 订单行列表 + 合计（无结算副标题堆叠） |
| 选模式 | 芯片顺序：整桌 → 按菜 → 均摊（无手填金额） |
| 按菜分单 | 每道菜一张认领卡；顶部一次名字 + 全部认领；他人认领只读块 |
| 底栏 | sole `GuestBillBottomDock`（`customerBottomDockSurfaceClass`）：编辑态上「呼叫结账」下「返回点单」；待结账/已结清只「返回点单」。任意文本框 focus 时 CSS 藏整条底栏（`globals.css`），不用键盘几何探测 |
| 已结清 | 关台后停在 settled 面（文案+评价）；不自动进菜单 |

**要点**

- 按菜：**逐菜卡片纵向滚动**；一机一人一票
- 客人无「恢复点单」「刷新页面」
- 分单模式在整桌已提交后不可自行改

### 员工结账台按菜（`/dashboard/checkout`）

**唯一组件**：`StaffByItemSplitWorkbench`（经 `StaffCheckoutSplitEditor` → `BillSplitPanel.byItemContent`）

| 区域 | 布局 |
|------|------|
| 人条 | 横滑 chip（名+€+已收✓）；串行 mint 下一未付；**无**「+添加人员」 |
| 左 · 剩余池 | 可分数量；整份/`½` 等快捷（池操作钮固定触控档，见 `staff-by-item-pool-actions-sizes.html`） |
| 右 · 当前人 | 份额列表；与左侧池子镜像的 `‹ 1份` / `‹ 1/N份` / `‹ 1A` / `‹ 1C` 退回按钮；44px 垃圾桶；空份额藏收款 |
| 会话脚 | 「取消」+（仅整桌/均摊）「恢复点单」；按菜份额区票级「恢复点单」= 解锁票 |
| 汇总 | sticky `SettlementBar`；主收款钮约 2× action 宽 |

**剩余真相唯一**：池剩余经 `parseConsumerRows`（只计具名份额）。

**禁止**：在员工按菜再挂客人菜卡；会话脚对按菜放「恢复点单」。

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
| 服务员看板 | `/dashboard/waiter` | 筛选 chip + 分组折叠区 + 桌位卡片网格 |
| 桌台详情 | `.../waiter/[tableId]` | 身份吸顶（桌号）→ 自助餐条 → 订单列表（小标题吸顶）→ 底栏操作 |
| 后厨大屏 | `/{slug}/kitchen/[screenId]` | 薄厨用顶条 + 档口分格；扁平行列表（一菜一行、大字）；最大化 = 藏顶条、单格满视口 |
| Dashboard 首页 | `/dashboard` | 指标卡 + 列表（订单、待办） |

---

## 相关文档

- [`01-design-principles.md`](./01-design-principles.md)
- [`03-component-rules.md`](./03-component-rules.md)
- 产品流程：[`../product/03-user-flows.md`](../product/03-user-flows.md)
