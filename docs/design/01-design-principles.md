# 设计原则

> **状态**：阶段 4 已填充（2026-06-30）  
> **读者**：设计、前端开发、AI 代理

## 用途

UI 修改的设计依据。禁止凭感觉或临时截图改页面；改前先对照本文与 [`02-layout-patterns.md`](./02-layout-patterns.md)。

---

## 1. 餐馆员工操作优先

现场员工在嘈杂、忙碌环境中使用，**完成一单比好看更重要**。

| 做法 | 反例 |
|------|------|
| 结账台先展示「待收金额」与「收款 €X」按钮 | 把消费明细铺满首屏 |
| 服务员看板用颜色区分待结账 / 用餐 / 空闲 | 仅靠小图标区分状态 |
| 桌号 `display_name` 用大号标题（结账详情 `text-3xl`） | 展示 table UUID |
| 操作失败用 Toast + 可理解文案 | 仅 console.error |

**默认用户**：前台收银员、服务员、后厨 — 不是设计师或开发者。

---

## 2. 移动端优先

主路径在手机完成：

- 顾客扫码点餐 `MenuPage`
- 顾客账单分单 `BillPage`
- 服务员看板 `WaiterDisplay`、桌台详情
- 结账台手机端全屏详情 + 返回列表

Dashboard 在 `lg` 以下有**顶部汉堡栏 + 固定侧栏抽屉**；内容区 `pt-20` 避让顶栏。

**断点约定**（Tailwind 默认）：

| 断点 | 典型用途 |
|------|----------|
| 默认 | 单列、抽屉、全屏详情 |
| `sm:` | 略增内边距、按钮横排 |
| `lg:` | Dashboard 侧栏常驻、结账主从分栏 |

---

## 3. 高频操作明显

主 CTA 使用 **`Button variant="gold"`** 或结账专用 **`mesa-badge-success`** 绿底收款按钮。

| 场景 | 主操作样式 |
|------|------------|
| 提交订单 | 购物车抽屉底部 gold 全宽按钮 |
| 确认收款 | 绿底 `收款 €{amount}`，金额与按钮相邻 |
| 确认开台 | 服务员桌台 gold 主按钮 |
| 次要操作 | `outline` / `soft` / 文字链接 |

**字号**：当前应收金额 ≥ 结账按钮旁金额（`text-base` + `font-semibold` + `text-brand-gold`）；摘要条中「待收」用 `font-semibold text-brand-gold`。

---

## 4. 危险操作二次确认

禁止使用 `window.confirm`。统一用应用内对话框：

| 场景 | 组件 |
|------|------|
| 通用确认（关台、恢复点餐等） | `ConfirmModal`（可选 `variant="danger"`） |
| 须选原因 + 可选详情 | `ReasonConfirmDialog` |
| 后厨退菜（须选原因 + 可选详情） | `VoidItemReasonDialog`（封装 `ReasonConfirmDialog`） |
| 简单提示 | `PromptModal`（少用） |

危险动作用 **`danger`** 或 **`close`**（关台玫瑰色边框）变体，须明确后果文案。

---

## 5. 页面结构保持一致

### Shell 模式

| 区域 | Dashboard | 服务员/后厨 | 顾客 |
|------|-----------|-------------|------|
| 导航 | 顶栏 `DashboardTopBar` | `StaffPersonalTopBar`（品牌/店名/角色 + 设置） | 页内顶栏 + 语言切换 |
| 背景 | `bg-brand-bg` | 同左 | 同左 |
| 内容卡片 | `bg-brand-card border border-brand-border rounded-xl` | 看板卡片分状态色 | `MenuItemCard` 网格 |

### 标题层级

- 页面主标题：`font-heading` + `text-brand-gold` 或 `text-brand-text`
- 桌号/金额：`font-heading` + 大号数字
- 辅助说明：`text-brand-text-muted` + `text-[13px]` 或 `text-sm`

### 三语

所有面向用户的文案走 `getMessages(lang)` 或模块 messages（如 `MENU_PAGE_MESSAGES`），**禁止硬编码单语**（Demo/开发注释除外）。

---

## 6. 不为了视觉效果牺牲效率

| 原则 | Mesa 实践 |
|------|-----------|
| 减少层级 | 结账菜品列表**默认折叠** |
| 一屏一事 | 手机结账：列表 OR 详情，不同时挤在一起 |
| 不炫动画 | 仅 `transition-colors`、`Modal` 淡入；禁止长动画阻塞操作 |
| 表格克制 | 经营分析、订单历史可用表；服务员/顾客路径用卡片 |
| 复用组件 | 新按钮用 `Button`；新弹窗用 `Modal` 壳 |

---

## 视觉令牌（须复用）

定义于 `apps/web/src/app/globals.css` + `tailwind.config.ts`：

| 令牌 | 用途 |
|------|------|
| `brand-bg` | 页面背景 |
| `brand-card` | 卡片、抽屉、Modal 底 |
| `brand-border` | 分割线、边框 |
| `brand-gold` | 主色、强调金额、标题点缀 |
| `brand-text` | **正文主色**（菜品名、金额、桌号、时长必须用此色，禁止灰/`muted`） |
| `brand-text-muted` | 仅次要说明 / 占位 / 非关键标签 |
| `font-heading` / `font-body` | 标题 / 正文；CJK 回退由 Tailwind + `globals.css` 统一 |

### 楼面文字角色（服务员看板 / 桌台详情）

以已点菜品为锚；角色类在 `waiterFloorType`（`waiter-table-detail-ui.tsx`），禁止业务页再写零散 `text-[13px]` 扛套餐名或主操作。

| 角色 | 字号 | 用途 |
|------|------|------|
| 页面标题 | `font-heading` + `text-2xl`/`3xl` | 桌台详情标题 |
| 列表/区块正文 | `text-lg font-semibold text-brand-text` | **已点菜名**、**Buffet 套餐名**（同级） |
| 控件 | `Button size="action"`（`text-[15px]`） | 保存人数、继续点餐、转台等 |
| 价格/人数 | `text-[15px] font-medium text-brand-text` | 成人/儿童价、人数标签（非灰） |
| 次要说明 | `text-sm` + muted | 仅加载中等非关键文案 |

支持 **明/暗主题**（`ThemeProvider` 写 `data-theme`）。Tailwind `dark:` 必须跟随 `[data-theme="dark"]`（见 `tailwind.config.ts`），**禁止**依赖系统 `prefers-color-scheme`。改色须同时检查 `:root` 与 `[data-theme='light']` 两套 CSS 变量。

状态色（业务语义，经 `--color-status-*` / `mesa-badge-*` / `mesa-board-shell-*`）：

- 待结账 `checkout`：warning（琥珀）
- 用餐中 `dining`：danger（红）
- 空闲 `idle`：success（绿）
- 看板卡片壳：`mesa-board-shell-*`（按 `data-theme` 分条声明，色值与 `--color-status-*` 对齐）；正文一律 `brand-text`，状态色只用于壳/徽章/边框
- 成功/收款：`mesa-badge-success`
- 危险操作：`Button danger` / `mesa-text-danger`

---

## 修改 UI 时的检查清单

1. 主操作是否一眼可见？
2. 手机单列是否可完成全流程？
3. 金额是否 `tabular-nums` 且对齐？菜品名/金额是否为 `brand-text` 或 `brand-gold`（非灰）？
4. 危险操作是否有确认 + 原因？
5. 文案是否三语？
6. 是否复用 `components/ui/*` 与 status/`mesa-*` 令牌（不另起一套 Tailwind 色盘 + `dark:` media）？
7. 是否破坏结账/看板/账单页已有信息顺序（见 layout-patterns）？
8. 明暗主题切换后，关键文字对比度是否仍清晰？

---

## 相关文档

- [`02-layout-patterns.md`](./02-layout-patterns.md)
- [`03-component-rules.md`](./03-component-rules.md)
- [`04-mobile-rules.md`](./04-mobile-rules.md)
- 结账 UI 专项：[`../checkout-dashboard-ui.zh.md`](../checkout-dashboard-ui.zh.md)
