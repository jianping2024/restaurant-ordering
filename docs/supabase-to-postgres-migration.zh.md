# Supabase → 纯 PostgreSQL 迁移方案

> 状态：**已确认决策** — 全平台统一迁移（SaaS 云 + Windows 私有化）  
> 日期：2026-06-25  
> 关联：[`local-on-premise-deployment-plan.md`](./local-on-premise-deployment-plan.md)、[`development-backlog.zh.md`](./development-backlog.zh.md)、[`ai-schema.md`](./ai-schema.md)

## 1. 结论与目标

**可以**把 Mesa 从「Supabase 平台（Auth + PostgREST + Realtime + Storage + RLS 集成）」迁到「**纯 PostgreSQL + 自研应用层**」，但这不是「换连接串」级别的工作，而是**平台替换**。

### 1.0 已确认决策（2026-06-25）

**SaaS 云端与 Windows 私有化一起切**，不保留「云端继续 Supabase、仅本机 Postgres」的双轨方案。

| 环境 | 迁移后 |
|------|--------|
| **生产 / 预发 SaaS**（Vercel） | 托管 PostgreSQL（Neon / RDS 等）+ Mesa API；**停用** Supabase Auth / Realtime / Storage |
| **本地开发** | `docker compose` Postgres；不再 `supabase start` |
| **Windows 客户机** | 本机 Postgres + Next.js 生产构建；见 §1.4 |

**原则**：一套代码、一套数据访问层、一套环境变量形状；仅 `DATABASE_URL` 与文件存储根路径因环境不同而变。

### 1.1 为什么要做

| 动机 | 说明 |
|------|------|
| Windows 本地私有化 | 客户机只跑 Postgres + Web，不必维护整套 Supabase 自托管栈（Kong、GoTrue、Realtime、Storage API 等） |
| 依赖收敛 | 减少 Supabase CLI、anon/service key、JWT 签发链、Realtime publication 等平台概念 |
| 运维简化 | 备份/恢复只需 `pg_dump` / PITR；升级路径以 Postgres 大版本为主 |
| 成本与可控性 | 云场景可自建 RDS/Neon；不再绑定 Supabase 定价与配额 |

### 1.2 明确保留什么

- **PostgreSQL 本身**：表、约束、触发器、函数（RPC）、视图、索引——这些是业务核心，**继续留在 Postgres**。
- **租户隔离语义**：`restaurant_id` 过滤、结账原子性、打印任务状态机——**行为不变**，实现从「RLS + anon key」迁到「服务端鉴权 + SQL」。

### 1.3 明确替换什么

| Supabase 能力 | 当前用法（本项目） | 替换方向 |
|---------------|-------------------|----------|
| **Auth** (`auth.users`) | 店主/员工/平台 ops 登录、session cookie、`auth.uid()` | 自建 `users` 表 + 密码哈希 + HTTP-only session（或 signed JWT） |
| **PostgREST** | 浏览器/服务端大量 `supabase.from(...).select/insert/update` | **统一走 Next.js API** + `pg` / Drizzle / Kysely 等服务端查询层 |
| **Realtime** | 厨房/服务员/结账/自助餐价的 `postgres_changes` 订阅 | **SSE 或 WebSocket** 推送（服务端监听 `LISTEN/NOTIFY` 或轮询变更表） |
| **Storage** | `menu-images` 桶上传/删除 | 本地目录 / MinIO / S3 兼容存储 + `/api/uploads` |
| **RLS + anon key** | 客户端直连库、策略依赖 `auth.uid()` | **取消浏览器直连库**；权限在 API 层校验；DB 层可选保留 RLS 作纵深防御 |
| **Supabase CLI 迁移** | `supabase/migrations`、`supabase db push` | `node-pg-migrate` / `flyway` / `golang-migrate` 等，迁移文件迁入 `db/migrations/` |

### 1.4 与现有「本地私有化方案」的关系

[`local-on-premise-deployment-plan.md`](./local-on-premise-deployment-plan.md) 当前假设 **自托管完整 Supabase 栈**。若采用本文方案，客户 Windows 发行栈可简化为：

```text
Caddy → Next.js (生产构建)
          ↓
      PostgreSQL
          ↓
   打印代理（仍走 Mesa HTTP API，不直连库）
```

不再需要 Supabase Gateway、GoTrue、Realtime 服务、Storage API 容器。

---

## 2. 现状依赖盘点

### 2.1 代码触点（按风险排序）

| 区域 | 主要文件/模式 | 工作量 |
|------|---------------|--------|
| **客户端直连 DB** | `createClient()` + `.from()` 遍布 dashboard、kitchen、waiter、menu 组件 | 高 |
| **Auth 与会话** | `apps/web/src/lib/supabase/*`、`middleware.ts`、`*auth*` API、`@mesa/ops` 登录 | 高 |
| **Realtime** | `use-restaurant-realtime-refresh.ts`、`useCheckoutRequestedTableIds.ts`、`CheckoutRequestsManager.tsx` 等 | 中 |
| **Storage** | `MenuManager.tsx`、`menu-image.ts` | 低 |
| **RPC** | `confirm_bill_split_payment`、`close_table_session_operational`、`transfer_table_session` 等 | 低（函数可保留在 PG） |
| **Service role** | `createAdminClient()` 用于结账、员工开户、打印代理 | 中（改为 DB 超级连接或 app role） |
| **打印代理** | 已主要走 `apps/web` 的 `/api/print-agent/*`；配对响应含 `supabase_url` 字段（可废弃） | 低 |
| **顾客反馈** | `BillPage.tsx` 直连 `feedback_sessions` / `dish_feedback` upsert | 低（改 API） |
| **Server Components** | 15+ `app/**/page.tsx` 在 RSC 内 `createClient()` 查库 | 高（并入阶段 2） |
| **@mesa/shared** | 6 个模块入参为 `SupabaseClient`（开户、吊销、审计等） | 中 |
| **Auth Admin API** | `createUser` / `deleteUser` / `signOut(global)` / `ban` / `listUsers` | 中（见 §10.3） |
| **OAuth 回调** | `/auth/callback` + `exchangeCodeForSession` | 低（若仅密码登录可删） |

### 2.2 数据库层 Supabase 特有项

| 项 | 说明 | 迁移处理 |
|----|------|----------|
| `auth.users` | 多处 FK：`restaurants.owner_id`、`restaurant_staff_accounts.user_id` 等 | 新建 `app.users`，数据搬迁，改 FK |
| `auth.uid()` / `auth.jwt()` | RLS 策略与 helper 函数 | 改 RLS 为 `current_setting('app.user_id')` **或** 去掉客户端路径的 RLS |
| `storage.objects` + bucket 策略 | 菜单图 | 删 bucket 策略；文件迁到新存储 |
| `supabase_realtime` publication | `orders`、`table_sessions`、`bill_splits`、`print_jobs`、buffet 表 | 删除 publication；用 NOTIFY 或应用层事件 |
| `REPLICA IDENTITY FULL` | Realtime 过滤订阅需要 | 可保留或按需降级 |
| `restaurants_public` 等视图 | 公开菜单查询 | 保留视图，改授权方式 |
| **`GRANT ... TO authenticated`** | Supabase 内置角色 `authenticated` / `anon` / `service_role` | 改为 `mesa_app` 等自建角色，或 RPC 仅 `SECURITY DEFINER` + API 调用 |
| **`extensions` schema** | `pgcrypto`、`uuid-ossp` 装在 `extensions` | 纯 Postgres 可装 `public` 或保留 `extensions`；baseline 需显式 `CREATE EXTENSION` |

完整表/策略清单见 [`ai-schema.md`](./ai-schema.md)。

### 2.3 必须保持的行为（迁移验收标准）

- 多租户：任意查询不得跨 `restaurant_id` 泄漏。
- 顾客下单：匿名可下单（现有 `orders` INSERT 为 public）；仍需速率限制与校验。
- 结账/分账/关台：RPC 原子性与 advisory lock 行为不变。
- 厨房/服务员/收银实时刷新：延迟可略增，但功能等价。
- 打印代理：配对、拉单、心跳、吊销逻辑不变（本就经 Mesa API）。
- 平台 ops：跨租户审计、suspend/resume 不变。

---

## 3. 目标架构

```text
┌─────────────────────────────────────────────────────────┐
│  Browser（顾客 / 员工 / 店主）                           │
│  - 不再持有 DB key                                       │
│  - Cookie session 或短期 access token                    │
│  - EventSource / WebSocket 收实时事件                      │
└───────────────────────────┬─────────────────────────────┘
                            │ HTTPS
┌───────────────────────────▼─────────────────────────────┐
│  apps/web + apps/ops（Next.js）                          │
│  ├─ /api/auth/*          登录/登出/改密                   │
│  ├─ /api/restaurants/*   顾客与员工业务                   │
│  ├─ /api/dashboard/*     店主后台                         │
│  ├─ /api/print-agent/*   打印代理（已有）                 │
│  ├─ /api/realtime/*      SSE 订阅（新增）                 │
│  └─ /api/files/*         菜单图上传/读取（新增）           │
│                                                          │
│  lib/db/                 单一服务端 DB 访问层（新增）      │
└───────────────────────────┬─────────────────────────────┘
                            │ SQL（连接池）
┌───────────────────────────▼─────────────────────────────┐
│  PostgreSQL 16+                                          │
│  - public 业务 schema                                     │
│  - app 用户 schema（或 public.users）                     │
│  - 保留 RPC、触发器、约束                                  │
│  - 可选：RLS 仅对 app_db 角色 + SET LOCAL app.user_id     │
└─────────────────────────────────────────────────────────┘
```

### 3.1 推荐技术选型（不引入过多新依赖）

| 层次 | 建议 | 备注 |
|------|------|------|
| DB 驱动 | `pg` + 连接池（`pg-pool`） | 与 Node 20 兼容好 |
| 查询 | 先 **轻量 SQL 模板**；体量大后再考虑 Drizzle/Kysely | 避免迁移期同时改 ORM |
| Auth | `bcrypt` 或 `argon2` + `iron-session` / 加密 cookie | 员工强制改密逻辑保留 |
| Realtime | **SSE**（`ReadableStream`）+ `pg_notify` | 比自建 WS 集群简单；私有化单机足够 |
| 文件 | 开发：本地 `data/uploads/`；生产：MinIO 或磁盘卷 | URL 形如 `/api/files/menu-images/{restaurant_id}/{id}.webp` |
| 迁移工具 | `node-pg-migrate` 或继续 SQL 文件 + 自定义 runner | 从 `supabase/migrations` 导出 baseline |

---

## 4. 分阶段实施步骤

> 建议开长期分支 `feat/postgres-only` 实施；**全平台验收通过后一次性合 `main` 并切生产**（见 §8）。迁移期间尽量减少与 schema 无关的并行改动。

### 阶段 0：准备与基线冻结（约 2–3 天）

1. **冻结 schema 变更窗口**：减少迁移期间双写冲突。
2. **导出当前 schema 快照**：
   ```bash
   supabase db dump --schema public,auth,storage -f db/baseline/pre-supabase-drop.sql
   ```
3. **建立依赖清单脚本**（一次性）：
   - 统计 `@supabase/*` import 数量
   - 列出所有 `.rpc(`、`.channel(`、`.storage.` 调用点
4. **确定环境变量新形状**：
   ```env
   DATABASE_URL=postgres://mesa:...@localhost:5432/mesa
   SESSION_SECRET=...
   FILE_STORAGE_ROOT=./data/uploads   # 或 S3_* 
   # 删除 NEXT_PUBLIC_SUPABASE_*、SUPABASE_SERVICE_ROLE_KEY
   ```

**验收**：CI 仍对 `main` 绿；新分支可本地起纯 Postgres（Docker `postgres:16`）。

---

### 阶段 1：数据库 schema 脱钩（约 1 周）

#### 1.1 新建用户表（替代 `auth.users`）

```sql
-- 示例结构，实施时以 migration 为准
CREATE TABLE app_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  user_metadata jsonb NOT NULL DEFAULT '{}',
  email_confirmed_at timestamptz,
  disabled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

#### 1.2 外键迁移

按依赖顺序 ALTER FK（`restaurants.owner_id`、`restaurant_staff_accounts.user_id`、`platform_admin_accounts.user_id` 等）从 `auth.users` → `app_users`。

#### 1.3 搬迁用户数据

- 从 Supabase 导出 `auth.users`（含 `encrypted_password`、`raw_user_meta_data`）。
- 密码：Supabase 使用 bcrypt → **可直接复用 hash**（需验证 prefix `$2a$` 兼容），避免全员重置密码。
- `user_metadata` 映射到 `user_metadata` jsonb（员工 `must_change_password` 等）。

#### 1.4 替换 RLS helper

将 `auth.uid()` 改为：

```sql
CREATE OR REPLACE FUNCTION app_current_user_id() RETURNS uuid AS $$
  SELECT NULLIF(current_setting('app.user_id', true), '')::uuid;
$$ LANGUAGE sql STABLE;
```

在服务端每个请求事务开头：

```sql
SET LOCAL app.user_id = '<uuid>';
```

逐步把策略中的 `auth.uid()` 替换为 `app_current_user_id()`。

#### 1.5 移除 Supabase 专用对象

- `DROP PUBLICATION supabase_realtime;`
- 删除 `storage` schema 相关策略（在文件迁移完成后）
- 保留所有 **业务 RPC** 与触发器

#### 1.6 迁移工具链接入

- 新建 `db/migrations/`；首文件为 baseline（从现有 squashed migration 导出，去掉 auth/storage 专有部分）。
- 更新 `docs/ai-schema.md` 中 `auth.users` → `app_users` 描述。

**验收**：在空库上 `npm run db:migrate` 可建完整 schema；单元测试覆盖 RPC。

---

### 阶段 2：服务端 DB 访问层（约 1.5–2 周）

#### 2.1 新增 `apps/web/src/lib/db/`

```
lib/db/
  pool.ts          # 单例连接池
  withUser.ts      # SET LOCAL app.user_id 包装
  queries/         # 按域拆分：orders.ts, sessions.ts, ...
```

#### 2.2 优先迁移「已有 API route」路径

这些已走 service role，改为 `DATABASE_URL` 直连即可：

- `/api/restaurants/[slug]/checkout/*`
- `/api/print-agent/*`
- `/api/dashboard/staff/*`
- `/api/cron/*`

#### 2.3 为客户端直连补 API

为当前 **浏览器内 `supabase.from()`** 的每个用例新增等价 route，例如：

| 现客户端查询 | 新 API（示例） |
|-------------|----------------|
| 厨房订单列表 | 已有 `/api/.../kitchen/board`，补齐 mutations |
| Dashboard 桌台 | 已有 `/api/dashboard/tables`，扩展 CRUD |
| 菜单管理 | 新增 `/api/dashboard/menu/*` |
| 顾客菜单只读 | 新增 `/api/public/[slug]/menu` |

**原则**：浏览器 **不再** 持有数据库凭证；只调 Mesa API。

#### 2.4 删除 `createClient()` 的业务用法

保留顺序：

1. `createAdminClient` → `db/admin.ts`
2. `createClient`（服务端）→ `db/withUser.ts`
3. 客户端组件 → `fetch('/api/...')` hooks

**验收**：`grep -r "@supabase/supabase-js" apps/web` 仅剩迁移兼容层或为零。

---

### 阶段 3：认证与会话（约 1 周）

#### 3.1 新登录流

| 角色 | 现路径 | 新实现 |
|------|--------|--------|
| 店主 | `/api/auth/login` | 查 `app_users` + bcrypt verify → 写 session cookie |
| 员工 | `/api/auth/staff/login` | 同上 + `restaurant_staff_accounts` 校验 |
| Ops | `apps/ops` `/api/ops/auth/login` | 独立 session cookie（同库不同 cookie 名） |

#### 3.2 Session 内容（建议）

```ts
type Session = {
  userId: string;
  email: string;
  // 可选缓存，仍以 DB 为准
  ownedRestaurantId?: string;
  staff?: { restaurantId: string; role: string; slug: string };
};
```

#### 3.3 中间件

- 替换 `apps/web/src/lib/supabase/middleware.ts` → `lib/auth/middleware.ts`
- 保护 `/dashboard/*`、`/[slug]/kitchen|waiter/*` 路由

#### 3.4 员工开户与改密

- `admin.auth.admin.createUser` → 直接 INSERT `app_users` + staff 行
- `signInWithPassword` / `updateUser` → 自研 verify + UPDATE `password_hash`
- 保留 `must_change_password` 元数据逻辑

#### 3.5 `@mesa/ops` 同步改造

- `apps/ops/src/lib/supabase/*` 同样替换
- 平台表仍 **仅 service 连接**访问，不暴露给租户 session

**验收**：完整登录/登出/改密/吊销 E2E；员工/店主/ops 角色隔离测试。

---

### 阶段 4：Realtime 替换（约 1 周）

#### 4.1 数据库侧

对关键表建触发器发送 NOTIFY：

```sql
CREATE OR REPLACE FUNCTION notify_table_change() RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify(
    'mesa_changes',
    json_build_object(
      'table', TG_TABLE_NAME,
      'restaurant_id', COALESCE(NEW.restaurant_id, OLD.restaurant_id),
      'op', TG_OP
    )::text
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;
```

在 `orders`、`table_sessions`、`bill_splits`、`print_jobs`、buffet 相关表上挂触发器。

#### 4.2 SaaS 实时策略（默认：轻量轮询）

**第一期 SaaS 推荐**：**轻量 `/poll` + 有变化再拉全量**（见 §4.4 成本模型）。**不默认上 Upstash**；店数上来或要秒级体验再考虑 Redis+SSE。

| 环境 | 策略 |
|------|------|
| **Vercel SaaS** | `GET /api/.../poll?since=cursor` 每 **3s**（`visibilityState === 'visible'`）；`changed` 时调现有 `fetchKitchenBoardClient` 等 |
| **Windows 私有化** | Postgres `NOTIFY` + SSE（长驻 Next，无需 Redis） |

**不推荐**在 SaaS 上对厨房板每 3s **无条件拉全量 JSON**（§4.4：百店规模下 CPU/流量会爆）。

**若上 Redis+SSE（二期）**：Serverless 无法长期 `LISTEN` Postgres；需 DB 变更 → 桥接 → Redis pub/sub → SSE。Vercel 上不强制 Upstash，但 Marketplace 接入最省事。

客户端：新建 `useRestaurantPollingRefresh` 替换 `useRestaurantRealtimeRefresh`；保留 debounce、`visibilitychange`、现有 `onRefresh` 回调。

#### 4.3 涉及组件（需逐个切换）

- `use-restaurant-realtime-refresh.ts`
- `use-buffet-prices-realtime-refresh.ts`
- `useCheckoutRequestedTableIds.ts`
- `CheckoutRequestsManager.tsx`
- `DashboardNav.tsx`（结账角标）

**验收**：厨房新单、服务员桌态、结账请求、导航角标在 **≤5s** 内刷新（3s 轮询 + 一次拉取）；多标签页不泄漏其他餐厅事件。

#### 4.4 SaaS 轮询：成本、规模与 Vercel Pro 承受能力

> **口径说明**（下文「店」= 活跃租户餐厅，不是扫码顾客人数）  
> - **轮询负担**主要来自：**营业中开着的前台员工 tab**（厨房屏、服务员 iPad、店主 Dashboard 结账角标等）。  
> - **顾客点餐**仍是「有单才打 API」，与轮询无关。  
> - **`@mesa/ops`** 流量极小，可忽略；以下按 **`@mesa/web` 单项目**估算。  
> - 定价以 **2026-06 Vercel Pro + Neon Launch** 公开价为准，[Vercel 定价](https://vercel.com/pricing)、[Neon 定价](https://neon.com/pricing)；实际账单以控制台为准。

##### 4.4.1 Vercel Pro 月费结构（与迁移相关部分）

| 项 | Pro 档位（要点） |
|----|------------------|
| **平台费** | **$20/月·席位**（含 1 个可部署 Owner/Member）；另赠 **$20 用量抵扣额度**（抵扣超额部分，非「额外送 $20 免费额度」的简单叠加，见 [Pro 文档](https://vercel.com/docs/plans/pro-plan)） |
| **Function 调用次数** | 约 **$0.60 / 100 万次**（$0.0000006/次） |
| **Active CPU** | 约 **$0.128 / 小时**（Fluid Compute，仅代码执行时间） |
| **流量 Fast Data Transfer** | **1 TB/月 含**；超出约 **$0.15/GB** |
| **Edge Requests** | **1000 万次/月 含**（静态资源 + 边缘路由；API 轮询主要算 Function，不算 Edge） |

Hobby 计划**不适用于商业 SaaS**（Vercel 要求 Pro+）。预发若用 Preview 部署，也会消耗同一团队的用量。

##### 4.4.2 负载模型（估算用）

**默认营业画像**（可按葡萄牙小餐馆调整）：

| 符号 | 含义 | 默认值 |
|------|------|--------|
| `T` | 每家店同时打开、在前台轮询的 tab 数 | **3**（厨房 1 + 服务员 2；无服务员的店按 1～2 计） |
| `I` | 轮询间隔（秒） | **3** |
| `H` | 每天 tab 累计在线小时（营业时长） | **10** |
| `R` | 月内平均每天有营业、且至少 1 个 tab 在线的餐厅数 | 见下表 |
| `D` | 每月天数 | **30** |

**每家店每月轮询 API 次数**（仅 staff 实时，不含顾客）：

```text
N_poll = T × (3600 / I) × H × D
       = 3 × 1200 × 10 × 30
       = 1,080,000 次/月/店
```

另计：**顾客与店主非轮询 API**（扫码、下单、结账、Dashboard 保存等），粗算 **~2～5 万次/月/店**（随客流量线性涨，通常 **&lt; 轮询的 5%**）。

##### 4.4.3 两种轮询实现 — 成本差一个数量级

| 模式 | 行为 | 适用 |
|------|------|------|
| **A. 笨轮询** | 每 3s `GET /kitchen/board` 等 **全量 JSON** | ❌ 仅本地调试；**不要**作为 SaaS 默认 |
| **B. 轻量轮询（推荐）** | 每 3s `GET /poll?since=`（~200B，1 条 `max(updated_at)` SQL）；`changed: true` 时再拉 board | ✅ SaaS 第一期默认 |

**粗算对比（单店，T=3，I=3s，H=10h）**：

| 成本维度 | A 笨轮询 | B 轻量轮询 |
|----------|----------|------------|
| Function 调用 | ~108 万/月 | ~108 万/月（**次数相同**） |
| Active CPU | 108 万 × ~150ms ≈ **45 CPU·小时/月** | 108 万 × ~15ms ≈ **4.5 CPU·小时/月** + 变更时全量（见下） |
| 出站流量 | 108 万 × ~12KB ≈ **12 GB/月** | 轻量响应 ≈ **0.2 GB/月** + 全量刷新 |
| Neon 查询 | 每 poll 多次 JOIN | 每 poll 1 次轻量聚合；全量仅在有单时 |

**变更时全量刷新**：假设每店每天 **200 次**业务写（下单、改状态、结账…），每事件厨房+服务员 **debounce 后拉 1～2 次** board → 约 **~1.2 万次/月/店** 全量 API（相对 108 万 poll 可忽略）。

##### 4.4.4 按店规模：Vercel 增量费用（仅 web，B 轻量轮询）

在 **B 轻量轮询**、默认画像下，**仅超额部分**粗算（已含调用 + CPU；流量在百店内通常仍 &lt; 1TB）：

| 活跃餐厅数 `R` | 轮询调用/月 | 调用费 ~$0.60/M | Active CPU ~$0.128/h | **Vercel 用量小计** | 备注 |
|----------------|-------------|-----------------|----------------------|---------------------|------|
| **10** | 10.8M | $6.5 | ~$6 | **~$12** | 常落在 **$20 抵扣额度内** |
| **30** | 32.4M | $19.4 | ~$17 | **~$36** | 抵扣后 **~$16 自付** |
| **50** | 54M | $32 | ~$29 | **~$61** | 抵扣后 **~$41** |
| **100** | 108M | $65 | ~$58 | **~$123** | 抵扣后 **~$103**；需监控流量 |

**加上固定平台费**：每月至少 **$20/席位**（与上表「用量」相加）。  
示例：**30 家店** ≈ **$20（席位）+ $16（用量超额）≈ $36/月** 仅 Vercel web；**100 家店** ≈ **$20 + $103 ≈ $123/月**。

**$20 用量抵扣大约能覆盖多少店（仅轮询调用费一项）**：

```text
33.3M 次调用 ≈ 33.3 / 1.08 ≈ 31 家店 × 3 tab（不含 CPU）
```

因此：**~30 家活跃店**是「主要靠 $20 抵扣、用量不太疼」的参考上限；**CPU 会把实付略抬高**，30 店更贴近 **$35～45/月总 Vercel（web）**。

若用 **A 笨轮询**，同样 30 店 Vercel 用量可飙到 **$200+/月** 量级 — **不可接受**。

##### 4.4.5 数据库（Neon Launch，与 Vercel 并列）

轮询会放大 **DB 读**；与 Vercel 分开账单：

| 活跃店数 | 建议 Neon 配置 | 粗算月费 |
|----------|----------------|----------|
| **&lt; 30** | 0.25 CU，可 scale-to-zero（接受偶发冷启动） | **$5～15** |
| **30～100** | 0.25～0.5 CU **营业时段常开**或关闭 scale-to-zero | **$15～40** |
| **100+** | 0.5 CU+ 常开 + 连接池（Neon pooler） | **$40～80+** |

存储：百店量级菜单+订单 **~2～10 GB** → **$1～4/月** 量级。  
**合计（Vercel web + Neon，B 轻量轮询）**：

| 活跃餐厅 | 粗算总月费（USD） |
|----------|-------------------|
| **10** | **$25～35**（$20 席位 + 少量超额 + Neon） |
| **30** | **$45～60** |
| **50** | **$70～95** |
| **100** | **$140～180** |

不含：图片存储（S3/Blob）、Upstash、额外 Vercel 席位、Supabase 停用后节省的费用。

##### 4.4.6 「能承受多少用户」— 直接结论

| 目标 | 建议 |
|------|------|
| **月费尽量压在 ~$50 内（仅基础设施）** | **~20～25 家**同时按默认画像营业（B 轻量轮询） |
| **Vercel $20 抵扣覆盖大部分用量** | **≤ ~30 家**（再多 CPU 会出超额） |
| **50 家** | 可行；预算 **~$80～100/月**（web+Neon）；确认用 B 轮询 |
| **100 家** | 可行；预算 **~$150～200/月**；预发压测；考虑 **5s 间隔**或 **二期 Redis+SSE** 降调用 |
| **200 家+** | 应规划 **Redis+SSE** 或 **独立 Realtime worker**，并评估 Enterprise / 固定 CU |

**顾客人数**：1 家店每晚 80 桌扫码，只要不走轮询，对 Vercel 影响远小于 1 块厨房屏。瓶颈是 **员工前台 tab 数 × 营业小时**，不是 C 端食客数。

##### 4.4.7 降本杠杆（按优先级）

1. **必须坚持 B 轻量 `/poll`**（迁移验收项）。  
2. **tab 不可见即停**（现有 `visibilitychange` 逻辑）。  
3. **按页面调间隔**：厨房/服务员 3s，Dashboard 结账角标 5s，自助餐价 10s。  
4. **减少每店同时在线 tab**（共用厨房屏、少开后台页）。  
5. **50 店以上**：间隔改 5s（调用量 ×0.6）或上 Redis+SSE。  
6. Vercel 控制台设 **Spend Management 硬上限**，避免异常循环打爆账单。

##### 4.4.8 与当前 Supabase 账单对比

| 现在 | 迁移后（SaaS） |
|------|----------------|
| Supabase Pro/Team + Realtime **含在平台费**里 | Realtime 拆成 **Vercel 轮询调用 + Neon 读** |
| Vercel 主要为页面与业务 API | 员工实时 **转嫁到 Function 计量** |

若 Supabase 月费 **$25～50**、店数 **&lt;30**，迁到 **B 轻量轮询 + Neon** 总成本 **可能持平或略低**；店数 **&gt;50** 必须用 B 模式，否则 Vercel 会明显高于 Supabase 打包价。

**换云选型**：见专门调研 [`saas-hosting-alternatives.zh.md`](./saas-hosting-alternatives.zh.md)（Render / Cloudflare Workers / Railway / Fly / Hetzner 与 Vercel 按店数对比）。

---

### 阶段 5：Storage 替换（约 2–3 天）

1. 新建 `POST /api/dashboard/menu/images`（multipart 上传）。
2. 校验：仅店主、路径 `{restaurantId}/{menuItemId}.{ext}`、MIME/大小限制。
3. `GET /api/files/menu-images/...` 或静态文件服务（Caddy `file_server`）。
4. 迁移脚本：从 Supabase Storage 批量下载 → 写入新存储；更新 `menu_items.image_url`。
5. 删除 `MenuManager.tsx` 中 `supabase.storage` 调用。

**验收**：上传/覆盖/删除/公开访问菜单图正常。

---

### 阶段 6：打印代理与清理（约 2–3 天）

1. 配对 API 响应移除 `supabase_url`（或保留字段但固定为 Mesa API base，兼容旧 agent 一版）。
2. 确认 agent **仅**调 `APIBase`（`main.go` 已如此）；更新文档 [`print-agent-flow.zh.md`](./print-agent-flow.zh.md)。
3. `isPrintAgentDeviceActiveInDb` 改为走 `lib/db`，不再传 Supabase client。

---

### 阶段 7：开发/部署/CI 改造（约 3–5 天）

#### 7.1 本地开发

```bash
# docker-compose.yml（新建）
services:
  postgres:
    image: postgres:16
    ports: ["5432:5432"]
    environment:
      POSTGRES_USER: mesa
      POSTGRES_PASSWORD: mesa
      POSTGRES_DB: mesa
    volumes:
      - mesa_pg:/var/lib/postgresql/data

# package.json scripts（示例）
"db:migrate": "node scripts/db-migrate.mjs",
"db:seed": "node scripts/db-seed.mjs",
"dev": "db:migrate && next dev ..."
```

- 删除对 `supabase start`、`sync-local-supabase-env.sh`、`.env.local.dev` 中 Supabase key 的依赖。
- 新 env：`.env.local` 仅 `DATABASE_URL` + `SESSION_SECRET` + `FILE_STORAGE_ROOT`。

#### 7.2 CI

- GitHub Actions：起 `postgres:16` service container。
- `npm run build` 前 `db:migrate` + seed。
- 移除 Supabase CLI 步骤。

#### 7.3 生产部署

| 场景 | 做法 |
|------|------|
| **Vercel SaaS 生产/预发** | 接 [Neon](https://neon.tech) / RDS；**必须开连接池**（Neon pooler、`?pgbouncer=true` 或 RDS Proxy），避免 Serverless 连接打满；Vercel **web + ops 两个项目**均配置 `DATABASE_URL` |
| **Realtime（SaaS）** | Redis pub/sub 桥接或受控轮询（见阶段 4.2）；勿假设 Vercel 上可 `LISTEN` |
| **Windows 私有化** | 单容器 Postgres + 卷持久化；可用 NOTIFY+SSE（长驻 Next 进程） |
| **备份** | `pg_dump -Fc` 定时任务；与 [`local-on-premise-deployment-plan.md`](./local-on-premise-deployment-plan.md) 备份代理对接 |

#### 7.4 文档更新

- `README.md` 启动步骤
- `docs/ai-schema.md`
- `docs/local-on-premise-deployment-plan.md`（改为 Postgres-only 栈）
- `docs/development-backlog.zh.md` §5 里程碑

**验收**：新人按 README 可在 Windows/macOS 20 分钟内起全栈（Postgres + Web）。

---

### 阶段 8：切流与回滚（约 2–3 天）

全平台切换：**先预发（stage）→ 再生产（production）**；Windows 私有化镜像与 SaaS 使用同一 git tag，仅 Compose/安装器配置不同。

#### 8.1 SaaS 云端切流顺序

1. **预发**：新建 Neon（或 RDS）实例 → 从 Supabase 导出数据迁入 → Vercel Preview/Stage 项目改 `DATABASE_URL` → 跑阶段 8 检查清单。
2. **生产维护窗口**（建议低峰 30–60 分钟）：
   - 冻结 Supabase 写入（或短暂只读公告）；
   - 最终增量同步 / 逻辑复制追平；
   - Vercel Production 切换 `DATABASE_URL`、`SESSION_SECRET`、文件存储变量；
   - 验证登录、下单、厨房、结账、打印；
   - 保留 Supabase 项目 **只读 7–14 天** 作回滚数据源。
3. **菜单图**：Storage 对象迁到 S3/兼容存储后，批量更新 `menu_items.image_url`；旧 Supabase Storage URL 可做短期 302 重定向（可选）。
4. **DNS / 域名**：无变更（仍 Vercel）；打印代理 `APIBase` 不变。

#### 8.2 双栈并行（降风险，推荐）

1. 阶段 1–3 完成后，预发环境 **先** 连新 Postgres，生产仍连 Supabase，直到预发全量验收通过。
2. 生产切流前：写路径在维护窗口内只指向新库；Supabase 作只读对照。

#### 8.3 切流检查清单

- [ ] 所有餐厅 owner/staff 可登录（**切流后全员需重新登录**，见 §10.6）
- [ ] 顾客扫码下单 → 厨房收到 → 打印
- [ ] 结账/分账/确认付款
- [ ] 顾客餐后反馈（`BillPage` / `dish_feedback`）
- [ ] 转台/并台/关台、桌台分组 RPC
- [ ] 打印代理配对/吊销/心跳
- [ ] Ops 开户/查店主/封禁/suspend/resume
- [ ] 菜单图读写；`next/image` 新域名白名单
- [ ] 夜间 cron `nightly-close-sessions`
- [ ] Neon/连接池在高峰下单无 `too many connections`

#### 8.4 回滚

- **SaaS**：维护窗口内若失败，Vercel 环境变量改回 Supabase；代码回滚到上一 tag。
- **数据**：保留 Supabase 项目只读 7–14 天；新库切流前 `pg_dump` 快照。
- **私有化**：保留切流前 `pg_dump`；安装器支持从快照恢复。

---

## 5. 文件级改造索引（实施时勾选）

### 5.1 待删除或废弃

```
apps/web/src/lib/supabase/client.ts
apps/web/src/lib/supabase/server.ts
apps/web/src/lib/supabase/admin.ts
apps/web/src/lib/supabase/middleware.ts
apps/ops/src/lib/supabase/*
scripts/sync-local-supabase-env.sh
.env.local.dev（Supabase 专用）
```

### 5.2 待新增（示例）

```
apps/web/src/lib/db/pool.ts
apps/web/src/lib/db/with-user.ts
apps/web/src/lib/auth/session.ts
apps/web/src/lib/auth/middleware.ts
apps/web/src/app/api/realtime/stream/route.ts
apps/web/src/app/api/files/menu-images/[...path]/route.ts
db/migrations/*.sql
docker-compose.yml
scripts/db-migrate.mjs
scripts/db-seed.mjs
```

### 5.3 待大改

```
apps/web/src/components/dashboard/*Manager.tsx   # 改 API 调用
apps/web/src/components/kitchen/KitchenDisplay.tsx
apps/web/src/components/waiter/*
apps/web/src/lib/staff-auth-client.ts
apps/web/src/lib/dashboard-access.ts
apps/ops/src/lib/platform-auth.ts
packages/shared/*                                # 去掉 SupabaseClient 类型依赖
```

---

## 6. 风险与对策

| 风险 | 影响 | 对策 |
|------|------|------|
| 客户端直连改 API 工作量大 | 延期 | 按页面分批；先只读后写入 |
| Realtime 行为差异 | 厨房延迟 | NOTIFY + SSE；保留 debounce；压测单机连接数 |
| 密码 hash 不兼容 | 全员重置 | 迁移前抽样验证 Supabase bcrypt；准备强制重置流程 |
| RLS 与 app 鉴权双轨 | 安全漏洞 | **以 API 鉴权为准**；RLS 作附加层；安全 review |
| 顾客匿名下单 | 滥用 | 保留速率限制、地理半径、session 校验 |
| 迁移期 schema 漂移 | 数据不一致 | 冻结窗口；单一 migration 来源 |

---

## 7. 工期估算

| 阶段 | 内容 | 人周（1 全职） |
|------|------|----------------|
| 0 | 准备 | 0.5 |
| 1 | Schema | 1 |
| 2 | DB 访问层 + API 补齐 | 2 |
| 3 | Auth | 1 |
| 4 | Realtime | 1 |
| 5 | Storage | 0.5 |
| 6 | 打印代理清理 | 0.5 |
| 7 | Dev/CI/部署 | 1 |
| 8 | 切流/回滚演练 | 0.5 |
| **合计（初估）** | | **约 8 人周** |
| **含 §10 遗漏项** | | **约 9～10 人周** |

两人并行可压到 **4–5 日历周**；与 [`development-backlog.zh.md`](./development-backlog.zh.md) 中私有化阶段 1（2–3 周，原 Supabase 栈产品化）相比，**总工作量相近但长期运维更简单**。

---

## 8. 排期约束

- 迁移在 **`feat/postgres-only`（或等价长期分支）** 进行，避免与打印代理/结账主线互相阻塞；**全平台验收通过后一次性合 `main` 并切生产**。
- 修订 [`local-on-premise-deployment-plan.md`](./local-on-premise-deployment-plan.md)：删除「自托管 Supabase 栈」假设，改为与 SaaS 相同的 Postgres-only 架构。
- **不做**「云端保留 Supabase、仅私有化 Postgres」折中——已明确排除。

---

## 9. 下一步行动

1. 在仓库创建 `docker-compose.yml` + 空 `db/migrations/` 骨架（阶段 0）。
2. 选定 SaaS 托管 Postgres 供应商（Neon / RDS 等）并开预发实例。
3. 跑依赖扫描，生成「客户端 `.from()` 调用」完整 CSV 作为阶段 2 backlog。
4. 修订 [`local-on-premise-deployment-plan.md`](./local-on-premise-deployment-plan.md) 与 [`development-backlog.zh.md`](./development-backlog.zh.md) §5。

| 顾客匿名下单 | 滥用 | 保留速率限制、地理半径、session 校验 |
| 迁移期 schema 漂移 | 数据不一致 | 冻结窗口；单一 migration 来源 |
| **Vercel 无法 LISTEN** | Realtime 失效 | SaaS 默认 **轻量轮询**（§4.4）；私有化 NOTIFY+SSE |
| **轮询笨实现** | 百店 Vercel **$200+/月** | **禁止**每 3s 全量 board；必须 `/poll` + 按需刷新 |
| **Serverless 连接耗尽** | 502 / 下单失败 | 池化 `DATABASE_URL`；限制每实例 pool size |
| **切流后会话全部失效** | 营业中被迫登出 | 低峰维护窗口；提前通知；厨房屏重新登录脚本 |

---

## 10. 方案审查与遗漏补充（2026-06-25 复核）

以下为对照代码库二次审查后补充的项；实施时与上文阶段步骤一并勾选。

### 10.1 架构级（原先未写清）

| 遗漏 | 说明 | 处理 |
|------|------|------|
| **Vercel + LISTEN/NOTIFY** | Serverless 不适合长连接 `LISTEN` | SaaS 用 Redis pub/sub 或轮询；私有化用 NOTIFY+SSE |
| **连接池** | 当前 Supabase 代管；直连 Neon/RDS 易打满连接 | 生产 `DATABASE_URL` 走 pooler；`pg` pool `max` 与实例数匹配 |
| **双 Vercel 项目** | `@mesa/web` + `@mesa/ops` 各有一套 env | 两项目同步改 `DATABASE_URL` / `SESSION_SECRET`；ops 无 cron |
| **切流会话** | Supabase cookie ≠ 新 session 格式 | 维护窗口内**全员重新登录**；无法静默迁移会话 |

### 10.2 代码触点补充

| 区域 | 文件/说明 |
|------|-----------|
| **RSC 页面** | `app/[slug]/menu|kitchen|waiter/*`、`app/dashboard/**/page.tsx` 等 15+ 处服务端 `createClient()` |
| **顾客账单/反馈** | `BillPage.tsx` 客户端直连 `feedback_sessions`、`dish_feedback`（非仅 Storage） |
| **桌台分组** | `TableGroupsManager.tsx` → `replace_table_group_members` RPC |
| **开户** | `packages/shared/create-restaurant.ts` → `auth.admin.createUser` |
| **员工** | 开户/重置密码/删除 → `auth.admin.*`；`staff-user-ban.ts` → `signOut(global)` + `ban_duration` |
| **Ops** | `ops-user-lookup.ts` `getUserById`；`restaurants/route.ts` `listUsers`；`admins/route.ts` 创建运营账号 |
| **OAuth 回调** | `app/auth/callback/route.ts` — 若产品仅邮箱密码，可删除；否则需自研 magic link/OAuth |
| **共享包** | `print-agent-device-active.ts`、`print-agent-revoke.ts`、`platform-admin-audit.ts`、`print-agent-support-snapshot.ts` 等依赖 `SupabaseClient` 类型 |

**建议**：在 `packages/shared` 定义窄接口 `DbClient`（query + transaction），web/ops 实现适配，避免 shared 依赖 `@supabase/supabase-js`。

### 10.3 Auth Admin API 替换对照

| 现 Supabase Admin | 新实现 |
|-------------------|--------|
| `createUser({ email, password, email_confirm })` | `INSERT app_users` + bcrypt hash |
| `updateUserById`（改密、metadata、`ban_duration`） | `UPDATE app_users`；封禁写 `disabled_at` 或 `banned_until` |
| `deleteUser` | `DELETE` 或软删 + 清理 staff/owner FK |
| `signOut(userId, 'global')` | 递增 `app_users.session_version` 或删 session 表；中间件校验 version |
| `listUsers` / `getUserById` | `SELECT` from `app_users`（ops 查店主邮箱） |

### 10.4 数据库与数据迁移

- **UUID 保持不变**：迁数据时保留 `auth.users.id` → `app_users.id`，避免全库 FK 重写。
- **角色与 GRANT**：baseline 删除对 `authenticated`/`anon`/`service_role` 的依赖；API 使用单一 DB 角色 + 应用层鉴权。
- **`SECURITY DEFINER` RPC**：可保留；确保仅 `mesa_app` 可 `EXECUTE`，且内部不依赖 `auth.uid()` 未设置时的空值。
- **公开写表**：`orders` INSERT、`dish_feedback` / `feedback_sessions` ALL — 迁后**必须经 API**（速率限制 + `restaurant_id` 校验），不可再暴露 anon DB 角色。

### 10.5 工程与配置遗漏

| 项 | 处理 |
|----|------|
| `next.config.mjs` | 删除 `serverComponentsExternalPackages: @supabase/*`；`images.remotePatterns` 改为新图床域名 |
| `.env.local.example` / Vercel | 保留 `ADMIN_BOOTSTRAP_SECRET`、`STAFF_SESSION_SECRET`、`ORDER_ENQUEUE_SECRET`、`CRON_SECRET`、`PRINT_AGENT_JWT_SECRET` |
| `supabase/seed.sql`、`scripts/generate-juhaochi-seed.mjs` | 改为 `db/seed` + `app_users` 插入 |
| `scripts/test-ops-*.mjs`、`phase*-verify-*.mts` 等 | 改为 `DATABASE_URL` 或标记仅 legacy |
| `.github/workflows/ci.yml` | 起 Postgres service；占位 env 换 `DATABASE_URL` |
| `README.md`、`docs/monorepo-vercel.zh.md` | 删除 Supabase Redirect URLs、anon key 说明 |
| `supabase/` 目录 | 迁移完成后归档或仅留历史；新 migration 只进 `db/migrations/` |

### 10.6 切流与运营

- **维护公告**：切流前通知客户重新登录厨房屏/收银 iPad。
- **密码**：bcrypt hash 可直接迁；失败则店主重置 + 员工强制改密流程。
- **菜单图 CDN**：`menu_items.image_url` 批量替换；旧 `*.supabase.co` URL 短期 302（可选）。
- **打印代理**：已配对设备 JWT 不变；仅确认 `APIBase` 仍指向 Mesa 域名。

### 10.7 工期修正（含遗漏项）

| 增量 | 人周 |
|------|------|
| Vercel Realtime 桥接（Redis 或轮询 + 压测） | +0.5～1 |
| **轻量 `/poll` API + 成本验收**（§4.4） | +0.25（含在阶段 4） |
| Auth session 吊销 / session_version | +0.25 |
| RSC 页面与 BillPage 反馈 API | +0.5（部分已含在阶段 2） |
| 脚本/CI/seed 全面改写 | +0.25 |
| **修订后合计** | **约 9～10 人周** |

---

## 附录 A：环境变量对照

| 现变量 | 新变量 |
|--------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | 删除 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 删除 |
| `SUPABASE_SERVICE_ROLE_KEY` | 删除 |
| — | `DATABASE_URL` |
| — | `SESSION_SECRET` |
| — | `FILE_STORAGE_ROOT` 或 `S3_ENDPOINT` / `S3_BUCKET` / `S3_ACCESS_KEY` / `S3_SECRET_KEY` |
| `PRINT_AGENT_JWT_SECRET` | **保留**（与 Supabase 无关） |
| `ADMIN_BOOTSTRAP_SECRET` | **保留**（ops 首个运营账号 bootstrap） |
| `STAFF_SESSION_SECRET` | **保留**（若仍用于非 Supabase 的 staff 签名 cookie） |
| `ORDER_ENQUEUE_SECRET` | **保留**（下单打印入队 HMAC） |
| `CRON_SECRET` | **保留**（Vercel Cron） |
| — | `REDIS_URL`（**可选**，SaaS Realtime 桥接；私有化可省略） |

## 附录 B：Windows 本地开发快速起步（迁移完成后）

```bash
docker compose up -d postgres
cp .env.local.example .env.local   # 填入 DATABASE_URL
npm run db:migrate
npm run db:seed
npm run dev
```

访问 http://localhost:3000 ，使用 seed 账号登录验证。
