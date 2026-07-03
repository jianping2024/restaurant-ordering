# 技术架构

> **状态**：阶段 5 已填充（2026-06-30）  
> **读者**：开发、AI 代理

## 用途

描述当前技术栈、目录结构、模块分布、状态管理与数据流。本文档记录现状，**不包含重构实施**。

---

## 1. 当前技术栈

| 层 | 技术 |
|----|------|
| 租户 Web | Next.js 14 App Router、React 18、TypeScript strict、Tailwind CSS |
| 运营 Web | Next.js 14（`apps/ops`，独立 Vercel 项目） |
| 数据与身份 | Supabase：Postgres、Auth、RLS、Realtime、Storage |
| 打印代理 | Go 1.22（Windows 桌面，`apps/print-agent`） |
| 部署 | Vercel（web + ops）；print-agent 经 GitHub Release |
| 包管理 | npm workspaces（根 `package-lock.json`） |
| CI | GitHub Actions（lint/build、print-agent test/release）；Vercel Preview 为 merge 门禁 |

---

## 2. 当前目录结构

```text
restaurant-ordering/
├── apps/
│   ├── web/                 @mesa/web — 租户产品
│   │   └── src/
│   │       ├── app/           页面 + Route Handlers（58 个 API）
│   │       ├── components/    UI（dashboard / menu / waiter / kitchen / ui）
│   │       ├── lib/           业务逻辑（~289 TS 文件）
│   │       └── types/         全局类型 index.ts
│   ├── ops/                   @mesa/ops — 平台运营
│   └── print-agent/           Go 代理（107+ .go）
├── packages/
│   ├── shared/                @mesa/shared — web/ops 共用 server 逻辑
│   └── ui/                    @mesa/ui — PasswordInput 等
├── supabase/
│   ├── migrations/            有序 SQL 迁移
│   └── seed.sql
├── scripts/                   dev-env、push、vercel-ignore、print-agent
└── docs/                      产品 / 设计 / 技术 / 专题
```

**环境文件**：`.env.local.dev`、`.env.local.supabase`、`.env.local` 放仓库根；`scripts/dev-env.sh` 注入后启动对应 app。

---

## 3. 当前业务模块分布

### 3.1 `apps/web` — 按路由

| 路由前缀 | 用途 |
|----------|------|
| `/` | 落地页 |
| `/auth/*` | 店主/员工注册登录 |
| `/dashboard/*` | 店主/前台/收银员后台 |
| `/[slug]/menu`、`/bill` | 顾客扫码 |
| `/[slug]/kitchen`、`/waiter` | 员工现场 |
| `/demo/*` | 无后端演示 |
| `/api/*` | HTTP API（见 [`03-api-contracts.md`](./03-api-contracts.md)） |

### 3.2 `apps/web/src/lib` — 按领域（部分已子目录化）

| 目录 / 文件群 | 职责 |
|---------------|------|
| `analytics/` | 经营分析聚合 |
| `audit/`、`abnormal-operations/` | 操作审计与异常队列 |
| `checkout-*`、`checkout-discount/` | 结账、折扣、恢复点餐 |
| `bill-split-*` | 分单算法与校验 |
| `buffet-*` | 自助餐开台与计价 |
| `order-item-void/` | 退菜/减数量 |
| `table-session/` | 关台等服务 |
| `order-receipt-enqueue.ts`、`station-ticket-enqueue.ts` | 打印入队 |
| `print-agent-*` | 配对、JWT、路由、设备 |
| `dashboard-*` | Dashboard 数据加载 |
| `staff-*`、`customer-*` | 员工/顾客上下文 |
| `supabase/` | client / server / admin / middleware |

**巨型模块（风险集中）**：`dashboard-menu-server.ts`、`bill-split-by-item.ts`、`MenuManager.tsx`、`BillPage.tsx`、`CheckoutRequestsManager.tsx`。

### 3.3 `packages/shared`

JWT（print-agent、support）、餐厅功能开关、代建餐厅、国家码、吊销、心跳、平台审计等 **跨 web/ops** 的纯函数。

### 3.4 `apps/ops`

餐厅 CRUD、暂停/恢复、员工代管、打印设备/配对运维、平台管理员、审计导出。API 前缀 `/api/ops/*`。

### 3.5 `apps/print-agent`

轮询 `print_jobs`、ESC/POS（TCP + WinSpool）、配对向导、托盘 UI、路由同步、心跳回写。

---

## 4. 当前状态管理方式

| 场景 | 方式 |
|------|------|
| 页面局部 UI | React `useState` / `useMemo` / `useCallback` |
| 语言 / 主题 | `LanguageProvider`、`ThemeProvider`（client） |
| Dashboard 首屏 | Server Components + `loadDashboardAccess()` 等 server loader |
| 服务员/厨房/结账实时 | `useRestaurantRealtimeRefresh` 订阅 Supabase `postgres_changes`（`orders`、`table_sessions`、`bill_splits` 等） |
| 结账队列角标 | Realtime + `useCheckoutRequestCount` |
| 权威业务状态 | **Postgres**（会话、订单、分单）；非前端全局 store |
| 结账写操作 | **SECURITY DEFINER RPC**（`confirm_bill_split_payment` 等）保证原子性 |

**无** Redux/Zustand；复杂表单状态留在巨型组件内（技术债）。

---

## 5. 当前数据流

### 5.1 顾客点餐

```text
Browser /[slug]/menu
  → GET /api/restaurants/[slug]/customer/session
  → POST .../orders/append（admin client + 地理围栏 + guestOrderingEnabled）
  → orders 写入 → station_ticket 入队 print_jobs
  → Realtime → 厨房/服务员刷新
```

### 5.2 结账

```text
Browser /[slug]/bill
  → POST .../checkout/request → RPC upsert_bill_split_request
  → session billing + bill_splits requested
  → Dashboard Realtime → CheckoutRequestsManager
  → POST .../confirm-payment → RPC confirm_bill_split_payment
  → session_collected_payments + 可选 order_receipt 入队
```

### 5.3 Dashboard 店主

```text
middleware（角色路由）→ RSC 页面 load* server 函数
  → 多数写操作：Route Handler → lib service → admin client 或 RPC
  → 部分读：owner 会话 + RLS 的 createClient()
```

### 5.4 员工（厨房/服务员）

```text
/[slug]/staff/login → Supabase Auth
  → staff API：staffAuthFromRequest（staff 表 + slug 校验）
  → 写订单/void：admin client + 审计
```

### 5.5 打印代理

```text
Dashboard 生成配对码 → 代理 POST /api/print-agent/pairing + claim
  → 获 scoped JWT → GET pending-jobs → 本地打印 → PATCH jobs/[id]
  → heartbeat → print_agent_devices 元数据
```

### 5.6 鉴权分层

| 调用方 | 典型鉴权 |
|--------|----------|
| 店主 Dashboard | Supabase session + `owner_id` / `loadDashboardAccess` |
| 员工 API | Auth session + `restaurant_staff_accounts` + slug |
| 顾客 API | slug + table_id 上下文（无登录） |
| print-agent | Bearer JWT（`verifyPrintAgentJwt`） |
| Cron | `CRON_SECRET` header |
| Ops | `platform_admin_accounts` + 独立 cookie 会话 |

---

## 6. 当前架构问题

| # | 问题 | 影响 |
|---|------|------|
| 1 | API 命名空间三套（`dashboard` / `restaurants/[slug]` / `print-agent`） | 定位成本高 |
| 2 | `lib/` 扁平文件与深子目录混用 | 边界不清 |
| 3 | 巨型 UI 组件承载业务与 fetch | 难测、难改 |
| 4 | 类型集中在 `types/index.ts` + 字面量重复 | 易不一致 |
| 5 | Web / shared / Go 打印三处同步 | 变更遗漏 |
| 6 | 部分 route 厚、部分薄封装 | 风格不统一 |
| 7 | 测试覆盖偏 lib，UI 几乎无组件测试 | 回归靠手工 |

---

## 7. 建议目标结构

**不立即实施**。分任务、顺序、边界与回滚见 [`06-refactoring-plan.md`](./06-refactoring-plan.md)。方向如下：

```text
lib/
  <domain>/
    *.repository.ts    # Supabase 查询
    *.service.ts       # 业务规则（可单测）
    *.types.ts         # 领域类型
app/api/...            # 薄 Controller（解析 HTTP → service）
components/            # 展示 + 局部 state，不直接 admin 查询
types/                 # 仅 re-export 或跨域基础类型
constants/             # 状态枚举单点出口
```

优先级（与 [`../product/04-business-rules.md`](../product/04-business-rules.md) 一致）：先常量/类型整理 → 设置与空状态 → 菜品管理 UI 拆分 → **最后**动结账/会话/打印核心。

---

## 相关文档

- [`06-refactoring-plan.md`](./06-refactoring-plan.md)
- [`02-data-model.md`](./02-data-model.md)
- [`03-api-contracts.md`](./03-api-contracts.md)
- [`../monorepo-vercel.zh.md`](../monorepo-vercel.zh.md)
- [`../ai-schema.md`](../ai-schema.md)
