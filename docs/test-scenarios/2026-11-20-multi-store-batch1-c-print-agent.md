# 本次改动业务场景测试报告 — multi-store batch1 阶段 C（print-agent 店路径）

**环境：** `MESA_UAT_BASE=http://localhost:3002`（feature 分支，隔离 `.next-uat`）  
**账号：** owner `luckytea@gmail.com` / Washoku Sushi `lucky-tea-mulcs62n`

## 1. 本次修改

- 8 个员工 session 的 print-agent 接口迁到 `/api/restaurants/[slug]/print-agent/…`
- 旧 `/api/print-agent/{settings,devices,pairing,pairings,bill-receipt-printer,print-jobs/…}` 保留为一版回滚别名（`legacyStoreApi` 转发）
- `requirePermission` / `requireSettingsRestaurantAuth` 去掉无店重载；slug 解析只走 `loadRestaurantRefBySlug`
- 顾客店 id 用 `PublicRestaurantId`（`mintPublicRestaurantId` 仅在公开 slug 门）
- 打印助手面板与顶栏设备列表改为 `store.api` / `restaurantApiPath`

## 2. 核心业务规则

1. 员工读写 print-agent 配置/配对/设备/队列，必须以当前 URL 店 slug 对应的店 id 鉴权；店 id 来自权限门的 `restaurantId`，不是裸 URL 字符串当业务写入源。
2. 一版内旧无 slug 路径仍可用：登录后按账户可进店解析出那一家店，再调同一套店路径 handler。
3. Agent JWT 路由（pending-jobs 等）仍在 `/api/print-agent/*`，与后台 session 路由分离。
4. 顾客侧店 id 与员工 `AuthorizedRestaurantId` 不可互换。

## 3. 详细测试场景

### 场景 1：店路径读取配置 / 设备 / 配对 / 队列

- **前置状态：** owner 已登录 Washoku；本机 web `:3002`
- **操作过程：** `GET …/print-agent/settings|devices|pairings|print-jobs/recent`
- **预期结果：** 200；返回 config/devices/pairings/jobs
- **数据验证：** devices 含既有 `DESKTOP-3VIMRTJ`；settings 有 Lisbon 时段
- **异常恢复：** 不适用（只读）
- **结果：** 【已验证】

### 场景 2：一版别名与店路径结果一致

- **前置状态：** 同场景 1
- **操作过程：** `GET /api/print-agent/settings|devices|pairings|print-jobs/recent`（无 slug）
- **预期结果：** 200；与店路径同形 payload
- **数据验证：** devices id 一致
- **结果：** 【已验证】

### 场景 3：打印助手页实点刷新设备 + 生成配对码 + 作废

- **前置状态：** 浏览器打开 `/dashboard/r/lucky-tea-mulcs62n/settings/print-assistant`
- **操作过程：** 点「Atualizar」设备 → 网络走店路径 devices；点「Gerar codigo」→ 出现一次码；列表出现 Pendente；点「Anular」作废
- **预期结果：** 码可见；作废后 pairings 为空
- **数据验证：** fetch `…/print-agent/devices`、`POST …/print-agent/pairing`；作废后 API `pending_count=0`
- **异常恢复：** 作废后可再生成
- **结果：** 【已验证】

### 场景 4：未登录 / 无权限（API）

- **前置状态：** 无 jar
- **操作过程：** 无 cookie `GET` 店路径 settings
- **预期结果：** 401
- **结果：** 【未验证】（本批未单独打无 cookie；门为既有 `requirePermission`）【待核实】

### 场景 5：顾客菜单页（PublicRestaurantId 铸造路径）

- **前置状态：** 匿名
- **操作过程：** 打开 `/lucky-tea-mulcs62n/menu`
- **预期结果：** 200，菜单可进
- **结果：** 【已验证】（HTTP 200）

### 场景 6：回归 — 店内看板入口

- **前置状态：** owner 登录
- **操作过程：** 进 waiter 看板
- **预期结果：** 页面 200，导航可用
- **结果：** 【已验证】（登录 redirect + 页加载）

## 4. 实际测试结果

| 项 | 结果 |
|---|---|
| mesa-local-uat stack-health | pass（ops softMissing） |
| owner login | pass |
| 店路径 print-agent GET×4 | pass |
| 别名 GET×4 | pass |
| 浏览器打印助手：刷新设备 / 生成码 / 作废 | pass |
| 顾客菜单 HTTP | pass |
| 无 cookie 401 | 未跑 |

## 5. 风险与待确认

- 一版别名仍挂在 `/api/print-agent` middleware bypass 前缀下（与改前一致）；batch 2 删除别名。
- 未在本批用第二家店账号交叉打别名（batch1 单店）；多店账户下别名「挑可进店」行为按 `pickEnterableStore`。
