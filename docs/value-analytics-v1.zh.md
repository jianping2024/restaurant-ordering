# 增值分析 V1 — 需求文档（代码库对齐版）

> **状态**：待开发  
> **版本**：V1  
> **最后修订**：2026-06-26（对照当前 `main` 代码库查漏补缺）  
> **范围**：老板轻量经营参考；非 BI、非库存系统

---

## 1. 功能目标

新增左侧菜单 **「增值分析」**，为老板提供近期营业参考：

| 模块 | 说明 |
|------|------|
| 营业额趋势 | 最近 7/30 天每日实收 |
| 客流趋势 | 最近 7/30 天每日来店人数 |
| 高消耗菜品 Top 10 | 按数量排序 |
| 备货参考 Top 5 | 固定基于最近 7 天 |

设计原则：**低复杂度、低数据库压力、低维护成本、不影响营业主流程**。

---

## 2. 功能范围（V1 仅做以下四项）

- 营业额趋势（折线图）
- 客流趋势（折线图）
- 高消耗菜品 Top 10（表格）
- 备货参考 Top 5（表格）

**明确不做**：统计快照表、定时任务、缓存层、自定义日期、同比环比、库存预测、精确补货量。

---

## 3. 菜单与路由

### 3.1 入口

| 项 | 值 |
|----|-----|
| 菜单文案（zh） | 增值分析 |
| 路由 | `/dashboard/value-analytics` |
| 菜单位置 | **店主侧栏** `ownerNavItems`（与「异常操作」同级，见 `DashboardNav.tsx`） |

本期不重构整体菜单；仅在 `ownerNavItems` 追加一项。

### 3.2 i18n

在 `apps/web/src/lib/i18n/messages.ts` 的 `nav` 中新增 key（如 `valueAnalytics`），三语：

- zh：增值分析
- en：Value analytics（或 Business insights）
- pt：Análise de valor（或 equivalente）

页面标题区、模块标题、空/错/无权限文案同步加入 `valueAnalytics` 分组。

---

## 4. 访问权限

### 4.1 角色矩阵（对齐本仓库）

本系统 **无 `OWNER` 枚举**；老板 = `restaurants.owner_id === auth.uid()`，对应 `DashboardAccessMode: 'owner'`。

员工角色（`restaurant_staff_accounts.role` / `StaffAccountRole`）为 **小写**：`kitchen` | `waiter` | `cashier` | `frontdesk`。

| 身份 | 是否可访问 |
|------|-----------|
| 老板（owner） | ✅ |
| frontdesk 前台 | ❌ |
| cashier 收银员 | ❌ |
| waiter 服务员 | ❌（且无 dashboard 运营入口） |
| kitchen 厨房 | ❌（且无 dashboard 运营入口） |

### 4.2 校验要求

**后端必须校验**（不能只藏菜单）：

1. **页面**：`loadDashboardAccess()` → `mode === 'owner'`，否则 `notFound()` 或专用无权限页（与 `abnormal-operations/page.tsx` 一致）。
2. **API**：复用 `loadOwnerAbnormalOperationsContext()` 模式，或抽取 `loadOwnerAnalyticsContext()`，非 owner 返回 **403**。
3. **Middleware**：将 `/dashboard/value-analytics` 纳入 `isOwnerOperationalPath()`（`dashboard-paths.ts`），与异常操作页一致拦截非 owner。

无权限文案（固定）：

```text
当前账号无权访问增值分析。
```

API 建议返回：`{ error: 'forbidden', message: '当前账号无权访问增值分析。' }`（HTTP 403）。

---

## 5. 页面结构

```
页面标题：增值分析
副标题：查看近期营业趋势与菜品消耗参考

[ 最近 7 天 | 最近 30 天 ]   ← 默认 7 天

┌ 营业额趋势（折线图） ─────────────┐
└──────────────────────────────────┘

┌ 客流趋势（折线图） ───────────────┐
└──────────────────────────────────┘

┌ 高消耗菜品 Top 10（表格） ────────┐
└──────────────────────────────────┘

┌ 备货参考 Top 5（表格） ───────────┐
│ 说明：备货参考仅根据最近 7 天…    │
└──────────────────────────────────┘
```

### 5.1 页面状态

| 状态 | 文案/行为 |
|------|-----------|
| loading | 骨架或 spinner |
| empty | `当前时间范围暂无增值分析数据` |
| error | `增值分析数据加载失败，请稍后重试` |
| no permission | `当前账号无权访问增值分析。` |

**empty 判定**：四个模块均无有效统计点（趋势全 0 且两个 Top 列表为空）时展示 empty；若仅有趋势为 0 但 Top 有数据，不算 empty。

---

## 6. 时间范围

| 参数 | 含义 |
|------|------|
| `range=7d` | 最近 7 个自然日（含今天） |
| `range=30d` | 最近 30 个自然日（含今天） |

- 默认：`7d`
- 非法值：返回 **400** `invalid_range`
- 粒度：按日
- **时区**：与现有 dashboard 一致，使用 `Europe/Lisbon`（`DASHBOARD_DISPLAY_TZ`，见 `format-dashboard-date.ts`）

日期序列：无论当天是否有数据，**必须补齐范围内每一天**（无数据填 0）。

---

## 7. 数据口径（核心 — 须与现有订单模型对齐）

### 7.1 术语映射（原 PRD → 本仓库）

| 原 PRD | 本仓库实际 |
|--------|-----------|
| `storeId` | `restaurant_id` |
| `order_items` 表 | **不存在**；明细在 `orders.items`（JSONB `OrderItem[]`） |
| 订单状态 `completed/paid` | `orders.status`: `pending` \| `cooking` \| `done` |
| `completedAt` | **orders 表无此列**；结账完成时间见 `table_sessions.closed_at` |
| Buffet 成人/儿童 | `OrderItem.kind === 'buffet_base'`，字段 `adult_count` / `child_count` |
| 作废菜品 | `OrderItem.item_status === 'voided'` |
| 测试订单 | **无专用字段**；V1 不单独排除（见 §12 查漏补缺） |

### 7.2 「已完成 / 已收款」会话定义（营业额 & 客流共用）

统计单元为 **已正常结账关台的餐次（table session）**，须同时满足：

1. `table_sessions.restaurant_id = :restaurantId`
2. `table_sessions.status = 'closed'`
3. **非未收款强制关台**：该 session 在关台时 `compute_session_payment_gap` 语义下 **不是** `is_unpaid_close`  
   - 实现建议：关台后该 session 下订单 `orders.total_amount > 0`（强制关台会把订单行 void 且 `total_amount → 0`，见 `table-session-close.zh.md`）  
   - 或：`bill_splits` 存在且最终为 `paid`，且无未付 gap（以实收为准时优先此路径）
4. 排除 `bill_splits.status = 'cancelled'` 且从未 `paid` 的纯放弃结账（已含于上）

**不计入**：

- 活跃 session（`open` / `billing`）下的订单
- 未收款关台（`left_unpaid` 等）后的 session
- 订单行已 void、订单 `total_amount = 0` 的强制关台结果

### 7.3 营业额（实收金额）

**按 session 归属日**：以 `table_sessions.closed_at` 落入的 **Lisbon 自然日** 汇总。

**金额来源（二选一，实现前需产品确认，推荐 A）**：

| 方案 | 口径 | 优点 |
|------|------|------|
| **A（推荐）** | 该 session 下所有 `bill_splits.status = 'paid'` 的 `result` 行中 `paid === true` 的 `amount` 之和（含折扣后实收） | 与收银实收一致 |
| B | 该 session 下所有 qualifying `orders.total_amount` 之和 | 实现简单，但与折扣/分账实收可能偏差 |

V1 **推荐方案 A**；若 session 无 bill_split 但有收款（边缘场景），回退 sum `orders.total_amount`（需单测覆盖）。

返回字段：

```json
{ "date": "2026-06-01", "revenue": 368.5 }
```

无订单日：`revenue: 0`。

### 7.4 客流

**按 session 归属日**（同 `closed_at` Lisbon 日）。

对每个 qualifying session：

```text
adultCount  = Σ 该 session 所有 qualifying orders 中 active buffet_base 行的 adult_count
childCount  = Σ … child_count
customerCount = adultCount + childCount
```

**Buffet 人头规则**：

- 仅统计 `kind === 'buffet_base'` 且 `item_status !== 'voided'` 的行
- 同一 session 多订单时：与 `aggregateBuffetForOrders` / `latestActiveBuffetBaseLine` 一致，取 **最新有效 buffet_base 行** 的 adult/child（避免加人 void 旧行重复计数）

返回：

```json
{
  "date": "2026-06-01",
  "customerCount": 86,
  "adultCount": 64,
  "childCount": 22
}
```

页面折线用 `customerCount`；tooltip 展示成人/儿童。

### 7.5 高消耗菜品 Top 10

**统计范围**：与 `range` 一致（7d 或 30d）内，所有 qualifying session 下的 qualifying orders。

**明细行条件**：

- `kind !== 'buffet_base'`（复用 `isBuffetBaseItem()`）
- `item_status !== 'voided'`（复用 `normalizeOrderItemStatus` / void 判断）
- 所属 order 属于 qualifying session

**聚合键**：`OrderItem.id`（即 `menu_items.id` 快照）

| 字段 | 计算 |
|------|------|
| `consumedQuantity` | Σ `qty` |
| `amount` | Σ `price * qty` |
| `itemName` | 按当前 UI 语言解析 `name_pt` / `name_en` / `name_zh`（服务端可返回三语或 `name_pt` + 前端 i18n） |
| `categoryName` | **订单行无 category 快照** → 查询时 left join `menu_items.category`（或 `menu_categories`）；已删菜品用行内快照或 `"—"` |

排序：`consumedQuantity DESC`，取前 10；并列时按 `amount DESC`、`itemId ASC`。

### 7.6 备货参考 Top 5

- **始终**基于最近 7 天（与页面 `range` 无关）
- 规则同 §7.5，取 Top 5
- 字段：`consumedQuantity7d`、`amount7d`、`tag: "备货参考"`
- 响应含 `disclaimer`（固定中文；前端 i18n 展示各语言版本）

---

## 8. API 设计

### 8.1 聚合接口

```http
GET /api/analytics/value-overview?range=7d
GET /api/analytics/value-overview?range=30d
```

| 项 | 说明 |
|----|------|
| 鉴权 | owner only（§4） |
| 租户 | `restaurant_id` 来自 owner context，**禁止**客户端传入 |
| 实现 | `AnalyticsService` 聚合；route 仅参数校验 + 调 service |

### 8.2 响应结构

```json
{
  "range": "7d",
  "revenueTrend": [{ "date": "2026-06-01", "revenue": 368.5 }],
  "customerTrend": [{
    "date": "2026-06-01",
    "customerCount": 86,
    "adultCount": 64,
    "childCount": 22
  }],
  "topConsumedItems": [{
    "rank": 1,
    "itemId": "uuid",
    "itemName": "Cola",
    "categoryName": "饮料",
    "consumedQuantity": 126,
    "amount": 252.0
  }],
  "stockReferenceItems": [{
    "rank": 1,
    "itemId": "uuid",
    "itemName": "Cola",
    "categoryName": "饮料",
    "consumedQuantity7d": 126,
    "amount7d": 252.0,
    "tag": "备货参考"
  }],
  "disclaimer": "备货参考仅根据最近 7 天订单消耗生成，不等同于实际库存建议。"
}
```

### 8.3 错误码

| HTTP | error | 场景 |
|------|-------|------|
| 401 | unauthorized | 未登录 |
| 403 | forbidden | 非老板 |
| 400 | invalid_range | range 非 7d/30d |
| 503 | server_misconfigured | admin client 不可用 |

---

## 9. 后端实现要点

### 9.1 文件规划（建议）

```
apps/web/src/lib/analytics/
  analytics.service.ts      # 聚合逻辑
  analytics.types.ts        # 响应类型
  analytics.service.test.ts # 口径单测
apps/web/src/app/api/analytics/value-overview/route.ts
apps/web/src/app/dashboard/value-analytics/page.tsx
apps/web/src/components/dashboard/ValueAnalyticsPageClient.tsx
```

### 9.2 查询策略（轻量实时）

1. 查 `table_sessions`：`restaurant_id` + `status=closed` + `closed_at` 在范围内
2. 过滤 qualifying sessions（§7.2）
3. 批量查 `orders` by `session_id`
4. 批量查 `bill_splits` by `session_id`（营业额方案 A）
5. 菜品 Top：内存聚合 JSONB items；`menu_items` 批量补 category
6. 备货：独立再跑 7d 窗口 Top 5

**禁止**：前端拉全量 orders 自行统计。

### 9.3 索引

现有（`docs/ai-schema.md`）：

- `idx_orders_status` → `(restaurant_id, status)`
- `idx_orders_session` → `(session_id)`
- `idx_table_sessions_status` → `(restaurant_id, status)`

**V1 新增**（已确认：未投产，迁移成本低；直接优化 analytics 主查询）：

```sql
CREATE INDEX idx_table_sessions_restaurant_closed_at
  ON table_sessions (restaurant_id, closed_at DESC)
  WHERE status = 'closed';
```

原 PRD 的 `orders(restaurant_id, status, completedAt)` **不适用**（无 `completed_at`）。实现时可选跑 `EXPLAIN` 留档，不作为门禁。

---

## 10. 前端实现要点

### 10.1 图表库

当前 `apps/web` **无** recharts/chart.js 依赖。

V1 需 **新增一个图表库**（推荐 `recharts`，与 React 18 兼容）或自绘 SVG 折线（成本更高）。

> **依赖变更须单独批准**（AGENTS.md）；实现前确认是否允许 `npm install recharts`。

### 10.2 金额展示

沿用现有模式：`€{amount.toFixed(2)}`（与 `BillPage`、`CheckoutRequestsManager` 一致）。

### 10.3 数据获取

页面 mount / 切换 range 时 **单次** `fetch('/api/analytics/value-overview?range=...')`；处理 loading / empty / error / forbidden。

### 10.4 不改动范围

- 订单历史（`/dashboard/orders`）
- 数据概览（`/dashboard` frontdesk overview）
- 异常操作（`/dashboard/abnormal-operations`）

---

## 11. 验收标准

### 11.1 权限

- [ ] 老板可访问菜单、页面、API
- [ ] frontdesk / cashier 访问页面 404 或等效，API 403
- [ ] 菜单隐藏 alone 不足够；直链 API 仍 403

### 11.2 页面

- [ ] 标题、副标题、7/30 切换（默认 7 天）
- [ ] 四模块均展示
- [ ] loading / empty / error / no permission

### 11.3 营业额

- [ ] 按 Lisbon 自然日
- [ ] 仅 qualifying 已收款 session
- [ ] 未付款关台、活跃桌不计
- [ ] 无数据日为 0
- [ ] 与收银实收（方案 A）抽样一致

### 11.4 客流

- [ ] `customerCount = adultCount + childCount`
- [ ] 仅 qualifying session
- [ ] tooltip 展示成人/儿童
- [ ] buffet 人头不重复计数（最新有效 buffet_base）

### 11.5 菜品

- [ ] 排除 `buffet_base`、voided
- [ ] Top 10 / Top 5 排序与上限
- [ ] 备货始终 7 天 + disclaimer

---

## 12. 查漏补缺（原 PRD 与代码库差异）

### 12.1 必须修订项（阻塞实现）

| # | 原 PRD | 代码库事实 | 本文档处理 |
|---|--------|-----------|-----------|
| 1 | `storeId` | `restaurant_id` | §7.1 已映射 |
| 2 | `order_items` 表 + 索引 | JSONB `orders.items` | §9.2 内存聚合 |
| 3 | `completedAt` | 无；用 `table_sessions.closed_at` | §7.3–7.4 |
| 4 | 订单状态 completed/paid | `pending/cooking/done` + session/bill 结账语义 | §7.2 |
| 5 | `OWNER/FRONT_DESK/...` 大写枚举 | owner 非 staff 行；staff 小写四角色 | §4.1 |
| 6 | 营业额 = 订单金额合计 | 需明确是否含折扣、分账实收 | §7.3 方案 A/B |
| 7 | 图表组件「复用现有」 | **无图表库** | §10.1 需新增依赖或自绘 |
| 8 | `AnalyticsService` | 不存在 | §9.1 新建 |
| 9 | 菜品 `categoryName` | 订单行无 category | join `menu_items` §7.5 |
| 10 | 索引 `completedAt` | 不适用 | §9.3 改 `closed_at` |

### 12.2 建议澄清项（不阻塞但影响验收）

| # | 问题 | 建议 |
|---|------|------|
| 1 | **测试订单**无字段 | V1 不排除；若未来有 `is_test` 再过滤 |
| 2 | 未收款关台后订单历史仍可见 | 营业额以 `total_amount>0` / paid split 过滤，与「订单历史」列表口径可能不同 — **产品已知差异** |
| 3 | 合并/转台 session | 人头与金额归属 **最终 closed 的 session** 的 `closed_at` 日 |
| 4 | 跨日营业（凌晨关台） | 一律 `Europe/Lisbon` 切日，与 overview 一致 |
| 5 | 已删除 `menu_items` | Top 仍显示订单快照名称；category 缺失显示 `—` |
| 6 | 权限模块重构进行中（`role-permissions-architecture.zh.md`） | V1 仍用 `loadOwner*Context`；后续可挂 `permissionKey: analytics.view` |
| 7 | 店主默认进 `/dashboard/settings` | 新菜单仅 owner 侧栏，不影响 redirect |
| 8 | `disclaimer` API 固定中文 | 前端应用 i18n 展示，API 字段可作 zh 默认值 |

### 12.3 原 PRD 已覆盖且无需改动

- 单接口聚合、最大 30 天、Top 10/5 上限
- 备货固定 7 天规则与说明文案
- 前端禁止原始订单统计
- 不新增快照表/定时任务/缓存
- 不影响开台/加菜/结账主流程（只读查询）

---

## 13. 测试与发布

### 13.1 单测（`analytics.service.test.ts`）

- range 解析与非法参数
- 日期序列补齐（7/30 天）
- qualifying session 过滤（ unpaid close → 排除）
- buffet_base 排除、voided 排除
- 客流：多 buffet 行取最新有效
- Top 排序与截断
- 备货 7d 与页面 30d 解耦

### 13.2 发布前检查

```bash
npm run lint
npm run build   # 触及 app/api、lib、types
node --import tsx --test apps/web/src/lib/analytics/analytics.service.test.ts
```

---

## 14. 开发检查清单（实现前只读扫描）

- [x] 订单表：`orders` + JSONB `items`（`docs/ai-schema.md`）
- [x] 订单状态：`OrderStatus` = pending | cooking | done
- [x] 支付： `bill_splits.status` = paid；`confirm_bill_split_payment` RPC
- [x] 完成时间：`table_sessions.closed_at`（非 orders.completed_at）
- [x] 成人/儿童：`OrderItem.adult_count` / `child_count` on `buffet_base`
- [x] 菜品类型：`OrderItemKind` = menu | buffet_base
- [x] 分类：`menu_items.category` / `category_id`
- [x] 删除菜品：`item_status === 'voided'`
- [x] 权限：`loadOwnerAbnormalOperationsContext` / `isOwnerDashboardUser`
- [ ] 图表组件：需引入（见 §10.1）
- [x] 日期工具：`date-fns` + `DASHBOARD_DISPLAY_TZ`
- [x] 金额格式：`€` + `toFixed(2)`

---

## 15. 结论

增值分析 V1 在 **老板只读、单接口、30 天内实时聚合** 约束下，复用现有 **session 结账 + JSONB 订单行** 模型即可落地。

实现前 **必须** 确认 §7.3 营业额口径（推荐 bill_splits 实收）；实现时 **必须** 处理 §12.1 中与原 PRD 的结构差异，避免按不存在的 `order_items` / `completedAt` / `storeId` 开发。
