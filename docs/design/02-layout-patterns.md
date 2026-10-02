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
| 顶栏 | 紧凑身份行：店名 + 唯一桌号 chip（`CustomerTableIdentityBadge`：单行旁置，`text-base`/`font-semibold`/`border-brand-ink/45`，点餐与结账同档）；语言+主题永远地球+月亮（`appearanceChromeButtonClass('icon')` ≥44）；可选返回。类目不在顶栏 |
| 分类 | 唯一 `CustomerMenuCategoryNav`：左侧竖向一级类目栏（sole 宽 `CUSTOMER_MENU_CATEGORY_RAIL_WIDTH_CLASS` / `4.75rem`，page sticky + 竖滑，embedded 双滚动；选中左边金条 + 金色字，点类目过滤换列表、无滚动联动、无顶部横条、无「更多」浮层）；右列唯一顺序 **推荐 `catalogLeading` → sticky 二级 soft chip → 菜列表 children**（chip 贴 safe-area，与左栏同顶；不 sticky 店名顶栏）。顾客 / 员工协助 / 寿司共用 |
| 推荐 | 唯一 `CustomerRecommendedRail`：经 `catalogLeading` 挂在二级 chip **之上**、菜品网格之上；**独立浅金底 + 金色描边条**（勿复用 `MenuItemCard`）；横滑海报卡（锁死 4:3 图槽 + 两行菜名槽 + 价格齐底），点卡进详情（无角上 `+`）；金底上下同一 `py-*`；条 `min-w-0 overflow-hidden`，横滑不 `-mx` 咬出列外；不进 sticky header；空列表不渲染 |
| 菜品 | `MenuItemCard`；列表唯一 `CUSTOMER_MENU_ITEM_LIST_HOST_CLASS` + `CUSTOMER_MENU_ITEM_LIST_CLASS`（列数跟壳宽 container：1 → ≥40rem 2 → ≥62rem 3；员工「继续点餐」侧栏约 max-w-4xl 停在 2 列）；缩略图 sole CSS `--mesa-menu-card-thumb`：**窄列 88** / **≥40rem 112**；卡壳 pad/radius 同 container（窄 p-3/rounded-xl，宽 p-4/rounded-2xl）；点图/菜名打开唯一详情 `CustomerMenuItemDetailSheet`（手机全屏上滑，`lg+` 居中 Dialog；列表 `+` 仍快加） |
| 购物车 | 底部贴底固定条 → **选菜态**打开 `CartDrawer`；总份数上升时唯一反馈为底栏角标/图标短 pop（`mesa-cart-badge-pop`，无飞入）；**已点态**显示已点份数 + 「查看已点」 |
| 已点 | `OrderedDrawer`：已提交列表 + 「继续点菜」/「查看账单」（跳转现有 `BillPage`） |
| 服务员协助 | 带 `returnToWaiterHref` 时提交后自动回桌台 |

**要点**

- 壳宽唯一：`CUSTOMER_MENU_SHELL_WIDTH_CLASS`（`max-w-mobile` + `lg:max-w-[68rem]`）— 页面根、底栏、notice、cart/已点 sheet 同宽；详情 Dialog 面板用独立 `max-w-lg`，不跟宽壳
- 菜品图画幅合同：上传 sole `compressMenuImageForUpload` 将静态图 letterbox 成 `MENU_IMAGE_ASPECT_RATIO`（4:3，完整画面、留白不裁切）；展示 sole `MENU_IMAGE_OBJECT_FIT_CLASS`；图井填充 sole `MENU_IMAGE_WELL_BG_CLASS`（白，与 canvas 留白一致）。GIF 不处理。老图需重传才改变像素
- 未开台/结账中：门禁提示替代菜单网格
- 购物车 / 菜品详情为 **同页层** 非独立路由；详情唯一 `CustomerMenuItemDetailSheet`：菜图与文案同一滚动列（图高约 ⅓ 屏、仍 4:3 画幅合同）、关闭钮钉在面板、底栏唯一「步进 + 主 CTA」；打开时背后菜单不可滚；展示完整描述、过敏原（空=未标注）、限量 hint（无孤零 `+`）
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

1. **`SettlementBar`**（消费/折扣/应收/已收/待收）— sticky 底唯一 `brand-bg`；`/dashboard/checkout` 用 `checkoutSettlementBarStickyShellClass`（`belowStaffTopBar`，禁止裸 `top-0`）；楼面 sheet 用 `checkoutSettlementBarSheetStickyShellClass`（`top-0`）；窄屏「返回列表」挂在条内 leading
2. 桌号大标题 + 等待时长 + 分单模式 badge
3. **待收款区**（`border-2 border-brand-gold/35`）— 主操作
4. 已收台账（弱化 `text-[12px]`）
5. 本桌菜品（折叠）
6. 折扣区（在摘要条右侧；有收款后锁定）
7. 底部：打印、恢复点单、关台

详见 [`../checkout-dashboard-ui.zh.md`](../checkout-dashboard-ui.zh.md)

---

## 6. 分单页面

### 客人手机（`/{slug}/bill`）

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

### 员工结账台按菜（`/dashboard/checkout` · `split_edit`）

**唯一组件**：`StaffByItemSplitWorkbench`（经 `StaffCheckoutSplitEditor` → `BillSplitPanel.byItemContent`）

| 区域 | 布局 |
|------|------|
| 人条 | 顶上 chip 切人；「+ 新人」；切人**保留**各人已分份额 |
| 左 · 剩余池 | 可分数量；`+` / `½`（自助餐：大人/小孩）快捷分给当前人 |
| 右 · 当前人 | 分单标记名 + 份额列表；菜单行用唯一 `ByItemQtyInput`（整+分子/分母）；本票预估 |
| 底 | 「取消」（未收款）· 「恢复点单」· 「关台」；按人「收款」 |

**剩余真相唯一**：池剩余与右侧已分均经 `parseConsumerRows` / 具名份额（`staff-by-item-workbench`）；禁止第二套 remaining 算法。

**禁止**：在员工 `split_edit` 再挂客人 `ByItemSplitSection` 菜卡。算法仍唯一走 `bill-split-by-item*` / `useBillSplitDraft`。

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
