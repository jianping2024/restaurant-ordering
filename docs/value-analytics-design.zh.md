# 增值分析 V1 — 详细设计方案

> **关联需求**：[value-analytics-v1.zh.md](./value-analytics-v1.zh.md)  
> **状态**：设计稿（待评审）  
> **版本**：V1  
> **最后修订**：2026-07-21

---

## 1. 设计目标与约束

### 1.1 目标

在 **不改变营业主流程** 的前提下，为老板（`restaurants.owner_id`）提供只读、单页、单接口的 7/30 天经营快照。

### 1.2 硬约束

| 约束 | 设计应对 |
|------|----------|
| 低 DB 压力 | 以 `table_sessions` 为驱动表；最多 30 天 closed session；批量 `IN` 查 orders / bill_splits |
| 低维护 | 纯函数聚合 + 单测；无快照表 / cron；**成功 `ValueOverview` 按「餐厅 + range + Lisbon 营业日」短 TTL 缓存**（`unstable_cache`，默认 120s）；失败结果不缓存；`?refresh=1` 绕过缓存 |
| 租户隔离 | 所有查询带 `restaurant_id`；API 不接受客户端 tenant 参数 |
| 权限 | owner-only，三层：middleware + page + API |
| 口径一致 | 复用 `isBuffetBaseItem`、`latestActiveBuffetBaseLine`、`normalizeOrderItemStatus` |

### 1.3 已锁定产品决策

1. **营业额**：采用 **bill_splits 实收（方案 A）**，含折扣后金额；无 paid split 时回退 `orders.total_amount` 之和。
2. **统计单元**：**已收款关台的 `table_session`**，归属日以 `closed_at` 的 Lisbon 自然日为准。
3. **备货参考**：永远最近 7 天，与页面 `range` 解耦。

---

## 2. 总体架构

```text
┌─────────────────────────────────────────────────────────────┐
│  Browser: /dashboard/value-analytics                        │
│  ValueAnalyticsPageClient                                   │
│    ├─ RangeToggle (7d | 30d)                                │
│    ├─ TrendLineChart × 2                                    │
│    ├─ TopItemsTable × 2                                     │
│    └─ fetch → GET /api/analytics/value-overview?range=      │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│  route.ts / value-analytics page                            │
│    parseRange → owner context → getCachedValueOverview      │
│         └─ unstable_cache(success DTO) → getValueOverview   │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│  AnalyticsService (getValueOverview)                        │
│    ├─ resolveDateWindow(range)                              │
│    ├─ fetchQualifyingSessions(admin, restaurantId, window)  │
│    ├─ fetchSessionOrders / fetchSessionBillSplits           │
│    ├─ buildRevenueTrend / buildCustomerTrend                │
│    ├─ aggregateMenuItems → topConsumed / stockReference     │
│    └─ enrichCategories(menu_items lookup)                   │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│  Supabase (service role, owner context)                     │
│    table_sessions | orders | bill_splits | menu_items       │
└─────────────────────────────────────────────────────────────┘
```

**分层原则**：

- `route.ts`：HTTP、参数、状态码、JSON 序列化。
- `AnalyticsService`：可单测的纯聚合逻辑（输入 rows → 输出 DTO）。
- `analytics.repository.ts`（可选薄层）：Supabase 查询封装，便于 mock。

---

## 3. 领域模型与口径算法

### 3.1 时间窗口

复用异常操作模块已验证的 Lisbon 日历工具（从 `abnormal-operations/owner-query.ts` **抽取或 re-export** 到 `lib/analytics/date-window.ts`，避免复制 `lisbonDayStartUtcIso`）：

```ts
type AnalyticsRange = '7d' | '30d';

type DateWindow = {
  range: AnalyticsRange;
  today: string;           // YYYY-MM-DD Lisbon
  startDate: string;       // inclusive
  endDate: string;         // inclusive (= today)
  startUtc: string;        // closed_at >=
  endExclusiveUtc: string; // closed_at <
  dateKeys: string[];      // 连续自然日，升序
};
```

**解析规则**：

| `range` | `startDate` |
|---------|-------------|
| `7d` | `addCalendarDays(today, -6)` |
| `30d` | `addCalendarDays(today, -29)` |

`dateKeys`：从 `startDate` 到 `endDate` 逐日 `addCalendarDays` 生成，用于趋势图补零。

**DB 过滤**（`table_sessions`）：

```sql
restaurant_id = :restaurantId
AND status = 'closed'
AND closed_at IS NOT NULL
AND closed_at >= :startUtc
AND closed_at < :endExclusiveUtc
```

### 3.2 Qualifying Session（计入统计的餐次）

输入：窗口内 closed sessions + 其 orders + bill_splits。

```ts
function isQualifyingSession(
  session: { id: string; closed_at: string | null },
  orders: Order[],
  splits: BillSplit[],
): boolean {
  if (!session.closed_at) return false;

  const sessionOrders = orders.filter((o) => o.session_id === session.id);
  const sessionSplits = splits.filter((s) => s.session_id === session.id);

  // 路径 1：存在已付清的分账（正常结账主路径）
  const hasPaidSplit = sessionSplits.some((s) => s.status === 'paid');
  if (hasPaidSplit) return true;

  // 路径 2：无 bill_split 但订单仍有有效金额（边缘：历史/异常）
  const orderTotal = sessionOrders.reduce((sum, o) => sum + Number(o.total_amount) || 0, 0);
  if (orderTotal > 0.0001) return true;

  return false;
}
```

**排除语义**（与 `table-session-close.zh.md` 对齐）：

- 强制未收款关台 → 订单 void + `total_amount → 0` → `orderTotal ≈ 0` 且无 `paid` split → **排除**。
- 仅 `cancelled` split、从未 `paid` → **排除**。
- `open` / `billing` session → 不在 closed 查询范围内，天然排除。

> **与订单历史页差异**：`/dashboard/orders` 按「closed session」展示，**含**未收款关台。增值分析更严，仅 qualifying session。产品已知，不在 V1 统一。

### 3.3 营业额（Session Revenue）

对每个 qualifying session，计算 `sessionRevenue`：

```ts
function sessionRevenue(orders: Order[], splits: BillSplit[]): number {
  const paidSplits = splits.filter((s) => s.status === 'paid');
  if (paidSplits.length > 0) {
    let total = 0;
    for (const split of paidSplits) {
      const rows = (split.result || []) as SplitResult[];
      for (const row of rows) {
        if (row.paid === true) {
          total += Number(row.amount) || 0;
        }
      }
    }
    // 若 paid split 存在但 result 无 paid 标记（脏数据），回退 split.total_amount
    if (total <= 0) {
      total = paidSplits.reduce((s, sp) => s + (Number(sp.total_amount) || 0), 0);
    }
    return roundMoney(total);
  }
  // 回退：订单合计
  return roundMoney(
    orders.reduce((s, o) => s + (Number(o.total_amount) || 0), 0),
  );
}
```

`roundMoney`：与 `auditMoney` 一致，保留两位小数（`Math.round(n * 100) / 100`）。

**按日聚合**：

```ts
const bucket = sessionDateKey(session.closed_at); // Lisbon YYYY-MM-DD
dailyRevenue[bucket] = (dailyRevenue[bucket] || 0) + sessionRevenue;
```

输出 `revenueTrend`：遍历 `dateKeys`，`{ date, revenue: dailyRevenue[date] || 0 }`。

### 3.4 客流（Session Guest Count）

对每个 qualifying session：

```ts
import { aggregateBuffetForOrders } from '@/lib/buffet-order';

function sessionGuestCounts(orders: Order[]): { adults: number; children: number } {
  const agg = aggregateBuffetForOrders(orders);
  if (!agg) return { adults: 0, children: 0 };
  return { adults: agg.adults, children: agg.children };
}
```

- **不**对多订单 buffet 行求和；**只取最新有效 `buffet_base` 行**（与开台/加人逻辑一致）。
- 无 buffet 行（纯零点餐场景）：`customerCount = 0`（V1 不臆造人数）。

按日累加：

```ts
dailyAdults[bucket] += adults;
dailyChildren[bucket] += children;
```

输出：

```ts
{
  date,
  adultCount: dailyAdults[date] || 0,
  childCount: dailyChildren[date] || 0,
  customerCount: (dailyAdults[date] || 0) + (dailyChildren[date] || 0),
}
```

### 3.5 菜品消耗聚合

**可计入的订单行**：

```ts
function isCountableMenuLine(item: OrderItem, orderStatus: Order['status']): boolean {
  if (isBuffetBaseItem(item)) return false;
  const st = normalizeOrderItemStatus(item, orderStatus);
  if (st === 'voided') return false;
  const qty = Number(item.qty) || 0;
  if (qty <= 0) return false;
  return true;
}
```

**聚合 Map**（key = `item.id`）：

```ts
type ItemAgg = {
  itemId: string;
  namePt: string;
  nameEn?: string;
  nameZh?: string;
  consumedQuantity: number;
  amount: number;
};

// 对每个 qualifying session 的每个 qualifying order 的每个 countable line:
agg.consumedQuantity += qty;
agg.amount += price * qty;
// 名称取订单快照（首次写入或保留最早非空）
```

**Top 排序**：

```ts
items.sort((a, b) =>
  b.consumedQuantity - a.consumedQuantity
  || b.amount - a.amount
  || a.itemId.localeCompare(b.itemId)
);
const top10 = items.slice(0, 10);
```

**分类 enrichment**（批量一次查询）：

```ts
admin.from('menu_items')
  .select('id, category, category_zh, category_en')
  .eq('restaurant_id', restaurantId)
  .in('id', itemIds);
```

`categoryName` 解析（服务端按 `Accept-Language` 或 query `lang` **不推荐**；V1 **返回三语字段**，前端按 `useLanguage()` 选）：

```ts
type TopItemDto = {
  rank: number;
  itemId: string;
  itemName: string;       // 前端展示用，API 不填；或填 namePt 默认
  namePt: string;
  nameEn?: string | null;
  nameZh?: string | null;
  categoryName: string;   // 前端根据 lang 从 category* 选
  categoryPt: string;
  categoryEn?: string | null;
  categoryZh?: string | null;
  consumedQuantity: number;
  amount: number;
};
```

已删除 `menu_items`：用订单行 `name_pt`；category 显示 `—`。

**备货 Top 5**：对 **固定 7d 窗口** 单独跑一遍 `aggregateMenuItems`，`slice(0, 5)`，字段映射为 `consumedQuantity7d` / `amount7d` / `tag: '备货参考'`。

当 `range=30d` 时，Service **内部并行逻辑**：

1. `window30` → trends + top10  
2. `window7` → stockReference only  

避免重复查库：可先取 30d sessions，7d 为子集过滤 `closed_at >= window7.startUtc`。

---

## 4. 后端详细设计

### 4.1 文件结构

```text
apps/web/src/lib/analytics/
  analytics.types.ts           # DTO、AnalyticsRange
  date-window.ts               # resolveDateWindow, sessionDateKey
  qualifying-session.ts        # isQualifyingSession, sessionRevenue, sessionGuestCounts
  aggregate-menu-items.ts      # aggregateMenuItems, rankTopItems
  analytics.repository.ts      # Supabase 查询
  analytics.service.ts         # getValueOverview(admin, restaurantId, range)
  analytics.service.test.ts
  load-owner-context.ts        # owner 鉴权（可薄包装 abnormal 模式）

apps/web/src/app/api/analytics/value-overview/route.ts
apps/web/src/app/dashboard/value-analytics/page.tsx
apps/web/src/components/dashboard/
  ValueAnalyticsPageClient.tsx
  ValueAnalyticsTrendChart.tsx   # 折线图
  ValueAnalyticsTopTable.tsx     # 通用 Top 表
```

### 4.2 Owner 鉴权

`load-owner-context.ts`：

```ts
export async function loadOwnerAnalyticsContext(): Promise<
  | { admin: SupabaseClient; restaurantId: string; userId: string }
  | { error: string; status: number; message?: string }
> {
  const access = await loadDashboardAccess();
  if (access.mode === 'unauthenticated') {
    return { error: 'unauthorized', status: 401 };
  }
  if (access.mode !== 'owner') {
    return {
      error: 'forbidden',
      status: 403,
      message: '当前账号无权访问增值分析。',
    };
  }
  // createAdminClient() ...
  return { admin, restaurantId: access.restaurant.id, userId: ownerActor.userId };
}
```

与 `loadOwnerAbnormalOperationsContext` 同构；V2 权限重构时替换为 `requirePermission('analytics.view')`。

### 4.3 API Route

```ts
// GET /api/analytics/value-overview?range=7d|30d

export async function GET(req: Request) {
  const ctx = await loadOwnerAnalyticsContext();
  if ('error' in ctx) {
    return NextResponse.json(
      { error: ctx.error, ...(ctx.message ? { message: ctx.message } : {}) },
      { status: ctx.status },
    );
  }

  const range = parseAnalyticsRange(new URL(req.url).searchParams.get('range'));
  if (!range) {
    return NextResponse.json({ error: 'invalid_range' }, { status: 400 });
  }

  const result = await getValueOverview(ctx.admin, ctx.restaurantId, range);
  if (!result.ok) {
    return NextResponse.json({ error: result.code, message: result.message }, { status: 500 });
  }

  return NextResponse.json(result.data);
}

function parseAnalyticsRange(raw: string | null): AnalyticsRange | null {
  if (!raw || raw === '7d') return '7d';
  if (raw === '30d') return '30d';
  return null;
}
```

**可选 V1.1**：轻量 rate limit（参照 `abnormalOperationsListRateLimitCheck`，每 owner 每分钟 30 次），非需求硬性要求，设计预留。

### 4.4 Repository 查询

**Step 1 — Sessions**

```ts
const { data: sessions } = await admin
  .from('table_sessions')
  .select('id, closed_at, status')
  .eq('restaurant_id', restaurantId)
  .eq('status', 'closed')
  .not('closed_at', 'is', null)
  .gte('closed_at', window.startUtc)
  .lt('closed_at', window.endExclusiveUtc);
```

**Step 2 — Orders**（按 session_id 批量，Supabase `in` 分批 ≤100 id）

```ts
.select('id, session_id, status, items, total_amount')
.in('session_id', sessionIds)
.eq('restaurant_id', restaurantId);
```

**Step 3 — Bill splits**

```ts
.select('id, session_id, status, result, total_amount')
.in('session_id', sessionIds)
.eq('restaurant_id', restaurantId);
```

**Step 4 — Menu items**（聚合后 dedupe itemIds）

仅 Top 列表涉及的 id，通常 ≤10，单次 `in` 即可。

### 4.5 Service 主流程伪代码

```ts
export async function getValueOverview(
  admin: SupabaseClient,
  restaurantId: string,
  range: AnalyticsRange,
): Promise<Result<ValueOverviewResponse>> {
  const window = resolveDateWindow(range);
  const window7 = resolveDateWindow('7d');

  const sessions30 = await repo.fetchClosedSessions(admin, restaurantId, window);
  const sessionIds = sessions30.map((s) => s.id);
  if (sessionIds.length === 0) {
    return ok(emptyOverview(window, window7));
  }

  const [orders, splits] = await Promise.all([
    repo.fetchOrdersBySessionIds(admin, restaurantId, sessionIds),
    repo.fetchBillSplitsBySessionIds(admin, restaurantId, sessionIds),
  ]);

  const ordersBySession = groupBy(orders, 'session_id');
  const splitsBySession = groupBy(splits, 'session_id');

  const qualifying = sessions30.filter((s) =>
    isQualifyingSession(s, ordersBySession.get(s.id) || [], splitsBySession.get(s.id) || []),
  );

  const revenueTrend = buildRevenueTrend(window.dateKeys, qualifying, ordersBySession, splitsBySession);
  const customerTrend = buildCustomerTrend(window.dateKeys, qualifying, ordersBySession);

  const sessionsForRange = qualifying.filter((s) => inWindow(s.closed_at!, window));
  const menuAggRange = aggregateMenuItems(sessionsForRange, ordersBySession);
  const topConsumedItems = await rankAndEnrich(admin, restaurantId, menuAggRange, 10);

  const sessions7 = qualifying.filter((s) => inWindow(s.closed_at!, window7));
  const menuAgg7 = aggregateMenuItems(sessions7, ordersBySession);
  const stockReferenceItems = await rankAndEnrichStock(admin, restaurantId, menuAgg7, 5);

  return ok({
    range,
    revenueTrend,
    customerTrend,
    topConsumedItems,
    stockReferenceItems,
    disclaimer: STOCK_DISCLAIMER_ZH,
  });
}
```

### 4.6 索引与迁移（V1 纳入）

**决策（2026-06-26）**：项目尚未投入生产，迁移成本低；`table_sessions` 按 `restaurant_id + closed_at` 范围查询是对 analytics 的主路径，**V1 直接加 partial index**，不等待 EXPLAIN 再决定。

```sql
-- supabase/migrations/YYYYMMDDHHMMSS_table_sessions_closed_at_analytics.sql
CREATE INDEX IF NOT EXISTS idx_table_sessions_restaurant_closed_at
  ON public.table_sessions (restaurant_id, closed_at DESC)
  WHERE status = 'closed';
```

实现时仍可对 Step 1 查询跑一次 `EXPLAIN ANALYZE` 留档，但不作为是否建索引的门禁。

同步更新 `docs/ai-schema.md` Indexes 段。

**不建** `orders(completed_at)` 索引（列不存在）。

### 4.7 性能预估

假设单店 30 天 ≤ 500 sessions、每 session ≤ 5 orders、items JSON ≤ 50 行：

| 阶段 | 量级 |
|------|------|
| sessions 行 | ≤ 500 |
| orders 行 | ≤ 2,500 |
| bill_splits 行 | ≤ 500 |
| 内存聚合 | O(orders × items) ≈ 125k 行遍历，Node < 50ms |

接口目标 P95 < 2s（Vercel serverless）。热路径依赖 overview 日缓存降低重复冷算；若**冷启动**仍超标：先加索引；再考虑物化日事实（V2），**不在本轮把写路径耦进关台**。

---

## 5. 前端详细设计

### 5.1 路由与布局

**`page.tsx`**（Server Component）：

```tsx
export default async function ValueAnalyticsPage() {
  const access = await loadDashboardAccess();
  if (access.mode === 'unauthenticated') redirect('/auth/login');
  if (access.mode !== 'owner') notFound();
  return <ValueAnalyticsPageClient />;
}
```

纳入 `dashboard-paths.ts`：

```ts
export function isOwnerOperationalPath(pathname: string): boolean {
  return (
    pathname === '/dashboard/abnormal-operations' ||
    pathname.startsWith('/dashboard/abnormal-operations/') ||
    pathname === '/dashboard/value-analytics' ||
    pathname.startsWith('/dashboard/value-analytics/')
  );
}
```

**`DashboardNav.tsx`** — `ownerNavItems` 追加：

```ts
{ href: '/dashboard/value-analytics', key: 'valueAnalytics', icon: '📈', exact: false }
```

### 5.2 页面状态机

```text
                    mount / range change
                           │
                           ▼
                      ┌─────────┐
                      │ loading │
                      └────┬────┘
           ┌───────────────┼───────────────┐
           ▼               ▼               ▼
      ┌─────────┐    ┌──────────┐   ┌─────────────┐
      │  error  │    │ forbidden│   │   success   │
      └─────────┘    └──────────┘   └──────┬──────┘
                                           │
                              ┌────────────┴────────────┐
                              ▼                         ▼
                        ┌──────────┐              ┌───────────┐
                        │  empty   │              │  content  │
                        └──────────┘              └───────────┘
```

```ts
function isEmpty(data: ValueOverviewResponse): boolean {
  const trendHasValue = data.revenueTrend.some((d) => d.revenue > 0)
    || data.customerTrend.some((d) => d.customerCount > 0);
  const topsEmpty = data.topConsumedItems.length === 0
    && data.stockReferenceItems.length === 0;
  return !trendHasValue && topsEmpty;
}
```

| 状态 | UI |
|------|-----|
| loading | 整页 skeleton 或各 section 占位 |
| error | 居中提示 + 「重试」按钮 |
| forbidden | 全文案 `当前账号无权访问增值分析。` |
| empty | 文案 `当前时间范围暂无增值分析数据` |
| success | 四模块正常渲染 |

### 5.3 数据获取

```ts
const [range, setRange] = useState<AnalyticsRange>('7d');
const [state, setState] = useState<FetchState>('loading');

useEffect(() => {
  let cancelled = false;
  setState('loading');
  fetch(`/api/analytics/value-overview?range=${range}`)
    .then(async (res) => {
      if (res.status === 403) { setState('forbidden'); return; }
      if (!res.ok) { setState('error'); return; }
      const data = await res.json();
      if (cancelled) return;
      setData(data);
      setState(isEmpty(data) ? 'empty' : 'success');
    })
    .catch(() => { if (!cancelled) setState('error'); });
  return () => { cancelled = true; };
}, [range]);
```

切换 range 时 **不** 使用 router query（V1 保持 URL 稳定）；可选 V1.1 同步 `?range=` 便于分享。

### 5.4 时间范围切换

两个 `Button` 或 segmented control，样式对齐 dashboard 现有 `Button` / tab：

```tsx
<div className="flex gap-2">
  <Button variant={range === '7d' ? 'primary' : 'secondary'} onClick={() => setRange('7d')}>
    {t.range7d}
  </Button>
  <Button variant={range === '30d' ? 'primary' : 'secondary'} onClick={() => setRange('30d')}>
    {t.range30d}
  </Button>
</div>
```

### 5.5 折线图组件

**方案对比**：

| 方案 | 优点 | 缺点 |
|------|------|------|
| **A. recharts** | tooltip/响应式/无障碍成熟 | 需新增 npm 依赖（须批准） |
| **B. 轻量 SVG 自绘** | 零依赖、包体小 | tooltip/轴标签需手写 |

**推荐方案 A（recharts）**，理由：2 张图 + tooltip（客流要展示成人/儿童），自绘维护成本高于一个稳定依赖。

```tsx
// ValueAnalyticsTrendChart.tsx
<ResponsiveContainer width="100%" height={240}>
  <LineChart data={points}>
    <CartesianGrid strokeDasharray="3 3" className="stroke-brand-border" />
    <XAxis dataKey="dateLabel" tick={{ fontSize: 12 }} />
    <YAxis tick={{ fontSize: 12 }} />
    <Tooltip content={<CustomTooltip />} />
    <Line type="monotone" dataKey={yKey} stroke="rgb(var(--color-brand-gold))" dot={false} />
  </LineChart>
</ResponsiveContainer>
```

- X 轴：`date` → 格式化为 `MM/dd`（`date-fns` + locale）。
- Y 轴营业额：`€` 前缀或 tooltip 内 `€{v.toFixed(2)}`。
- 客流 tooltip 自定义：

```tsx
// 展示：总人数 / 成人 / 儿童
{t.customerCount} ({t.adults}: {adultCount}, {t.children}: {childCount})
```

**动态 import**（可选）：`next/dynamic` 加载 recharts，减小首屏 JS。

### 5.6 Top 表格

`ValueAnalyticsTopTable` 通用 props：

```ts
type Column<T> = { key: keyof T; header: string; render?: (row: T) => ReactNode };

// 高消耗：排名 | 菜品 | 分类 | 数量 | 金额
// 备货：排名 | 菜品 | 分类 | 最近7天消耗 | 标签
```

样式复用 `OrdersHistoryManager` 的 card + table 模式：

```tsx
<div className="bg-brand-card border border-brand-border rounded-xl overflow-hidden">
  <table className="w-full text-sm">...</table>
</div>
```

备货模块底部：

```tsx
<p className="text-[13px] text-brand-text-muted mt-2">{t.stockDisclaimer}</p>
```

### 5.7 i18n 结构

```ts
// messages.ts
valueAnalytics: {
  title: '增值分析',
  subtitle: '查看近期营业趋势与菜品消耗参考',
  range7d: '最近 7 天',
  range30d: '最近 30 天',
  revenueTrend: '营业额趋势',
  customerTrend: '客流趋势',
  topConsumed: '高消耗菜品 Top 10',
  stockReference: '备货参考 Top 5',
  colRank: '排名',
  colItem: '菜品名称',
  colCategory: '分类',
  colQuantity: '消耗数量',
  colAmount: '销售金额',
  colQuantity7d: '最近 7 天消耗',
  colTag: '标签',
  tagStock: '备货参考',
  stockDisclaimer: '备货参考仅根据最近 7 天订单消耗生成，不等同于实际库存建议。',
  empty: '当前时间范围暂无增值分析数据',
  error: '增值分析数据加载失败，请稍后重试',
  forbidden: '当前账号无权访问增值分析。',
  retry: '重试',
  revenueAxis: '营业额 (€)',
  customerAxis: '人数',
  tooltipAdults: '成人',
  tooltipChildren: '儿童',
  tooltipTotal: '总客流',
}
```

`itemName` / `categoryName` 前端解析：

```ts
function localizedItemName(row: TopItemDto, lang: UILanguage): string {
  if (lang === 'zh' && row.nameZh) return row.nameZh;
  if (lang === 'en' && row.nameEn) return row.nameEn;
  return row.namePt;
}
```

---

## 6. 安全设计

| 层 | 行为 |
|----|------|
| Middleware | 非 owner 访问 `/dashboard/value-analytics` → redirect settings 或 404（与 abnormal-ops 一致，读现有 middleware 分支） |
| Page | `mode !== 'owner'` → `notFound()` |
| API | `loadOwnerAnalyticsContext` → 403 + message |
| 数据 | `restaurant_id` 仅来自 owner 的 restaurant；**忽略**任何 query/body 中的 tenant |
| RLS | 使用 `createAdminClient()` service role（与 abnormal-ops / staff dashboard 一致）；不暴露 service key 到客户端 |

**不记录** PII；日志仅 `restaurantId`、`range`、耗时、session 数量。

---

## 7. 边界场景处理

| 场景 | 处理 |
|------|------|
| 合并/转台后关台 | 金额/人头归属 **最终 session** 的 `closed_at` 日 |
| 一单多 `paid` bill_split（异常重复） | `sessionRevenue` 对所有 paid split 的 paid rows 求和；单测覆盖 |
| 折扣后实收 | 已含在 `result[].amount`（confirm payment 写入） |
| 纯饮料无 buffet | 客流为 0；菜品 Top 仍正常 |
| session 无 `closed_at` | 查询已过滤；防御性 skip |
| 凌晨 00:30 关台 | `closed_at` UTC → Lisbon 日切 |
| `items` JSON 缺 `kind` | 视为 `menu`（`OrderItem` 缺省规则） |
| 同名不同 id 菜品 | 按 `item.id` 分开统计 |
| 超大 JSON items | 与现网订单一致；V1 不做截断 |

---

## 8. 测试设计

### 8.1 单元测试（`analytics.service.test.ts`）

纯函数夹具，不连 DB：

| 用例 | 断言 |
|------|------|
| `resolveDateWindow('7d')` | 7 个 dateKeys，末日为 today |
| `isQualifyingSession` unpaid close | `total_amount=0`、无 paid split → false |
| `isQualifyingSession` paid | paid split + rows → true |
| `sessionRevenue` 折扣 | paid rows amount 之和 |
| `sessionRevenue` 回退 | 无 split，orders total |
| `sessionGuestCounts` 加人 void | 仅最新 buffet_base |
| `aggregateMenuItems` | 排除 buffet_base、voided |
| `rankTopItems` | 排序、并列、top N 截断 |
| `buildRevenueTrend` | 无数据日补 0 |
| stock 7d vs range 30d | 备货只含 7d session |

### 8.2 集成测试

V1 **不强制** E2E；可选在 stage 人工抽样对比收银记录。

### 8.3 发布检查

```bash
npm run lint
npm run build
node --import tsx --test apps/web/src/lib/analytics/analytics.service.test.ts
```

---

## 9. 改动清单（实现时）

| 文件 | 操作 |
|------|------|
| `docs/value-analytics-v1.zh.md` | 已存在 |
| `docs/value-analytics-design.zh.md` | 本文档 |
| `docs/ai-schema.md` | 若加索引则更新 |
| `supabase/migrations/..._table_sessions_closed_at_analytics.sql` | 按需 |
| `apps/web/package.json` | 若采用 recharts |
| `lib/analytics/*` | 新增 |
| `app/api/analytics/value-overview/route.ts` | 新增 |
| `app/dashboard/value-analytics/page.tsx` | 新增 |
| `components/dashboard/ValueAnalytics*.tsx` | 新增 |
| `lib/dashboard-paths.ts` | 修改 |
| `components/dashboard/DashboardNav.tsx` | 修改 |
| `lib/i18n/messages.ts` | 修改 |

**不改动**：`orders/page.tsx`、`dashboard/page.tsx`、`abnormal-operations/*` 业务逻辑。

---

## 10. 评审待决项

| # | 项 | 建议 | 影响 |
|---|-----|------|------|
| 1 | recharts 依赖 | 批准安装 | 前端实现方式 |
| 2 | 索引迁移 | **V1 纳入**（`idx_table_sessions_restaurant_closed_at`） | 已确认 |
| 3 | API rate limit | V1 可省略 | 防刷 |
| 4 | URL 同步 `?range=` | V1 可省略 | 分享深链 |

---

## 11. 总结

增值分析 V1 以 **`table_sessions.closed_at` + qualifying 过滤** 为统计主轴，营业额走 **bill_splits 实收**，客流走 **`aggregateBuffetForOrders`**，菜品走 **JSONB 内存聚合 + menu_items 补分类**。前后端通过 **单一聚合 API** 通信，权限与异常操作页同级别的 **owner 三板斧**。实现时优先落地 **可单测的纯函数层**，再接 Supabase repository 与 recharts 展示。
