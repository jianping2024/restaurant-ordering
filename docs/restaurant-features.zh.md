# 餐厅功能开关（Feature Flags）

## 概述

店主可在 **餐厅设置 → 功能管理**（`/dashboard/settings/features`）控制可选产品模块是否在后台侧栏显示。

当前内置功能：

| 功能键 | 默认 | 作用 |
|--------|------|------|
| `kitchen_board` | **关闭** | 勾选后在后台侧栏底部显示「厨房看板」快捷入口 |
| `bill_receipt_print` | **关闭** | 勾选后自动入队预账单、分单小票与结账小票；未勾选时跳过自动打印（厨房单不受影响）；后台「打印账单」手动补打不受影响 |

未勾选厨房看板时，侧栏不显示厨房看板链接；厨房页面本身（`/{slug}/kitchen`）与员工登录入口不受影响，仍可直接访问。

未勾选打印账单时，呼叫结账与确认收款流程照常，仅跳过自动触发的 `pre_bill` / `split_payment` / `final` 类 `print_jobs` 入队；员工在结账详情手动点「打印账单」（`checkout_bill`）仍会入队。

## 数据模型

`restaurants.feature_flags`：`jsonb`，默认 `{}`。

示例：

```json
{ "kitchen_board": true, "bill_receipt_print": true }
```

- 键缺失 → 使用代码中的默认值（见 `src/lib/restaurant-features.ts`）
- 值为 `boolean`
- 未知键在 PATCH 时被忽略，不会写入

## 架构（可扩展）

功能项分两层注册：

1. **`RESTAURANT_FEATURE_MODULES`** — 按页面/产品模块分类（仅 UI 与代码组织，**不写入数据库**）
2. **`RESTAURANT_FEATURE_DEFINITIONS`** — 具体开关项，每条必须指定 `moduleId`

当前模块：

| 模块 ID | 设置页分组名 | 说明 |
|---------|--------------|------|
| `dashboard_nav` | 后台导航 | 控制后台侧栏快捷入口 |
| `billing` | 结账与账单 | 结账流程相关可选行为 |

功能定义示例：

```ts
// 模块
{ id: 'dashboard_nav', labelKey: 'moduleDashboardNav', sortOrder: 10 }

// 功能项
{
  key: 'kitchen_board',
  moduleId: 'dashboard_nav',
  defaultEnabled: false,
  labelKey: 'kitchenBoard',
  descKey: 'kitchenBoardDesc',
  dashboardShortcut: 'kitchen',
}
```

设置页通过 `groupRestaurantFeaturesByModule()` 按模块分组渲染；空模块自动隐藏。

新增功能时按顺序：

1. 在 `RestaurantFeatureKey` 增加键名
2. 若属于新页面模块：在 `RestaurantFeatureModuleId` 与 `RESTAURANT_FEATURE_MODULES` 增加模块（含 `sortOrder`、i18n `module*` 文案）
3. 在 `RESTAURANT_FEATURE_DEFINITIONS` 增加一条（含 `moduleId`、`defaultEnabled`、文案 key、可选 `dashboardShortcut`）
4. 在 `src/lib/i18n/messages.ts` 的 `featureSettings` 增加对应文案（zh / en / pt）
5. 在需要受控的 UI 或服务端逻辑调用 `isRestaurantFeatureEnabled(flags, key)`
6. 若新功能影响 schema 语义，更新 `docs/ai-schema.md`

无需为每个功能单独加列；jsonb 只存 `{ "kitchen_board": true }` 等布尔值，模块分类完全由注册表驱动。

## API

### `GET /api/restaurant/features`

店主会话。返回归一化后的开关：

```json
{ "flags": { "kitchen_board": false, "bill_receipt_print": false } }
```

### `PATCH /api/restaurant/features`

请求体：

```json
{ "flags": { "kitchen_board": true } }
```

- 仅店主可写（`getOwnerRestaurantId`）
- 与服务端注册表合并后整包写回 `feature_flags`
- 迁移未应用时返回 `503` + `migration_required`

## 前端

| 路径 | 说明 |
|------|------|
| `/dashboard/settings/features` | 功能管理页（`FeatureFlagsManager`） |
| `DashboardNav` | 根据 `feature_flags` 决定是否渲染厨房看板链接 |
| `enqueueReceiptPrint` | 自动账单 variant（`pre_bill` / `split_payment` / `final`）受 `bill_receipt_print` 门控；手动 `checkout_bill` 不受限 |

设置子导航见 `src/lib/settings-nav.ts`（分组「功能」）。

## 迁移

```bash
supabase db push
```

文件：`supabase/migrations/20260529120000_restaurant_feature_flags.sql`

## 相关文件

- `src/lib/restaurant-features.ts` — 注册表与归一化
- `src/lib/order-receipt-enqueue.ts` — 账单打印入队门控
- `src/app/api/restaurant/features/route.ts` — REST API
- `src/components/dashboard/FeatureFlagsManager.tsx` — 设置 UI
- `src/components/dashboard/DashboardNav.tsx` — 侧栏门控
