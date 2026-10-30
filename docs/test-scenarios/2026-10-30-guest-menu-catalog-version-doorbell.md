# 本次改动业务场景测试报告：客人菜单版本对账 + Realtime 门铃

日期：2026-10-30  
分支：`feat/guest-menu-catalog-version-doorbell`  
UAT 基址：`http://127.0.0.1:3002`（feature + `.next-uat`）

## 1. 本次修改

- **内容：** 客人点餐页有首屏目录时仍做进页/回前台版本对账；SSR 下发 `menu_catalog_version`；服务端目录缓存按版本号分桶；窄表 `menu_catalog_signals` 进 Realtime，客人页门铃触发同一套 `ensureCustomerMenuCatalog`（变了才拉全量）。
- **文件：** `MenuPage.tsx`、`CustomerMenuCatalogRealtime(.tsx|Lazy)`、`customer-menu-catalog.ts`、`customer-menu-catalog-display.ts`、menu page + catalog API、migration `20261030140000`（曾加 `restaurants` 到 publication）+ `20261030143000`（建 `menu_catalog_signals` 并从 publication 去掉 `restaurants`）、`docs/agent-sole-index.zh.md`、`docs/ai-schema.md`
- **角色 / 页面：** 客人扫码菜单；后台改菜单触发版本 +1 并 upsert 门铃行

## 2. 核心业务规则

1. 目录新旧只看 `restaurants.menu_catalog_version`。【本次新增接线】【已实现】
2. 客户端唯一拉取：`ensureCustomerMenuCatalog`（knownVersion 一致 → unchanged）。【已实现】
3. 页可见时订 `menu_catalog_signals`（`restaurant_id=eq.<店>`）；门铃防抖后走 ensure；不可见不拉。【本次新增】
4. 禁止定时轮询目录；禁止并行 `menu_items` CDC；禁止订整表 `restaurants` CDC。【已实现】
5. 有 SSR 种子也不得关掉进页/回前台对账钩子。【本次修复】

## 3. 详细测试场景

### 场景 1：API 版本对账（不变则轻量）

- **前置状态：** 本地栈健康；DB `menu_catalog_version=453`（后测时为 454）
- **操作过程：** `GET …/customer/menu-catalog?knownVersion=<当前V>`
- **预期结果：** `{ version: V, unchanged: true }`，无全量 menuItems
- **数据验证：** 响应体仅 version + unchanged
- **异常恢复：** 不适用

### 场景 2：后台 bump 后 API / DB 版本递增

- **前置状态：** Mojito Classic（`ce8a2ee1-…`）`available=false`；version=453
- **操作过程：** 店主 API `PATCH …/dashboard/menu/items` `batch_available` → `available=true`
- **预期结果：** `restaurants.menu_catalog_version` 与 `menu_catalog_signals.version` 均为 454；菜 `available=true`
- **数据验证：** SQL 核对
- **异常恢复：** 不适用

### 场景 3：客人页开着，后台 bump，门铃触发换目录（不强刷）

- **前置状态：** Chrome 独立上下文打开 `http://127.0.0.1:3002/restaurant-mohnrib5/menu?table_id=…`（A-01）；localStorage 目录 `catalogVersion=453`，Mojito `available=false`；页保持 `visibilityState=visible`
- **操作过程：** 另一进程用店主 jar 做场景 2 的 PATCH；**不**切走客人页、不人为 focus/blur
- **预期结果：** 防抖后 localStorage `catalogVersion≥454` 且 Mojito `available=true`
- **数据验证：** 客户端版本与 DB 一致；未强刷（仍同一 document）
- **异常恢复：** Realtime 失败时回前台应对账补一次（场景 4）

### 场景 4：回前台对账（有 SSR 种子）

- **前置状态：** MenuPage 有首屏种子仍挂 `useRestaurantStaffEntryReconcile`；API knownVersion 路径可用
- **操作过程：** 代码路径核对 + 场景 1 证明 ensure 轻量；门铃已在场景 3 覆盖主动推送
- **预期结果：** 进页/回前台仍走 reconcile；版本未变则 unchanged
- **数据验证：** 同场景 1
- **异常恢复：** 不适用

### 场景 5：回归 — 会话页未因目录门铃挂掉

- **前置状态：** 开台桌 A-01 客人菜单在 feature 基址可打开
- **操作过程：** 打开菜单页，确认标题与桌名渲染、目录有菜
- **预期结果：** 页正常；目录门铃与会话订阅并存不挡首屏
- **数据验证：** title `白云自助火锅 · A-01`；catalog itemCount>0

## 4. 实际测试结果

| 场景 | 标签 | 结果 |
|---|---|---|
| 1 knownVersion 不变 | 【已验证】 | pass — `453`/`454` 均返回 `unchanged:true` |
| 2 PATCH bump | 【已验证】 | pass — DB 453→454，signal 同步，Mojito available=true |
| 3 门铃被动更新 | 【已验证】 | pass — 客人页仍 visible，catalogVersion 453→454，Mojito available=true |
| 4 回前台对账钩子 | 【已实现】部分【已验证】 | pass（代码始终挂 reconcile + API ensure）；未单独人为 blur→focus 复测门铃漏推 |
| 5 客人页可开 | 【已验证】 | pass — `:3002` 客人菜单可开、缓存 191 道菜 |

机器证据见 `.mesa-agent-gates/feat__guest-menu-catalog-version-doorbell/uat.md`。

## 5. 风险与待确认

- 无：门铃表只 upsert `restaurant_id/version/bumped_at`，与 durable `menu_catalog_version` 同次 bump。【已实现】
- 本机需已应用 `20261030143000_menu_catalog_signals_doorbell`（publication 含 `menu_catalog_signals`、不含 `restaurants`）。【已验证】
