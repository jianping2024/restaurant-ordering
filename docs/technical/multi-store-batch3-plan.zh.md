# 多店访问 · 第三批（多店概览页）实现计划

> 依据：`docs/technical/multi-store-access-plan.zh.md`（下称「方案」）§8.4、§6.2b、§11.2 场景 13、18、22。Will 已确认「按方案改」（2026-11-20），2026-11-24 说「开始第三批」。
> 第一、二批已合进 main（第二批在本地 main `cfc1153d`，未 push）。**不要重新分析，也不要再问已拍板的事。** 有新发现写进本会话报告，由主会话判断。
> 界面参照可交互原型 `docs/technical/multi-store-prototype.html` 的「多店概览」一屏。

## 0. 已拍板（不要再问）

- 页面路径 `/dashboard/multi-store`：不带店 slug，不属于任何一家店。
- **范围**：该账号在哪些店有 `dashboard.overview.view`，一次查出（店籍 → 角色权限一次 join），不逐店调 principal。不新增全局权限 key。
- **入口**：可进入店 ≥2 时才显示，只是 UX 层面，不是授权。显示位置：
  - 选店页底部固定入口；
  - 切店下拉底部固定入口；
  - 后台侧栏。
- **每家店一行**，列为：已收、未收、今日桌/人、当前用餐桌/人。
  - 口径与单店首页同名字段一致：`todayRevenue`、`diningUncollectedAmount`、`todayTableCount`/`todayGuests`、`diningTableCount`/`diningGuests`。
  - 营收取不到（`revenueAvailable=false`）时显示「—」。
  - 暂停店标「已暂停」，不计入合计。
- **筛选**：
  - 一个「店铺范围」多选下拉：全部 / 按城市 / 自选（带搜索）；
  - 另有店名搜索框；
  - 不做「一家店一个标签按钮」。
  - 城市和搜索只用 `@mesa/shared` 的 `restaurantCityFromAddress`、`storeMatchesSearch`。
- **表格**：
  - 每列可排序，默认按已收降序；
  - 表头固定，内容滚动；
  - 合计行固定在表格底部，合计只算当前筛选结果；
  - 超过 50 家分页。
- **数据**：
  - 服务端一次批量计算所有入选店；
  - 批量版与单店首页是**同一口径函数**，参数为 `restaurantIds[]`；
  - 不逐店串行，不在浏览器端直查；
  - 结果短时缓存约 30 秒，授权每次请求都重新判断，不进缓存。
- **加载**：打开时加载一次，另有手动刷新；不轮询。
- **首页切换门槛**：批量版先只给多店概览用，单店首页暂时不切。用比对脚本比较批量版与现有单店计算：
  - 范围：全部门店；
  - 时点：营业中、打烊后、有未收账单时；
  - 字段：已收、未收、今日桌/人、当前用餐桌/人，逐字段比较；
  - **全部完全一致**后，单店首页才改调同一实现，并删除旧实现。
  - 比对结果写进本批 UAT 证据。不一致就停下报告，不切首页。
- **被否掉的**：逐店串行计算；浏览器直查；轮询；新增全局权限 key；概览里出现写操作。

## 1. 本批新增的约定（主会话 2026-11-24 定）

- **数据接口**：`GET /api/multi-store/overview`。概览不属于任何一家店，所以不放在 `/api/restaurants/[slug]` 下。
  - 支持可选参数 `?restaurant_ids=…`，只能在已授权集合内取子集；集合外的 id 忽略，不报 403。
  - 页面首屏由服务端组件直接调同一个 loader，手动刷新走这个接口。
- **批量授权入口**：放在 `lib/permissions/restaurant-access.ts`，返回 `AuthorizedRestaurantId[]`。它是除 `loadPrincipalForRestaurant` 之外**唯一**能批量产生该品牌类型的地方，要同步更新 `check-store-id-source` 脚本的白名单说明。
- **批量计算方式**：
  - 营收 RPC `dashboard_overview_revenue_bundle` 目前按单店取，新增批量 RPC（`restaurant_ids uuid[]`，按店返回），用新迁移；
  - 当前用餐、未收用 `.in('restaurant_id', ids)` 一次查出，再按店分组；
  - 单店首页切换后，改为传一个 id 调同一实现。
- **分两个会话，顺序执行，不并行**：页面依赖接口形状，并行就得先写桩再删，不划算。

## 2. 分工

| 阶段 | 会话 | 内容 | 依赖 |
|---|---|---|---|
| **3A 批量口径与接口** | 1 个 | 批量授权入口；批量 KPI 实现与批量 RPC 迁移；`GET /api/multi-store/overview` 与 30 秒缓存；比对脚本与场景 22；全部一致后切单店首页、删旧实现 | 无 |
| **3B 概览页面与入口** | 1 个，3A 合进 main 后开 | `/dashboard/multi-store` 页面（范围下拉、搜索、排序、固定表头和合计、分页、手动刷新、暂停标记、「—」）；三个入口；场景 13、18 | 3A |
| **收尾** | 主会话 | 合并、清冗余复核、场景 13、18、22 回归 | 3A、3B 合进 main |

**文件边界：**
- 3A：
  - `lib/dashboard-overview.ts` 及其测试；
  - 新增 `lib/multi-store-overview*.ts`（loader + 类型）；
  - `lib/permissions/restaurant-access*.ts`；
  - `lib/analytics/closed-session-revenue.ts`；
  - `app/api/multi-store/**`；
  - 新迁移 + `docs/ai-schema.md` + on-prem baseline；
  - `scripts/agent-gates/check-store-id-source.mjs`；
  - 比对脚本放 `scripts/`。
- 3B：
  - `app/dashboard/multi-store/**`；
  - 新的概览表格组件；
  - `components/store-picker/**`（`StoreList`、`StorePickerScreen`、`StoreSwitcher` 底部入口）；
  - 侧栏 / `dashboard-top-nav.ts`；
  - middleware session policy（新路径要能正确识别为无店后台页）；
  - i18n 文案。
- 3B 只调用 3A 的 loader 和类型，不改 3A 的文件；需要改时先停下来报告。

## 3. 已核实的代码事实（2026-11-24，main `cfc1153d`）

- `apps/web/src/lib/dashboard-overview.ts`：
  - 类型 `DashboardTodayKpis` 在 :129，含 `revenueAvailable`、`revenueByChannel`；
  - `loadTodayRevenueKpis` 在 :485，单店调 `loadClosedSessionRevenueBundleRpc` + `fetchItemOrdersBySessionIds`；
  - `loadDiningFloorKpis` 在 :324；
  - `computeTodayKpis` 在 :297，`loadDashboardOverviewPrimary` 在 :541（还取待办计数，概览不需要）。
- 营收 RPC：`lib/analytics/closed-session-revenue.ts:56` 调 `dashboard_overview_revenue_bundle`，迁移见 `20260727160000_dashboard_overview_revenue_bundle.sql`、`20261029130000_revenue_bundle_ordering_channel.sql`。
- 单店首页入口：`app/dashboard/r/[slug]/page.tsx` → `DashboardPageClient.tsx`。
- 店铺列表组件：`components/store-picker/StoreList.tsx`、`StorePickerScreen.tsx`、`StoreSwitcher.tsx`（第二批，选店页与切店共用）。
- 鉴权入口：`lib/permissions/restaurant-access.ts`（`listAuthorizedRestaurantsForUser`、`loadPrincipalForRestaurant`）；店 id 来源检查 `scripts/agent-gates/check-store-id-source.mjs`，已接入 `gate.sh check`。
- 本地测试数据：
  - 店：白云 `restaurant-mohnrib5`、`ms2b-01…29`（`ms2b-29` 暂停）；
  - 账号：`ms2bthirty` 关联 30 家店，`ms2btwo` 关联两家店，`ms2bone` 单店；
  - 口令写在 2B 的种子脚本里，路径见第二批交接笔记 `multi-store-batch2-2B-handover.md`；
  - 白云有真实测试营业数据，`ms2b-*` 基本是空店，造营业中 / 未收数据请走结账接口或种子 SQL。

## 4. 每个会话的通用要求

- 严格按 skill `token-saving-delivery` 执行。
- 独立 worktree，分支基于最新 main。不碰共享 checkout，不动别人的 WIP。本地端口和 `MESA_NEXT_DIST_DIR` 用自己的。worktree 里的 `.env.local.dev`、`apps/web/.env.local` 局域网 IP 改成 `127.0.0.1`。
- 同时最多 2 个会话；不要再开子会话，子代理可以用。
- 有迁移时：新时间戳迁移，先在本地 Docker 跑通（`db push --local --include-all`），更新 `docs/ai-schema.md`，刷新 on-prem baseline。
- 门禁：清冗余 `scan.md` → `gate.sh scan` → 证据（含 `mesa-local-uat`）→ `gate.sh uat` → `gate.sh check`。
- 行为验收：
  - 单店首页数字不变；
  - 3A 跑场景 22 和比对证据；
  - 3B 跑场景 13、18，用 30 家店账号，记录实测打开时间。
- 只 commit 到自己的分支，**不合并 main、不 push**。完成后报告分支名与 commit SHA，由主会话合并。
- 遇到方案没覆盖、或与代码事实冲突：写进报告并停在那一步，不自行改方案。
- 落地时在 `docs/agent-sole-index.zh.md` 的 dashboard 段同步一行，例如「多店概览与首页同一批量 KPI 实现」。
