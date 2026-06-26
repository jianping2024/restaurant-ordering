# 店内角色权限（自研 Capability RBAC）— 设计与实施计划

> 状态：**设计稿**（尚未落地代码；**2026-06-26** 审查修订）  
> 关联：`docs/staff-accounts-plan.md`、`docs/ai-schema.md`、`apps/web/src/lib/staff-api-auth.ts`  
> **架构评审**（变与不变、模式、目录、确认项）：[`role-permissions-architecture.zh.md`](./role-permissions-architecture.zh.md)

## 0. 角色与命名对照（必读）

店内系统里有多套「身份」，**不要混用口语「老板 / 配置员 / 前台」与代码枚举**。下表为**建议统一口径**（产品文案、文档、权限设计均以此为准）。

### 0.1 身份总览（四类，彼此独立）

| 代码 / 类型 | 中文产品名（推荐） | 是什么 | 数据从哪来 | 不是啥 |
|-------------|-------------------|--------|------------|--------|
| **`owner`** | **店主** | 开店注册账号，餐厅法律意义上的管理者 | `restaurants.owner_id = auth.uid()` | ❌ 不是员工表里的 role；❌ 不是「配置员」岗位；❌ 不是 `frontdesk` |
| **`kitchen`** | **厨房** | 厨房员工 | `restaurant_staff_accounts.role` | ❌ 不是店主 |
| **`waiter`** | **服务员** | 楼面巡台、加单、转台等 | 同上 | ❌ 不是「前台」；服务员**默认不进** Dashboard 运营页 |
| **`cashier`** | **收银员** | 仅收银 | 同上 | ❌ 不是店主 |
| **`frontdesk`** | **前台** | Dashboard 运营（结账、桌位、订单等） | 同上 | ❌ 不是店主；❌ 不是「老板配置员」 |
| （无店内角色） | **顾客** | 扫码点餐 | 匿名 / 会话 | 不参与 RBAC |
| **`platform_admin`** | **平台运营** | Mesa 内部 `/ops/*` | `platform_admin_accounts` | ❌ 与店内 owner/staff 完全分离 |

**关于文档里的 `owner`（英文）**：一律指 **店主账号**（`owner_id` 绑定），**不是**员工角色枚举里的一项。口语「老板」= 店主；**没有**名为「老板配置员」的 `StaffRole`。

### 0.2 中文别名（建议收敛）

| 避免混用 | 统一写成 |
|----------|----------|
| 老板、店长、店主 | 产品/UI：**店主**；代码/DB：**owner** |
| 前台、收银台、接待 | 岗位：**前台** → `frontdesk`；**收银员** → `cashier`（两者不同） |
| 配置员、管理员 | 店内配置 = **店主**；跨店运维 = **平台运营** |
| 跑堂、楼面 | **服务员** → `waiter` |

### 0.3 入口与 `DashboardAccessMode`

| 身份 | 代码 `accessMode` / 登录态 | 典型登录入口 | 默认落地 |
|------|---------------------------|--------------|----------|
| 店主 | `owner` | `/auth/login`（店主注册/登录） | `/dashboard/settings` |
| 前台员工 | `frontdesk` | `/{slug}/staff/login` 或 `/auth/staff/login` | `/dashboard` |
| 收银员 | `cashier` | 同上 | `/dashboard/checkout` |
| 厨房员工 | （无 Dashboard 模式） | 员工登录 | `/{slug}/kitchen` |
| 服务员 | （无 Dashboard 模式） | 员工登录 | `/{slug}/waiter` |

店主**可以**在已登录 Dashboard 的情况下打开 `/{slug}/kitchen|waiter`（代码里 owner fallback），但这是**店主冒充员工上下文**，不改变其身份仍是 `owner`。

### 0.4 权限方案里谁管什么

| 身份 | 能力（API/按钮） | 侧栏菜单 |
|------|------------------|----------|
| 店主 `owner` | 恒为 `*`（全开） | **方案 A**：`owner_nav_preferences`，仅藏主侧栏项 |
| 员工四角色 | `restaurant_role_permissions` + 默认模板 | 由能力推导，未授权不可见且 API 403 |
| 平台运营 | 独立 ops 鉴权 | `/ops/*` 自有导航 |

**勾选「自己的菜单」的只有店主**：路径规划为 `/dashboard/settings/my-nav`（见 §11.2）。  
**勾选「某员工角色能干什么」的是店主在配别人**：`/dashboard/settings/roles`（见 §11.1）。  
前台员工 `frontdesk` **不能**给自己配店主级设置，也**不能**改自己的 role（创建后不可改）。

### 0.5 与 `restaurant_staff_accounts.role` 的关系

```text
StaffRole = 'kitchen' | 'waiter' | 'cashier' | 'frontdesk'   // 仅员工
Principal   = owner | staff(StaffRole)                        // 权限解析用
```

`owner` **永远不会**出现在 `restaurant_staff_accounts.role` 列里。

### 0.6 实施策略：全新落地（不补丁、不兼容旧逻辑）

权限从**硬编码**改为**可配置 capability** 时，按**一次重构**交付，**不做**：

| 禁止 | 说明 |
|------|------|
| 双轨鉴权 | 不同时保留 `CHECKOUT_AUTHORIZED_STAFF_ROLES` 与 `requirePermission` 两套路径 |
| 兼容层 | 不建 `legacyAccessMode`、不把 `DashboardAccessMode` 当长期真相源 |
| 旧数据迁移 | 无历史 permission 行可迁；新表从空开始，默认矩阵仅来自 `ROLE_TEMPLATES` |
| 渐进「补丁」 | 不在原 `middleware` 分支上叠 if；改为 `principal` + `ROUTE_PERMISSIONS` 单一路径 |
| owner 侧栏特例堆叠 | `owner_nav_preferences` 未配置时**不**再模拟「仅设置」现网；用代码常量 `OWNER_NAV_DEFAULT` 一次定稿 |

**应做**：

1. **删除**（或内联替换后删除）分散常量：`ownerNavItems` / `frontdeskNavItems` / `isFrontdeskOperationalPath` / 各 API 内 role 数组。
2. **统一模块** `apps/web/src/lib/permissions/*` 为唯一注册表与解析入口。
3. **Schema**：直接加 `restaurant_role_permissions`、`owner_nav_preferences`（或独立列）；不 backfill。
4. **测试**：按新矩阵重写/新增单测；不保留「与硬编码行为一致」的过渡用例。
5. **文档**：`docs/ai-schema.md` 与本文同步更新；`research.md` 角色章节指向 §0。

硬编码对照表仅作**迁移前审计**（本文 §2），落地后从代码中移除，不在运行时读取。

---

## 1. 背景与目标

### 1.1 要解决的问题

- 不同角色应看到**不同 Dashboard 菜单**与**不同操作按钮**。
- 店主将来可在后台**按角色勾选**权限，而非改代码发版。
- **员工**：UI 隐藏、路由拦截、API 鉴权须**同一套能力点（permission key）**，避免「菜单藏了但接口仍能调」。
- **店主**：能力层永远 `*`；侧栏仅做**导航偏好**（方案 A，见 §4.1），不影响路由与 API。

### 1.2 非目标

- 不替代 Supabase **RLS**（表级租户隔离仍由 RLS 负责）。
- 不覆盖**顾客端**（`/[slug]/menu` 等匿名/会话下单流程）。
- 不与 **Mesa 平台运营**（`/ops/*`、`platform_admin_accounts`）混用。
- 第一期不做：自定义角色名、权限继承树、菜单拖拽排序、CASL 等第三方库。

---

## 2. 现状审计（2026-06）

当前**没有统一权限框架**，逻辑分散在多处硬编码。

### 2.1 身份与角色

| 身份 | 来源 | 说明 |
|------|------|------|
| **店主 owner** | `restaurants.owner_id` | 隐式全权限；可经 `staffAuthFromRequest` **冒充任意员工角色**访问 `/[slug]/kitchen|waiter` API |
| **员工 staff** | `restaurant_staff_accounts.role` | 枚举：`kitchen` \| `waiter` \| `cashier` \| `frontdesk`；**创建后不可改 role**（见 `staff-accounts-plan.md`） |

### 2.2 Dashboard 访问模式（`DashboardAccessMode`）

`loadDashboardAccess()` 仅区分三种员工入口 + owner：

| accessMode | 角色 | 默认落地页（`staffRolePath`） |
|------------|------|-------------------------------|
| `owner` | 店主 | `/dashboard/settings` |
| `frontdesk` | `frontdesk` | `/dashboard` |
| `cashier` | `cashier` | `/dashboard/checkout` |
| — | `kitchen` / `waiter` | 不进 Dashboard；分别进 `/{slug}/kitchen`、`/{slug}/waiter` |

`kitchen` / `waiter` **不在** `loadDashboardAccess` 的 Dashboard 分支内；守卫在业务页 `expectedRole` + `staffAuthForPage`。

### 2.3 菜单（硬编码）

文件：`apps/web/src/components/dashboard/DashboardNav.tsx`

| accessMode | 侧栏菜单 |
|------------|----------|
| `owner` | 仅「设置」→ `/dashboard/settings` |
| `frontdesk` | 结账台、未付订单、订单历史、概览、桌位；底部快捷：厨房看板（受 `feature_flags` 控制）、内嵌服务员看板 |
| `cashier` | 仅结账台 |

设置 Hub Tab（`SETTINGS_NAV_TABS`）：基本资料、员工、功能开关、菜单、自助餐、打印助手 — **仅 owner** 可进（`middleware` 把非 settings 路径重定向走）。

### 2.4 路由守卫（硬编码）

| 层级 | 文件 | 逻辑 |
|------|------|------|
| Middleware | `apps/web/src/lib/supabase/middleware.ts` | owner → 仅 settings；frontdesk → 除 settings 外 operational；cashier → 仅 checkout |
| 路径辅助 | `apps/web/src/lib/dashboard-paths.ts` | `isFrontdeskOperationalPath`、`isCashierCheckoutPath` |
| 页面 | `dashboard/waiter/*` | `access.mode !== 'frontdesk'` → redirect |
| 页面 | `dashboard/checkout` | owner / cashier / frontdesk 均可；`showPrinterSettings` 仅 frontdesk |

### 2.5 API 鉴权常量（硬编码）

文件：`apps/web/src/lib/staff-api-auth.ts`

| 常量 / 函数 | 允许角色 | 用途 |
|-------------|----------|------|
| `CHECKOUT_AUTHORIZED_STAFF_ROLES` | waiter, cashier, frontdesk + **owner** | 确认收款、小票打印机列表 |
| `OPEN_TABLE_AUTHORIZED_STAFF_ROLES` | waiter, frontdesk + **owner** | 开台流、服务员看板、转台/并台、加单、自助餐、改单 |
| `staffAuthFromRequest(..., 'kitchen')` | kitchen + owner | 厨房看板、菜品状态 |
| `staffAuthFromRequest(..., 'waiter')` | waiter + owner | 订单小票打印（**关台接口对 waiter 显式 403**） |
| `loadFrontdeskOperationalContext` | frontdesk only | Dashboard 桌位/结账/关台等 **service role** 操作 |

### 2.6 遗漏点（相对初版方案，代码审查补全）

以下行为在初版 capability 清单中**未单独列出**，实施时必须纳入注册表：

1. **前台可操作桌位 CRUD**：`/api/dashboard/tables`（增删改桌位、分组）走 `loadFrontdeskDashboardTables`，不仅是 `tables.view`。
2. **关台权限分级**：`waiter` 调 `sessions/close` 固定 403；关台在 Dashboard `/api/dashboard/close-table-session`（frontdesk）。
3. **整桌发起结账请求**：`/api/dashboard/checkout-request`（frontdesk）。
4. **折扣**：结账 UI 与 `confirm-payment` 的 `discount_rate` 目前与确认收款同一批角色，宜拆为独立 capability 便于将来只给店长/前台。
5. **厨房改菜品状态**：`kitchen/orders/[orderId]` PATCH。
6. **服务员改单**：`waiter/orders/[orderId]`。
7. **自助餐入账**：`waiter/buffet`（含 `ensureOpenTableSession`）。
8. **订单小票打印**：`order-receipt/print`（waiter 或 owner）。
9. **内嵌 vs 独立看板**：`/dashboard/waiter` 与 `/{slug}/waiter` 共用 API，权限 key 应一致。
10. **打印助手 / print-agent**：`/api/print-agent/*` 多为 **owner**；结账台选打印机走 `receipt-printers`（checkout 授权角色）。
11. **Legacy 重定向**：`/dashboard/menu` → settings/menu；`/dashboard/settings/tables` → `/dashboard/tables` — 权限按目标路径解析。
12. **暂停营业**：`loadFrontdeskOperationalContext({ requireWritable: true })` 与 suspension banner — 权限通过也不应写操作。

---

## 3. 设计原则

1. **能力点是员工侧唯一真相**：员工菜单、按钮、API 均映射到 `PermissionKey`。
2. **角色 = 默认能力集合**：`restaurant_staff_accounts.role` 仍是身份标签；权限是可配置的模板 + 可选覆盖。
3. **Owner 能力不可裁剪**：`resolveCapabilities(owner)` 恒为 `['*']`；API / 写操作 / 深链 URL **不因侧栏未勾选而拒绝**。
4. **Owner 侧栏 = 导航偏好（方案 A）**：仅控制 `DashboardNav` 展示项；与员工 RBAC **分表、分函数**，见 §4.1。
5. **员工四层一致**：UI → 路由 → API →（RLS 粗粒度）；按钮级不到 RLS。**Owner 仅侧栏不一致**（可藏菜单，但路由/API 仍全开）。
6. **先代码注册、后 DB 配置**：P0–P2 用 TypeScript 默认矩阵；P3 加员工角色勾选；Owner 导航偏好可同批或略晚（§14）。
7. **与 feature_flags 正交**：`visible = feature_enabled && (员工 can(permission) || owner 在 nav 偏好中启用该项)`。

---

## 4. 核心概念

```ts
type Principal =
  | { kind: 'owner'; restaurantId: string; userId: string }
  | {
      kind: 'staff';
      restaurantId: string;
      userId: string;
      role: StaffRole;
      staffAccountId: string;
    };

type PermissionKey = keyof typeof PERMISSIONS; // 见 §5

// 解析优先级（高 → 低）：
// owner → *
// staff_permission_overrides（P4，可选）
// restaurant_role_permissions（P3）
// ROLE_TEMPLATES[role]（代码默认）
```

**注意**：员工 **role 创建后仍不可改**（现有产品决策）；权限配置默认 **per-role per-restaurant**，不是 per-user。若将来需要「同一角色不同人不同权」，用 P4 `staff_permission_overrides`。

### 4.1 店主导航偏好（方案 A，已确认）

店主与员工采用**双轨模型**：

| 维度 | 员工 staff | 店主 owner |
|------|------------|------------|
| 能力（API/按钮/深链） | `resolveCapabilities` → 有限集合 | 恒为 `['*']` |
| 侧栏菜单 | 由能力推导，未授权不可见 | `owner_nav_preferences`，可藏不可禁 |
| 路由 middleware | 无权限 → 重定向 | **不因侧栏未勾选而拦截** |
| 配置入口 | `/dashboard/settings/roles`（店主配**员工角色**） | `/dashboard/settings/my-nav`（**店主**配自己的侧栏，§11.2） |

#### 4.1.1 店主可选侧栏目录（`OWNER_NAV_CATALOG`）

不是注册表里所有 key，而是**店主后台侧栏可能出现**的项（代码注册，与 `NAV_ITEMS` 对齐并扩展）：

| 类型 | PermissionKey / 项 | 说明 |
|------|-------------------|------|
| 设置 | `dashboard.settings.view` | 设置 Hub（现网唯一侧栏项） |
| 运营 | `dashboard.checkout.view` | 结账台 |
| 运营 | `dashboard.unpaid_orders.view` | 未付订单 |
| 运营 | `dashboard.orders.view` | 订单历史 |
| 运营 | `dashboard.overview.view` | 概览 |
| 运营 | `dashboard.tables.view` | 桌位运营 |
| 运营 | `dashboard.waiter_board.view` | 内嵌服务员看板 |
| 快捷 | `dashboard.kitchen_shortcut.view` | 新窗口打开厨房（且 `feature_flags.kitchen_board`） |
| 快捷 | `floor.kitchen_board.view` | 侧栏链到 `/{slug}/kitchen`（可选，与上二选一或并存） |
| 快捷 | `floor.waiter_board.view` | 侧栏链到 `/{slug}/waiter`（可选） |

**设置 Hub 内子 Tab**（基本资料、员工、菜单…）**不**受 `owner_nav_preferences` 控制：进入设置后始终展示完整 `SETTINGS_NAV_TABS`（店主能力为 `*`）。

#### 4.1.2 默认行为

| 字段状态 | 侧栏表现 | 能力 / 路由 / API |
|----------|----------|-------------------|
| `owner_nav_preferences` **未配置**（DB 无行 / `null`） | 使用代码常量 **`OWNER_NAV_DEFAULT`**（一次定稿，**不**模拟现网「仅设置」） | 恒为 `*` |
| 已配置为非空数组 | 仅显示数组内且落在 `OWNER_NAV_CATALOG` 中的项 | 仍为 `*` |
| 配置页「恢复默认」 | 写回 `OWNER_NAV_DEFAULT`（或 DELETE 后由服务端填默认） | 仍为 `*` |

配置 UI 打开时：未写入 DB 前展示 **`OWNER_NAV_DEFAULT`** 勾选；用户保存后才写入 `owner_nav_preferences`。

**`OWNER_NAV_DEFAULT` 定稿列表**（与架构文档 §6.6 一致；实现写在 `owner-nav.ts`）：

| 包含 | PermissionKey |
|------|----------------|
| 设置 | `dashboard.settings.view` |
| 运营（部分） | `dashboard.checkout.view`、`dashboard.tables.view`、`dashboard.unpaid_orders.view` |
| **不含** | `dashboard.overview.view`、`dashboard.orders.view`、`dashboard.waiter_board.view`、厨房/楼面快捷项（店主在「我的导航」中按需打开） |

#### 4.1.3 存储（勿与员工 RBAC 混表）

写入 `restaurants` 的 jsonb，**推荐独立键**（与 `feature_flags` 分开，语义更清晰）：

```json
{
  "owner_nav_preferences": [
    "dashboard.settings.view",
    "dashboard.checkout.view",
    "dashboard.tables.view",
    "dashboard.unpaid_orders.view"
  ]
}
```

- 键缺失或 `null`：按上表「未配置」处理。
- 值必须为 `PermissionKey[]`；未知 key 忽略；去重。
- 仅 `owner_id` 对应用户可 PATCH（与 `feature_flags` 相同鉴权）。
- **不**写入 `restaurant_role_permissions`。

若希望少一个字段，可嵌在 `feature_flags` 下，但须在 `restaurant-features.ts` 标明「非功能开关，不参与 `RESTAURANT_FEATURE_DEFINITIONS`」，避免进功能管理页误改。

#### 4.1.4 与现网差异（实施必改）

当前代码有两处与方案 A 冲突，落地 Owner 运营侧栏前须处理：

1. **Middleware**（`middleware.ts`）：owner 访问非 `/dashboard/settings/**` 会被重定向到设置 → 须改为 **owner 可访问全部 dashboard 路径**（能力 `*`）。
2. **运营 API 上下文**：`/api/dashboard/tables`、`close-table-session` 等走 `loadFrontdeskOperationalContext`（仅 frontdesk）→ 须增加 **owner 分支**（`loadOwnerOperationalContext` 或统一 `loadOperationalContext(principal)`，owner 用 service role + `restaurant_id`）。

楼面页 `/{slug}/kitchen|waiter`：owner 已可通过 `staffAuthFromRequest` owner fallback 访问，**无需** nav 偏好。

#### 4.1.5 侧栏渲染逻辑

```ts
function visibleNavItems(principal: Principal, caps: Capabilities, navPrefs: PermissionKey[] | null) {
  if (principal.kind === 'owner') {
    const catalog = OWNER_NAV_CATALOG.filter(
      (item) => featureAllows(item) // kitchen_board 等
    );
    const enabled = navPrefs ?? OWNER_NAV_DEFAULT; // 未配置 → 代码默认（§4.1.2）
    return catalog.filter((item) => enabled.includes(item.permission));
  }
  return NAV_ITEMS.filter((item) => can(caps, item.permission) && featureAllows(item));
}
```

进入某页后，页内按钮对 owner **不因 nav 偏好隐藏**（能力 `*`）。员工仍用 `Can` + `requirePermission`。

#### 4.1.6 配置 UI

- 位置建议：`/dashboard/settings/features` 下新增分组 **「我的后台导航」**，或独立 `/dashboard/settings/my-nav`。
- 仅 owner 可见；展示 `OWNER_NAV_CATALOG` 勾选；保存 PATCH `owner_nav_preferences`。
- 文案说明：「仅影响侧栏显示，不影响权限；书签与直接输入地址仍可访问。」

### 4.2 `loadPrincipal` 解析规则（实施必守）

`loadPrincipal()` 为身份**唯一真相源**；**禁止**用 `user_metadata.staff_role` 参与鉴权（现网 `isActiveStaffRole` 的 metadata 回退须在迁移时删除）。

| 步骤 | 规则 |
|------|------|
| Session | 无 Supabase session → `null` |
| Owner | `restaurants.owner_id = auth.uid()` → `{ kind: 'owner', ... }`（**优先于** staff 行） |
| Staff | `restaurant_staff_accounts` 且 `disabled_at IS NULL` → `{ kind: 'staff', role, staffAccountId, ... }` |
| 停用 | `disabled_at` 非空 → `null`（等同未登录；与 `staff-accounts-plan` 踢下线一致） |
| 其余 | `onboarding` / 未绑定 → `null` |

**不做**：不读 `user_metadata` 判 role；不允许多店 staff（一人一店，见 `staff-accounts-plan.md`）。

暂停营业（`suspended_at`）不改变 Principal 解析；写操作在 `requirePermission` **之后**由 `loadOperationalContext({ requireWritable: true })` 或等价检查返回 403。

---

## 5. 权限注册表（完整草案）

建议目录：`apps/web/src/lib/permissions/registry.ts`

命名：`{域}.{资源}.{动作}`。

注册表元数据（`registry.ts`）：

| 字段 | 含义 |
|------|------|
| `dangerous: true` | 店主配置 UI 保存时需二次确认 |
| `ownerOnly: true` | **不可**授予员工四角色（配置 API/UI 硬拒绝）；仅 owner `*` 或设置子页路由 |
| `requires?: PermissionKey[]` | 勾选/授予本 key 时须同时满足依赖（配置 UI 联动 + `mergeOverrides` 校验） |

### 5.1 Dashboard 菜单（view）

| PermissionKey | 说明 | 当前谁有 |
|---------------|------|----------|
| `dashboard.settings.view` | 设置 Hub 及子页 | owner |
| `dashboard.checkout.view` | 结账台 | frontdesk, cashier |
| `dashboard.unpaid_orders.view` | 未付订单 | frontdesk |
| `dashboard.orders.view` | 订单历史 | frontdesk |
| `dashboard.overview.view` | Dashboard 首页 `/dashboard` | frontdesk |
| `dashboard.tables.view` | 桌位运营页 `/dashboard/tables` | frontdesk |
| `dashboard.waiter_board.view` | 内嵌服务员看板 `/dashboard/waiter` | frontdesk |
| `dashboard.kitchen_shortcut.view` | 侧栏打开 `/{slug}/kitchen` | frontdesk（且 feature flag） |

### 5.2 Dashboard 设置子页（`ownerOnly`，整组）

| PermissionKey | 路径 | ownerOnly |
|---------------|------|-----------|
| `settings.profile.manage` | `/dashboard/settings` | yes |
| `settings.staff.manage` | `/dashboard/settings/staff` | yes |
| `settings.features.manage` | `/dashboard/settings/features` | yes |
| `settings.menu.manage` | `/dashboard/settings/menu` | yes |
| `settings.buffet.manage` | `/dashboard/settings/buffet` | yes |
| `settings.print_assistant.manage` | `/dashboard/settings/print-assistant` | yes |
| `settings.roles.manage` | `/dashboard/settings/roles`（员工角色权限配置页，P3） | yes |

员工路由：`dashboard.settings.view` 对非 owner **拒绝**（middleware 重定向）；子 Tab 仅 owner 可达。实施时可用单一 `dashboard.settings.view` 涵盖 Hub，上表 key 用于 **API** 与将来细分。

### 5.3 结账

| PermissionKey | 说明 | dangerous | 当前谁有 |
|---------------|------|-----------|----------|
| `checkout.confirm_payment` | 确认收款 RPC | yes | waiter, cashier, frontdesk, owner |
| `checkout.apply_discount` | 提交 `discount_rate` | yes | 同上（宜可拆配）；`requires: ['checkout.confirm_payment']` |
| `checkout.request_whole_table` | Dashboard 整桌发起结账 | no | frontdesk |
| `checkout.printer_settings` | 结账页选小票机 | no | frontdesk |

### 5.4 桌位与会话

| PermissionKey | 说明 | dangerous | 当前谁有 |
|---------------|------|-----------|----------|
| `tables.view` | 读桌位列表（Realtime/看板） | no | kitchen, waiter, cashier, frontdesk + owner |
| `tables.manage` | 增删改桌位、分组（Dashboard API） | yes | frontdesk（经 service role） |
| `tables.open_session` | 开台（`ensureOpenTableSession`） | no | waiter, frontdesk + owner |
| `tables.close_session` | 关台（Dashboard close API） | yes | frontdesk + owner |
| `tables.transfer` | 转台 RPC | yes | waiter, frontdesk + owner |
| `tables.merge` | 并台 RPC | yes | waiter, frontdesk + owner |

### 5.5 订单

| PermissionKey | 说明 | 当前谁有 |
|---------------|------|----------|
| `orders.append` | 服务员/前台加单（`waiter_flow`） | waiter, frontdesk + owner |
| `orders.edit` | 服务员改单 | waiter, frontdesk + owner |
| `orders.kitchen_update` | 厨房更新菜品/订单状态 | kitchen + owner |
| `orders.print_receipt` | 订单小票打印 | waiter + owner |

### 5.6 自助餐

| PermissionKey | 说明 | 当前谁有 |
|---------------|------|----------|
| `buffet.post_to_table` | 服务员自助餐入账 | waiter, frontdesk + owner |

### 5.7 楼面看板（`/[slug]/*`）

| PermissionKey | 说明 | 当前谁有 |
|---------------|------|----------|
| `floor.kitchen_board.view` | `/{slug}/kitchen` | kitchen + owner |
| `floor.waiter_board.view` | `/{slug}/waiter` | waiter, frontdesk + owner |

### 5.8 打印与设备

| PermissionKey | 说明 | 当前谁有 |
|---------------|------|----------|
| `print_agent.manage` | Dashboard 打印助手（配对码、设备列表、路由、任务重试等 **owner session** API） | owner（`ownerOnly`） |
| `print_agent.receipt_printers.read` | 结账用小票机列表 | checkout 授权角色 |

**不在 RBAC 内**：Print Agent 设备端点（`claim`、`heartbeat`、`pending-jobs` 等）使用 **Print Agent JWT**，见 §7.3.1。

---

## 6. 默认角色模板（`ROLE_TEMPLATES`）

与 §5「当前谁有」对齐，作为 P0 基线。

| 角色 | 权限策略 |
|------|----------|
| **owner** | 能力 `['*']`；侧栏默认 **`OWNER_NAV_DEFAULT`**（§4.1.2），可配 `owner_nav_preferences` |
| **frontdesk** | §5.1 全部 dashboard **view**（含 `dashboard.waiter_board.view`，与现网内嵌服务员看板一致）+ §5.3–§5.6 操作项；**不含** `orders.kitchen_update`、`floor.kitchen_board.view`（楼面独立厨房页）；**不含** `floor.waiter_board.view`（`/{slug}/waiter` 楼面页，前台默认用 Dashboard 内嵌看板） |
| **cashier** | `dashboard.checkout.view`, `checkout.confirm_payment`（`checkout.apply_discount` 默认关闭，可配置） |
| **waiter** | `floor.waiter_board.view`, `tables.open_session`, `tables.transfer`, `tables.merge`, `orders.append`, `orders.edit`, `buffet.post_to_table`, `checkout.confirm_payment`, `orders.print_receipt`；**无** `tables.close_session` |
| **kitchen** | `floor.kitchen_board.view`, `orders.kitchen_update`, `tables.view`（RLS 只读桌位） |

---

## 7. 路由 / API 映射表（实施清单）

### 7.1 Dashboard 页面 → permission

| 路径 | PermissionKey |
|------|---------------|
| `/dashboard/settings/**` | `dashboard.settings.view` |
| `/dashboard/checkout/**` | `dashboard.checkout.view` |
| `/dashboard/unpaid-orders` | `dashboard.unpaid_orders.view` |
| `/dashboard/orders` | `dashboard.orders.view` |
| `/dashboard` | `dashboard.overview.view` |
| `/dashboard/tables` | `dashboard.tables.view` |
| `/dashboard/waiter/**` | `dashboard.waiter_board.view` |

### 7.2 楼面页面 → permission

| 路径 | PermissionKey |
|------|---------------|
| `/{slug}/kitchen` | `floor.kitchen_board.view` |
| `/{slug}/waiter/**` | `floor.waiter_board.view` |

### 7.3 API → permission

| 方法 | 路径 | PermissionKey |
|------|------|---------------|
| POST | `/api/restaurants/[slug]/checkout/confirm-payment` | `checkout.confirm_payment`（含 discount 时另检 `checkout.apply_discount`） |
| GET/PATCH | `/api/print-agent/receipt-printers` | `print_agent.receipt_printers.read` |
| POST | `/api/dashboard/checkout-request` | `checkout.request_whole_table` |
| POST | `/api/dashboard/close-table-session` | `tables.close_session` |
| GET | `/api/dashboard/tables` | `dashboard.tables.view`（读桌位 + 分组） |
| POST/PATCH/DELETE | `/api/dashboard/tables` | `tables.manage` |
| GET/POST | `/api/dashboard/staff` | `settings.staff.manage`（`ownerOnly`） |
| PATCH/DELETE | `/api/dashboard/staff/[id]` | `settings.staff.manage` |
| PATCH | `/api/dashboard/staff/[id]/reset-password` | `settings.staff.manage` |
| PATCH | `/api/restaurant/settings` | `settings.profile.manage` |
| PATCH | `/api/restaurant/features` | `settings.features.manage` |
| GET | `/api/print-agent/pairing`、`pairings`、`devices`、`routing`、`settings`、`print-stations`、`print-jobs/recent`、`support-snapshot` | `print_agent.manage` |
| POST | `/api/print-agent/pairing`、`pairings/[id]/revoke`、`devices/[id]/revoke`、`print-jobs/[id]/retry` | `print_agent.manage` |
| PATCH | `/api/print-agent/settings`、`routing` | `print_agent.manage` |
| GET | `/api/downloads/print-agent/[artifact]` | `print_agent.manage`（或登录 owner；与现网一致） |
| POST | `/api/restaurants/[slug]/orders/append` | 顾客流：无；`waiter_flow`：`orders.append` |
| POST | `/api/restaurants/[slug]/staff/waiter/buffet` | `buffet.post_to_table` |
| POST | `/api/restaurants/[slug]/staff/waiter/tables/action` | `tables.transfer` / `tables.merge`（按 action） |
| GET | `/api/restaurants/[slug]/staff/waiter/board` | `dashboard.waiter_board.view` **或** `floor.waiter_board.view`（满足其一） |
| GET | `/api/restaurants/[slug]/staff/waiter/tables/[tableId]` | 同上 |
| GET | `/api/restaurants/[slug]/staff/waiter/tables/[tableId]/action-targets` | `tables.transfer` 或 `tables.merge`（按将执行的操作） |
| GET | `/api/restaurants/[slug]/staff/kitchen/board` | `floor.kitchen_board.view` |
| POST | `/api/restaurants/[slug]/staff/waiter/sessions/close` | **保留 403**（waiter 永不允许；frontdesk 走 Dashboard close API） |
| PATCH | `/api/restaurants/[slug]/staff/kitchen/orders/[id]` | `orders.kitchen_update` |
| PATCH | `/api/restaurants/[slug]/staff/waiter/orders/[id]` | `orders.edit` |
| POST | `/api/restaurants/[slug]/order-receipt/print` | `orders.print_receipt` |

#### 7.3.1 明确不在店内 RBAC 内的 API

| 路径 | 鉴权方式 |
|------|----------|
| `/api/print-agent/claim`、`heartbeat`、`pending-jobs`、`jobs/[id]`、`runtime-config` | **Print Agent JWT**（设备凭证），不走 `requirePermission` |
| `/api/restaurants/[slug]/checkout/request` | 顾客会话 |
| `/api/restaurants/[slug]/orders/append`（非 `waiter_flow`） | 顾客会话 |
| `/api/restaurants/[slug]/station-tickets/auto` | `enqueue_token` + 速率限制 |
| `/api/cron/*`、`/api/admin/*`、`/api/auth/*` | 平台/系统级，独立守卫 |

迁移时 **`getOwnerRestaurantId` / `loadOwnerRestaurantWithSlug`** 并入 `requirePermission(..., 'print_agent.manage')` 或对应 `settings.*` key，**删除**平行 owner 鉴权函数（见架构 §3.4）。

### 7.4 待替换的代码符号

| 现有 | 替换为 |
|------|--------|
| `CHECKOUT_AUTHORIZED_STAFF_ROLES` | `requirePermission(..., 'checkout.confirm_payment')` |
| `OPEN_TABLE_AUTHORIZED_STAFF_ROLES` | 按接口使用 `tables.open_session` / `orders.append` 等 |
| `accessMode === 'frontdesk'` | `can(perms, 'dashboard.xxx.view')` |
| `isFrontdeskOperationalPath` | `ROUTE_PERMISSIONS[pathname]` |
| `staffAuthFromRequest(req, slug, 'kitchen')` | `requireStaffSession` + `can(perms, 'orders.kitchen_update')` |

**Owner**：`resolveCapabilities` 为 `*`；`requirePermission` 对 owner **始终通过**。侧栏不走 `can()`，走 §4.1 `visibleNavItems`。

---

## 8. 四层校验架构

### 8.0 员工 vs 店主

```
员工 staff:
  UI (Can) ──► Middleware ──► API requirePermission ──► RLS
  四层同一套 PermissionKey

店主 owner:
  UI (nav 偏好)     ── 可隐藏侧栏项
  Middleware / API  ── 恒 *，不因侧栏隐藏而拒绝
  页内按钮          ── 恒显示（能力 *）
  RLS               ── owner_id 路径不变
```

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐     ┌─────────────┐
│ UI          │     │ Middleware / │     │ API require     │     │ RLS         │
│ 员工: Can   │ ──► │ Layout 路由   │ ──► │ Permission      │ ──► │ 表级租户+角色│
│ 店主: nav偏好│     │ 店主: 不拦    │     │ 店主: 恒通过 *   │     │             │
└─────────────┘     └──────────────┘     └─────────────────┘     └─────────────┘
```

- **UI（员工）**：体验 + 防误点；不作唯一安全边界。
- **UI（店主）**：仅侧栏；页内按钮不随 nav 偏好裁剪。
- **路由（员工）**：防止直接输 URL 进入无权限页。
- **路由（店主）**：dashboard / 楼面路径均可达（实施 §4.1.4）。
- **API**：员工 `requirePermission`；店主 owner 分支或 `can(*)` 短路。
- **RLS**：防横向越权、匿名滥用；**不**细化到按钮。

### 8.1 RLS 现状（保持粗粒度，与 permission 对照）

| 表 | RLS 角色范围 | 对应 permission（应用层） |
|----|--------------|-------------------------|
| `orders` SELECT | 全员 staff + cashier | 各读接口 |
| `orders` UPDATE | kitchen, waiter | `orders.kitchen_update`, `orders.edit` |
| `bill_splits` SELECT | cashier | `dashboard.checkout.view` |
| `restaurant_tables` SELECT | kitchen, waiter, cashier | `tables.view` |
| `restaurant_tables` ALL | owner | `settings.*` 桌位配置；frontdesk 写走 service role + `tables.manage` |
| `table_sessions` SELECT | 全员 staff | 看板类 |

**原则**：短期内**不**为每个 permission 改 RLS；新 capability 优先在 API `requirePermission` 落地。仅当存在 anon/authenticated 直连 DB 且无法收拢到 API 时，才考虑 RLS 变更（须评估租户隔离）。

**Realtime / 客户端直查**：凡页面用 Supabase client 订阅或 `select`（如 `DashboardNav` 结账角标、`CheckoutRequestsManager`），**RLS 须与 capability 一致**，避免「路由/API 已拒、Realtime 仍推送」。对照表示例：

| 表 | 应用层 capability | RLS 须覆盖的角色 |
|----|-------------------|------------------|
| `bill_splits` | `dashboard.checkout.view` 或结账相关 | cashier、frontdesk、owner |
| `orders` | 看板类 view / edit | kitchen、waiter、frontdesk（按操作） |
| `table_sessions` | `tables.view` 等 | 各楼面角色 |

新增客户端订阅前：先查 RLS，再登记 permission。

---

## 9. 代码模块结构（建议）

```
apps/web/src/lib/permissions/
  registry.ts
  role-templates.ts
  owner-nav.ts
  resolve.ts
  can.ts
  require.ts
  types.ts
  resolve.test.ts
  role-templates.test.ts
  owner-nav.test.ts

apps/web/src/components/permissions/
  Can.tsx
  PermissionsProvider.tsx
```

### 9.1 核心 API

```ts
export async function resolveCapabilities(
  principal: Principal,
  options?: { restaurantId?: string },
): Promise<ReadonlySet<PermissionKey | '*'>>;

export function can(
  perms: ReadonlySet<PermissionKey | '*'>,
  key: PermissionKey,
): boolean;

export async function requirePermission(
  req: Request,
  opts: { slug?: string; restaurantId?: string },
  key: PermissionKey,
): Promise<Principal | NextResponse>; // 401/403
```

### 9.2 Dashboard 集成

- `loadDashboardAccess()` 扩展：员工返回 `capabilities`；owner 返回 `capabilities: '*'` + `ownerNavPreferences`（从 `restaurants.owner_nav_preferences` 读取）。
- `dashboard/layout.tsx` 注入 `PermissionsProvider`（含 `principal`、`capabilities`、`ownerNavPreferences`）。
- `DashboardNav`：员工 `NAV_ITEMS.filter(can)`；owner `resolveOwnerNavItems(prefs)`（§4.1.5）。
- `middleware.ts`：员工检查 `ROUTE_PERMISSIONS`；**owner 跳过 dashboard 路径白名单限制**（§4.1.4）。

### 9.3 楼面页集成

`/[slug]/kitchen|waiter` layout 在 server 端 `resolvePermissions`，无权限 redirect 到 `/{slug}/staff/login`。

`StaffAuthenticatedShell`：`expectedRole` **保留**（身份 + 登录入口），另加 permission 检查（能力）。

---

## 10. 数据模型

### 10.1 店主导航偏好（方案 A，可与 P3 同批）

`restaurants` 表增加或使用 jsonb 列存：

```sql
-- 选项 A：独立列（推荐，语义清晰）
owner_nav_preferences jsonb NULL
-- 示例值: ["dashboard.settings.view", "dashboard.checkout.view", "dashboard.tables.view", "dashboard.unpaid_orders.view"]
permissions_version integer NOT NULL DEFAULT 0

-- 选项 B：嵌在现有 feature_flags 内（少 migration，须在代码中与功能开关区分）
```

`docs/ai-schema.md` 落地时补充字段说明。仅 owner 可写。

### 10.2 员工角色权限（第三期）

```sql
-- 每店、每角色覆盖（相对 ROLE_TEMPLATES）
restaurant_role_permissions (
  restaurant_id   uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  role            text NOT NULL CHECK (role IN ('kitchen','waiter','cashier','frontdesk')),
  permission_key  text NOT NULL,
  granted         boolean NOT NULL,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (restaurant_id, role, permission_key)
);

-- 可选：单员工覆盖（第四期）
restaurant_staff_permission_overrides (
  staff_account_id uuid NOT NULL REFERENCES restaurant_staff_accounts(id) ON DELETE CASCADE,
  permission_key   text NOT NULL,
  granted          boolean NOT NULL,
  PRIMARY KEY (staff_account_id, permission_key)
);
```

**RLS**：

- `restaurant_role_permissions`：owner `ALL`（`auth_owned_restaurant_ids()`）；staff **无**浏览器直读（**推荐**：仅服务端 `resolveCapabilities` 用 service role / owner session 读；不对 anon client 暴露）。
- `restaurant_staff_permission_overrides`：同上。

**`mergeOverrides` 语义**（P3 必实现，纯函数 + 单测）：

```text
base = ROLE_TEMPLATES[role]           // 代码默认集合
for each row in restaurant_role_permissions where restaurant_id + role match:
  if row.permission_key is ownerOnly → 忽略（不应存在；写入 API 已拒）
  if row.granted → add key to set
  if !row.granted → remove key from set
return set
```

- 存储为**稀疏覆盖**（只存有变动的 key）；无行 = 纯模板默认。
- `granted: false` **可以**显式否决模板中的 `true`（例如关掉 cashier 的 `checkout.confirm_payment`）。
- 配置 UI 保存时：校验 `requires` 依赖；**拒绝**向员工授予任何 `ownerOnly` key。
- `restaurants.permissions_version`（integer，默认 0）：owner PATCH 角色权限时 `+1`；`requirePermission` 对比 JWT / session 中缓存的版本，落后则 403 并提示重新登录（与 60s 解析缓存叠加，权限收紧时不可只依赖 TTL）。

变更 schema 时同步更新 `docs/ai-schema.md`（含 `permissions_version`、`owner_nav_preferences`、`restaurant_role_permissions`）。

---

## 11. 店主配置 UI

### 11.1 员工角色权限（第三期）

- 路径：`/dashboard/settings/roles`（`settings.roles.manage`，**仅 owner**；不进可配置矩阵）。
- 按 `PERMISSIONS.group` 分组 checkbox；`dangerous` 项保存时确认；**不展示** `ownerOnly` 项。
- 「恢复默认」：删除该 `(restaurant_id, role)` 下所有覆盖行 → 回退 `ROLE_TEMPLATES`。
- 写入 `restaurant_role_permissions`；保存后 `permissions_version + 1`；**与 owner 导航无关**。

### 11.2 我的后台导航（方案 A）

- 路径：`/dashboard/settings/my-nav` 或功能设置页分组「我的后台导航」。
- 仅 owner；勾选 `OWNER_NAV_CATALOG`；保存 `owner_nav_preferences`。
- 「恢复默认」：DELETE 列值或 PATCH 为 `null` → 侧栏回 **`OWNER_NAV_DEFAULT`**（§4.1.2，**非**「仅设置」）。
- i18n：`ownerNav.*`；说明文案强调「仅影响侧栏，不限制操作权限」。

### 11.3 通用

- i18n 员工权限：`perm.*`（中/英/葡）。
- 员工角色权限保存后：`permissions_version` bump + 服务端 resolve 缓存失效（短 TTL，如 60s）；**不**要求 Realtime 推送权限变更。
- 权限**收紧**（撤销 `granted: true` 或设 `granted: false`）时：依赖 `permissions_version` 使下一请求 403；可选对受影响 role 批量 `signOut`（与停用员工同级，按 Supabase 能力选型）。

---

## 12. 与 feature_flags 的关系

| 机制 | 职责 |
|------|------|
| `restaurants.feature_flags` | 功能是否**对本店启用**（如厨房侧栏快捷入口） |
| `restaurant_role_permissions` | 员工角色能力 |
| `owner_nav_preferences` | **仅**店主侧栏显示项（方案 A） |

示例：厨房快捷入口 = `isDashboardKitchenShortcutEnabled(flags)` **且**（员工 `can(caps, key)` **或** owner 在 `owner_nav_preferences` 中含该项）。

---

## 13. 登录与落地页

| 身份 | 默认落地 | 说明 |
|------|----------|------|
| owner | `/dashboard/settings` | 固定入口；与 `OWNER_NAV_DEFAULT` 含运营项**不矛盾**（侧栏可有结账等，登录仍进设置 Hub） |
| frontdesk | `/dashboard` | P1 可保持；P3 可选：首个 `can(caps, nav.permission)` 的 `NAV_ITEMS` |
| cashier | `/dashboard/checkout` | 同上，可选按 capability 推导 |
| kitchen / waiter | `/{slug}/kitchen` / `/{slug}/waiter` | 不变 |

Owner 保存 `owner_nav_preferences` 后：**可选**将落地页改为偏好中第一项（非 P0 必须）。

Middleware 拒绝（员工无 route permission）：重定向到 **`NAV_ITEMS` 中第一个 `can()` 为 true 的 href**；若无一可访问 → `/auth/staff/login` 或提示联系店主（**禁止**落到无权限页）。

---

## 14. 分阶段实施

| 阶段 | 交付 | 验收 |
|------|------|------|
| **P0** | `registry` + `ROLE_TEMPLATES` + `resolveCapabilities` + 单元测试 | 员工默认矩阵与 §6 一致；owner 为 `*` |
| **P1** | 员工 `DashboardNav`、`middleware`、`dashboard-paths` 全量切 `can()` / `ROUTE_PERMISSIONS`；**删除**旧路径辅助 | 无 `accessMode` 硬编码残留 |
| **P1b** | Owner：middleware 放开 + `loadOperationalContext`；**删除** owner→仅 settings 重定向 | owner 与员工同一路由表 |
| **P2** | `requirePermission` 接入 §7.3；员工 `Can` 组件 | 员工 API 无权限 403；owner API 仍通 |
| **P2b** | `owner-nav.ts` + `owner_nav_preferences` 读写 + 「我的后台导航」UI | 侧栏随偏好变；深链仍可达 |
| **P3** | `restaurant_role_permissions` + 员工角色配置页 | 员工权限可配 |
| **P4** | 员工级 override（按需） | — |

---

## 15. 测试策略

- **单元**：`resolveCapabilities` 员工模板；owner `*`；`mergeOverrides` 稀疏行 + `granted: false` 否决。
- **单元**：`resolveOwnerNavItems(null)` → **`OWNER_NAV_DEFAULT`**（§4.1.2 列表，非「仅设置」）。
- **单元**：`loadPrincipal` — DB role 为准；`disabled_at` → null；**不**测 metadata 回退。
- **单元**：`ROUTE_PERMISSIONS` 与 `NAV_ITEMS` 一致；`OWNER_NAV_CATALOG` 每项有 i18n；`ownerOnly` key 不可 `mergeOverrides` 给员工。
- **回归**：`dashboard-access.test.ts` 迁移。
- **手工**：四角色 + owner — 员工侧栏/URL/API 一致；frontdesk 可进 `/dashboard/waiter`；owner 藏侧栏项后深链仍可进、API 仍 200；权限收紧后 `permissions_version` 触发 403。

---

## 16. 风险与开放问题

| 项 | 说明 | 建议 |
|----|------|------|
| owner middleware 放开 | 现网 owner 不能进 operational dashboard | P1b 与 nav 偏好分步；先放开路由再开放侧栏项 |
| owner 运营 API | `loadFrontdeskOperationalContext` 拒 owner | 统一 `loadOperationalContext`（§4.1.4） |
| owner 误以为自己没权限 | 侧栏藏了入口 | 配置页与设置内链说明；关键页保留设置内入口 |
| frontdesk 桌位 CRUD | service role | `tables.manage` 默认仅 frontdesk |
| cashier 折扣 | 现与 confirm 同权 | 默认 cashier 无 `checkout.apply_discount` |
| 改 employee role | 不可改 | 权限只配 role 模板 |
| Realtime | 客户端直查 | RLS 与 capability 对齐（§8.1）；不单靠藏菜单 |
| 性能 | 每请求 resolve | 缓存 60s + `permissions_version` 即时失效 |
| `owner_nav_preferences` 与 feature_flags 同列 | 误当功能开关 | 独立列或代码层严格区分（§4.1.3） |
| metadata 回退 | 现网 `isActiveStaffRole` 可信 metadata | 删除；仅 DB（§4.2） |
| 零权限员工 | 店主误配空角色 | middleware 落点见 §13；配置 UI 警告 |
| Print Agent 双轨 | 设备 JWT vs owner session | §7.3.1 分开，勿用 `print_agent.manage` 守 claim |
| 平行 owner 鉴权 | `getOwnerRestaurantId` 等 | 迁入 `requirePermission`（§7.3.1） |

---

## 17. 文档维护

- 新增用户可见操作或 API 时：**先**在 `registry.ts` 登记 permission，**再**接 UI/API。
- PR 检查项：是否更新 `ROLE_TEMPLATES`、§7 映射表、本文件（若行为变更）。

---

## 附录 A：与平台运营权限边界

| | 店内 RBAC | 平台 ops |
|--|-----------|----------|
| 表 | `restaurant_role_permissions` | `platform_admin_accounts` |
| 入口 | `/dashboard`、`/[slug]/*` | `/ops/*` |
| 鉴权 | owner / staff session | `requirePlatformAdmin()` |

二者**不共用**注册表与解析逻辑。
