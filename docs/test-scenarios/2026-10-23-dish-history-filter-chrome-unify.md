# 本次改动业务场景测试报告：当日菜品检索 · 筛选条控件皮统一

日期：2026-10-23  
分支：`fix/dish-history-filter-unify`  
UAT base：`http://localhost:3006`（功能 worktree，非 `:3000`）

## 1. 本次修改

- **内容**：桌号多选控件皮与旁边「菜名或编号」`Input` 对齐（`brand-card` 底、`rounded-lg`、同高、金色聚焦环）；当日菜品页桌号标签改与 `Input` 标签同色；不改筛选语义。
- **文件**：`DashboardTableMultiSelect.tsx`、`DishHistoryManager.tsx`；设计对照稿 `docs/design/dish-history-filter-unify-mockup.html`。
- **角色 / 页面**：有 `dashboard.dish_history.view` → `/dashboard/dish-history`；订单历史页同用该桌号控件，外观一并变化。

## 2. 核心业务规则

1. 【已实现】未选桌 = 不按桌过滤；选了 = 按 `table_ids` 过滤（与改前相同）。
2. 【已实现】`q` 与桌号可同时生效；仍走 `useDashboardListQuery` 防抖查询。
3. 【本次新增】仪表盘桌号多选控件皮唯一写法在 `DashboardTableMultiSelect` 的 `selectStyles`：底 `brand-card`、圆角 8、minHeight 44、聚焦金环；禁止再平行一套 `brand-bg`/尖角 control。
4. 【本次新增】当日菜品页桌号标签与 `Input` 标签同为 `text-sm font-medium text-brand-text-muted`。

## 3. 详细测试场景

### 场景 1：打开页面两控件皮一致（视觉）

- **前置状态**：店主登录白云；打开当日菜品检索。
- **操作过程**：看顶栏「桌号」与「菜名或编号」并排空态。
- **预期结果**：两框同为卡片浅底、约 8px 圆角、高度接近；标签均为次要色。
- **数据验证**：不改列表数据；`GET dish-history` 无 `table_ids`/`q` 时仍 200。
- **异常恢复**：刷新后仍一致。
- **结果**：【已验证】DOM 测：select `bg=rgb(247,244,238)` `radius=8px` `h=44`；input 同底同圆角 `h=46`；标签色同 `rgb(138,131,119)`

### 场景 2：选桌后筛选仍正确

- **前置状态**：同场景 1。
- **操作过程**：桌号选 Mesa A-01。
- **预期结果**：chip 出现在圆角卡片框内；API 带 `table_ids` 仍 200。
- **数据验证**：`GET …/dish-history?table_ids=<A-01 uuid>` → 200；当日 `total=0` 无行属数据空，非回归失败。
- **异常恢复**：—
- **结果**：【已验证】UI chip「Mesa A-01」+ API table_ids

### 场景 3：菜名过滤不受样式改动影响

- **前置状态**：同场景 1。
- **操作过程**：API `q=sushi`。
- **预期结果**：接口 200，筛选语义不变。
- **数据验证**：`GET …/dish-history?q=sushi` exit=0。
- **异常恢复**：—
- **结果**：【已验证】API

### 场景 4：订单历史桌号多选仍可用（回归）

- **前置状态**：店主可进订单历史。
- **操作过程**：打开 `/dashboard/orders`；量 control 皮。
- **预期结果**：同 sole 组件皮（brand-card / 8px / h=44）。
- **数据验证**：`orders-table-select__control` 测得同值。
- **异常恢复**：—
- **结果**：【已验证】

### 场景 5：并发与权限（本次不适用说明）

- 本次仅控件皮 CSS，无写入路径变更。
- **多用户并发 / 本地旧草稿冲突 / 断网重试写库**：不适用。【设计建议】不必为样式单测补并发。
- **无权限账号**：【未验证】（权限门未改）

## 4. 实际测试结果

| 项 | 结果 |
|---|---|
| stack-health | pass |
| owner 登录 | pass |
| dish-history API | pass |
| UI 视觉对齐 | pass |
| 选桌筛选 | pass（UI + API；当日无菜行） |
| 菜名筛选 | pass（API） |
| 订单历史回归 | pass |
| 清冗余 scan | pass |
| lint+typecheck | pass（`gate.sh check`） |

## 5. 风险与待确认

- 订单历史页筛选条在卡片内，桌号改为 `brand-card` 后与卡片底同色，边框仍可见；若 Will 觉得「嵌在卡片里偏平」，可另议外层壳，不在本次回滚筛选逻辑。
- 当日无菜品行：筛选语义靠 API 200 + 既有 table_ids 契约验证；未做「有数据时列表只剩一桌」的 UI 行断言（【未验证】有数据子集；【已验证】接口与控件交互）。
