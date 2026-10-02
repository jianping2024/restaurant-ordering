# 菜品风味提示（仅顾客展示）

店主给菜挂「这道菜本身什么味」的短标，顾客在菜单上看到。**不是**点菜备注，**不是**过敏原/素食，**不进**打印与厨房票。

静态视觉预览：`tmp/menu-flavor-hints-preview.html`（确认用，非运行时页面）。

## 功能开关（默认关闭）

| 项 | 约定 |
|---|---|
| 功能管理模块 | 新建 **`flavor`（风味）** 分组（与 `kitchen` / `billing` 并列） |
| 键名 | `menu_flavor_hints_enabled` |
| **默认** | **关闭**（`defaultEnabled: false`；jsonb 缺键 = 关） |
| 唯一可写入口 | 店主「功能管理」→ `PATCH /api/restaurant/features`（与现有 feature flags 同一套） |

**开关关时：**

- 菜单编辑**不出现**风味勾选区
- 顾客列表/详情**不显示**风味 chip
- 菜上若已有 `flavor_codes` **保留不删**；再打开开关后仍可显示

**开关开时：**

- 菜单编辑可勾风味并写入 `menu_items.flavor_codes`
- 顾客菜单按下方展示规则画 chip

顾客是否显示只看店级开关，**不要**只凭目录里是否有 `flavor_codes` 判断（改开关不会 bump `menu_catalog_version`）。

## 数据

| 项 | 约定 |
|---|---|
| 字段 | `menu_items.flavor_codes text[] NOT NULL DEFAULT '{}'` |
| 空数组 | 未标注风味 → 不显示 chip（≠「不辣」） |
| 码表 | 应用内写死（对齐 `allergen_codes` / `allergens.ts` 模式）；库只存合法码 |

### 字典（第一版）

| 组 | 码 | 中文展示 | 组内规则 |
|---|---|---|---|
| 辣度 | `spice_mild` / `spice_medium` / `spice_extra` | 微辣 / 中辣 / 特辣 | **单选**；**不设「不辣」**（不提示） |
| 麻 | `numb_mild` / `numb_medium` / `numb_extra` | 微麻 / 中麻 / 特麻 | **单选** |
| 清淡·重口 | `light` / `heavy` | 清淡 / 重口 | **单选** |
| 酸 / 甜 / 酸甜 | `sour` / `sweet` / `sweet_sour` | 酸 / 甜 / 酸甜 | **不互斥**，可同时挂 |
| 鲜 | `umami` | 鲜 | 可勾 |
| 香型 | `aroma_garlic` / `aroma_scallion` / `aroma_cumin` | 蒜香 / 葱香 / 孜然香 | 可多选 |

**全局上限：** 一道菜最多 **3** 个风味码（sole `FLAVOR_CODES_MAX_SELECTED`；归一化超限 = 非法；编辑满 3 不能再勾新的）。组内互斥仍适用。例：中辣 + 中麻 + 蒜香。

## 顾客展示

| 表面 | 位置 |
|---|---|
| 列表菜卡 | **菜名正下方**一条风味带；素食标仍贴菜名旁 |
| 详情 | 大图（头图区）**左下角**；价旁**不**再重复风味 |

### 列表菜卡竖向契约（稳定不跳）

唯一实现：`MenuItemCard` + `menu-item-card-layout` 槽位 token。左图正方形 **112×112** 为高度锚；右栏同高。列表**不**显示描述（描述只在详情）。

| 槽 | 规则 |
|---|---|
| 菜名 | 最多 **2** 行，超出省略；字号 15px |
| 风味带 | 开关**开**时始终占位（无码也留空高）；最多 **1** 行 chip，再多裁切 |
| 底行 | 价左、动作右，高度 36px，贴右栏底（与图底齐）；动作槽随「+」/步进器内容变宽，**不**预留空步进器列；列表步进器唯一 `CartQtyStepper density="compact"`（收间距、钮径不变）；外壳唯一 `MENU_ITEM_CARD_SHELL_CLASS`（`rounded-2xl` + `p-4`，内边距≥圆角；**不** `overflow-hidden` 裁底行）；列表列数唯一跟壳宽 container（`CUSTOMER_MENU_ITEM_LIST_HOST_CLASS` + `CUSTOMER_MENU_ITEM_LIST_CLASS`），不跟视口 `xl` |

- **全部文字** chip（不用辣椒个数 emoji；不用分组色标）
- 样式：品牌金软标（`brand-gold` 透底 + 轻描边），对齐现有 chip 质感  
  - 素食 = 绿 · 过敏原 = amber · **风味 = gold**
- 无黑底整条遮罩；详情图角 chip 可略提高不透明度保证压在菜图上可读
- 普通菜单与寿司菜单：店级开关开则**两套都显示**
- 无菜图、仅 emoji 头图：仍挂左下 chip
- 后台菜列表行：不露风味；仅编辑弹窗勾选
- 多列网格：卡片等高（`h-full` + grid stretch），邻卡底行齐平

## 明确不做

- 按风味筛选
- 打印 / 厨房票 / 账单带风味
- 与 `note_preset_group_ids`（点菜备注）混用或互相替代
- 「不辣」展示
- 列表展示菜品描述（描述只在详情）
- 列表 chip「+N」折叠（列表最多一行裁切；详情图角仍可全量换行）
- 列表风味用分组色 / 图标胶囊（与全金软标并存）

## 实现入口（落地时）

| 层 | 路径 |
|---|---|
| Feature 注册 | `packages/shared/src/restaurant-features.ts`（`flavor` 模块 + `menu_flavor_hints_enabled`） |
| 码表 / 归一化 | `apps/web/src/lib/flavors.ts`（sole） |
| 编辑 | `MenuManager`（仅 flag 开时渲染） |
| 顾客 chip | sole 组件（列表名下 + 详情图角） |
| Schema | 新迁移 `flavor_codes`；`docs/ai-schema.md` |
| 功能说明 | 本文 + [`restaurant-features.zh.md`](../restaurant-features.zh.md) |

## 状态

**产品定稿；已落地**（`menu_flavor_hints_enabled` 默认关闭）。权威仍以本文为准。
