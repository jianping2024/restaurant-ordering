# 餐厅功能开关（Feature Flags）

## 概述

店主可在 **餐厅设置 → 功能管理**（`/dashboard/settings/features`）控制可选产品行为是否执行。

**唯一可写入口：** 店主侧 `PATCH /api/restaurant/features`（UI：`FeatureFlagsManager`）。Ops 餐厅详情**不**编辑、**不**写入 `restaurants.feature_flags`（`PATCH /api/ops/restaurants/[id]` 若带 `featureFlags` 返回 `400 feature_flags_owner_only`）。

当前内置功能：

| 功能键 | 默认 | 作用 |
|--------|------|------|
| `kitchen_serve_to_table` | **关闭** | 勾选后楼面可在已出餐菜品上点「上桌」 |
| `bill_receipt_print` | **关闭** | 勾选后自动入队预账单；未勾选时跳过自动预账单（厨房单不受影响）。确认收款后的账单/发票由结账页询问决定，走手动入队，不受此开关限制 |
| `open_table_receipt_print`（设置页名称「开台打印小票」） | **关闭** | 勾选后：服务员确认开台成功（冷开台 `sessionOpened`）时自动入队一张开台小票（`receipt_variant=open_table`，版式同档口出品联、一行合计金额，收银默认打印机）。未勾选跳过；改人数不重打。唯一入队：`lib/open-table-receipt-enqueue.ts`；出纸在 farvoo-fatura fiscal-agent |
| `bill_sync_to_fiscal`（设置页名称「打印发票」） | **关闭** | 勾选后：确认收款界面填写税号/客户名。收款后：有效 NIF 或付款方式为 Multibanco/混合时**直接**入队 `auto_issue` 打发票（不弹「是否打印发票」）；其余（现金且无有效 NIF）仍问「是否打印发票」（入队 `auto_issue`，成功即开票，不关台；选否则不打）。未勾选时不问发票，改为问「是否打印账单」。与「快速关台」**互斥**（打开本项会关掉快速关台）。契约见 [`technical/farvoo-fiscal-bill-sync-api.zh.md`](./technical/farvoo-fiscal-bill-sync-api.zh.md) |
| `quick_table_close`（设置页名称「快速关台」） | **关闭** | 勾选后：员工桌台详情用「关台结账」代替「呼叫结账」（确认后 settled 关台并计入营业额，不记付款方式）；顾客手机不能呼叫结账；`checkout/request` 与 `checkout/ensure-entry` 返回 `403 quick_table_close_enabled`。与「打印发票」**互斥**。默认关闭。 |
| `menu_flavor_hints_enabled` | **关闭** | 勾选后：菜单编辑可标菜品风味，顾客菜单显示风味 chip。未勾选：编辑无风味区、顾客不显示（已写入的 `flavor_codes` 保留）。产品定稿见 [`product/menu-flavor-hints.zh.md`](./product/menu-flavor-hints.zh.md) |

**已退役：** `kitchen_board`（曾控制侧栏「厨房看板」）。合并写回 `feature_flags` 时会从 jsonb **剥离**该键。后台顶栏厨房入口与楼面厨房页共用权限 `floor.kitchen_board.view`（旧 `dashboard.kitchen_shortcut.view` 已并入；店主侧栏另受 `owner_nav_preferences`）。**不再**读店级 feature flag。

未勾选打印账单时，呼叫结账与确认收款流程照常，仅跳过自动 `pre_bill`。确认收款后的 `split_payment` / `final` 只在员工回答打印询问时手动入队。

## 数据模型

`restaurants.feature_flags`：`jsonb`，默认 `{}`。

示例：

```json
{ "kitchen_serve_to_table": true, "bill_receipt_print": true, "bill_sync_to_fiscal": true, "menu_flavor_hints_enabled": true }
```

- 键缺失 → 使用代码中的默认值（见 `packages/shared` → `restaurant-features.ts`）
- 值为 `boolean`
- 未知键在 PATCH 时被忽略，不会写入
- 退役键（如 `kitchen_board`）在 merge 时删除，不保留为第二导航闸

## 架构（可扩展）

功能项分两层注册：

1. **`RESTAURANT_FEATURE_MODULES`** — 按页面/产品模块分类（仅 UI 与代码组织，**不写入数据库**）
2. **`RESTAURANT_FEATURE_DEFINITIONS`** — 具体开关项，每条必须指定 `moduleId`

当前模块：

| 模块 ID | 设置页分组名 | 说明 |
|---------|--------------|------|
| `kitchen` | 后厨流程 | 后厨相关可选行为 |
| `billing` | 结账与账单 | 结账流程相关可选行为 |
| `flavor` | 风味 | 菜品风味提示（顾客展示）；落地时新增，见 [`product/menu-flavor-hints.zh.md`](./product/menu-flavor-hints.zh.md) |

功能定义示例：

```ts
// 模块
{ id: 'kitchen', labelKey: 'moduleKitchen', sortOrder: 15 }

// 功能项
{
  key: 'kitchen_serve_to_table',
  moduleId: 'kitchen',
  defaultEnabled: false,
  labelKey: 'kitchenServeToTable',
  descKey: 'kitchenServeToTableDesc',
}
```

设置页通过 `groupRestaurantFeaturesByModule()` 按模块分组渲染；空模块自动隐藏。

新增功能时按顺序：

1. 在 `RestaurantFeatureKey` 增加键名
2. 若属于新页面模块：在 `RestaurantFeatureModuleId` 与 `RESTAURANT_FEATURE_MODULES` 增加模块（含 `sortOrder`、i18n `module*` 文案）
3. 在 `RESTAURANT_FEATURE_DEFINITIONS` 增加一条（含 `moduleId`、`defaultEnabled`、文案 key）
4. 在 `src/lib/i18n/messages.ts` 的 `featureSettings` 增加对应文案（zh / en / pt；其它 locale 同步）
5. 在需要受控的 UI 或服务端逻辑调用 `isRestaurantFeatureEnabled(flags, key)`
6. 若新功能影响 schema 语义，更新 `docs/ai-schema.md`

无需为每个功能单独加列；jsonb 只存 `{ "bill_receipt_print": true }` 等布尔值，模块分类完全由注册表驱动。

## API

### `GET /api/restaurant/features`

店主会话。返回归一化后的开关：

```json
{ "flags": { "kitchen_serve_to_table": false, "bill_receipt_print": false } }
```

### `PATCH /api/restaurant/features`

请求体：

```json
{ "flags": { "kitchen_serve_to_table": true } }
```

- 仅店主可写（`getOwnerRestaurantId`）
- 与服务端注册表合并后整包写回 `feature_flags`（并剥离退役键）
- 迁移未应用时返回 `503` + `migration_required`

## 前端

| 路径 | 说明 |
|------|------|
| `/dashboard/settings/features` | 功能管理页（`FeatureFlagsManager`） |
| `DashboardNav` / top nav | 厨房入口：`floor.kitchen_board.view`（与厨房页同一 key；无店级 flag） |
| `enqueueReceiptPrint` | 自动账单 variant（`pre_bill` / `split_payment` / `final`）受 `bill_receipt_print` 门控；手动 `checkout_bill` 不受限 |

设置子导航见 `src/lib/settings-nav.ts`（分组「功能」）。

## 迁移

```bash
supabase db push
```

文件：`supabase/migrations/20260529120000_restaurant_feature_flags.sql`

## 相关文件

- `packages/shared/src/restaurant-features.ts` — 注册表与归一化
- `src/lib/order-receipt-enqueue.ts` — 账单打印入队门控
- `src/lib/checkout-request-server.ts` — 呼叫结账成功后自动入队 `pre_bill`
- `src/app/api/restaurant/features/route.ts` — REST API
- `src/components/dashboard/FeatureFlagsManager.tsx` — 设置 UI

## 档口后厨

店级「上桌」开关为 `kitchen_serve_to_table`；档口「后厨流程」在 `print_stations` 上配置。自动已出餐等待分钟 `kitchen_ready_after_minutes` 存在 `print_agent_config`（非布尔 flag），**唯一编辑**与上桌同一页：功能管理「后厨流程」+ `PATCH /api/restaurant/features`。权威产品方案：[`docs/product/station-kitchen-screens.zh.md`](./product/station-kitchen-screens.zh.md)。
