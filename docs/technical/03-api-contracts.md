# API 契约

> **状态**：阶段 5 已填充（2026-06-30）  
> **读者**：开发、AI 代理

## 用途

汇总 `apps/web` 主要 HTTP API 的路径、鉴权与职责。实现以 `apps/web/src/app/api/**/route.ts` 为准。  
`apps/ops` 单独一节。

**约定**

- 租户 API 默认 `runtime = 'nodejs'`
- 错误体常见：`{ error: string, message?: string }`
- 迁移未应用：503 + `migration_required`
- 写结账/关台/转台：**优先 RPC**，route 做鉴权与参数解析

---

## 命名空间总览

| 前缀 | 调用方 | 鉴权 |
|------|--------|------|
| `/api/dashboard/*` | 店主 / 前台 Dashboard | Supabase session；`loadDashboardAccess` / owner RLS |
| `/api/restaurant/*` | 店主（单店设置） | Owner session |
| `/api/restaurants/[slug]/*` | 顾客、员工 | Slug + table 上下文或 `staffAuthFromRequest` |
| `/api/print-agent/*` | 本地代理、Dashboard 配置 | Agent JWT 或 owner session（因路由而异） |
| `/api/auth/*` | 登录 | 公开 / session 建立 |
| `/api/analytics/*` | 店主 | Owner only |
| `/api/cron/*` | Vercel Cron | `Authorization: Bearer ${CRON_SECRET}` |
| `/api/admin/*` | 受限管理 | 特殊密钥/环境 |
| `/api/downloads/*` | 浏览器下载安装包 | 公开 |

---

## 1. 桌位

| 方法 | 路径 | 鉴权 | 职责 |
|------|------|------|------|
| GET/PATCH/POST | `/api/dashboard/tables` | Owner / frontdesk | 桌位 CRUD、排序 |
| GET/POST/PATCH/DELETE | `/api/dashboard/table-groups` | Owner / frontdesk | 分组与成员 |
| POST | `/api/dashboard/close-table-session` | Owner / frontdesk | 强制关台 → `close_table_session_*` RPC |
| GET | `/api/restaurants/[slug]/staff/waiter/tables/[tableId]` | Waiter+ | 桌台详情 |
| GET | `/api/restaurants/[slug]/staff/waiter/tables/[tableId]/action-targets` | Waiter+ | 转台/并台目标桌列表 |
| POST | `/api/restaurants/[slug]/staff/waiter/tables/action` | Waiter+ | `transfer` \| `merge` RPC |

---

## 2. 订单

| 方法 | 路径 | 鉴权 | 职责 |
|------|------|------|------|
| POST | `/api/restaurants/[slug]/orders/append` | 顾客 / 员工 | 加菜；地理围栏；`guestOrderingEnabled` |
| GET/PATCH | `/api/restaurants/[slug]/staff/kitchen/orders/[orderId]` | Kitchen | 更新订单行状态 |
| GET | `/api/restaurants/[slug]/staff/kitchen/board` | Kitchen | 看板数据 |
| GET/PATCH | `/api/restaurants/[slug]/staff/waiter/orders/[orderId]` | Waiter+ / frontdesk | 改单；服务员 void → `403` |
| POST | `/api/restaurants/[slug]/staff/waiter/orders/[orderId]/decrement-item` | frontdesk / owner | 菜单减数量/退菜；服务员 → `403` |

---

## 3. 菜品 / 菜单

| 方法 | 路径 | 鉴权 | 职责 |
|------|------|------|------|
| GET/POST/PATCH/DELETE | `/api/dashboard/menu/items` | Owner / frontdesk | 菜品 CRUD |
| POST | `/api/dashboard/menu/items/[id]/image` | Owner / frontdesk | 图片上传 Storage |
| GET/POST/PATCH/DELETE | `/api/dashboard/menu/categories` | Owner / frontdesk | 分类 |
| GET/POST/PATCH/DELETE | `/api/dashboard/menu/print-stations` | Owner | 打印档口 |

页面数据多数由 RSC `loadDashboardMenu()` 服务端加载，非独立 REST。

---

## 4. 结账

| 方法 | 路径 | 鉴权 | 职责 |
|------|------|------|------|
| POST | `/api/restaurants/[slug]/checkout/request` | 顾客 | `upsert_bill_split_request` |
| POST | `/api/restaurants/[slug]/checkout/confirm-payment` | Staff 结账角色 | `confirm_bill_split_payment` + 打印入队 |
| POST | `/api/restaurants/[slug]/checkout/resume-ordering` | Staff | `resume_table_session_ordering` |
| POST | `/api/restaurants/[slug]/checkout/apply-discount` | Staff | 折扣写 split + 审计 |

结账台列表：Dashboard 页面 SSR 加载 `bill_splits`，Realtime 刷新；无单独 list API。

---

## 5. 打印

### 5.1 租户 Web（入队与配置）

| 方法 | 路径 | 鉴权 | 职责 |
|------|------|------|------|
| POST | `/api/restaurants/[slug]/station-tickets/auto` | 内部/员工 | 出品联入队 |
| POST | `/api/restaurants/[slug]/order-receipt/print` | Staff | 手动账单打印入队 |
| GET/POST | `/api/print-agent/pairing` | Owner | 创建配对码 |
| GET | `/api/print-agent/pairings` | Owner | 列表 |
| POST | `/api/print-agent/pairings/[id]/revoke` | Owner | 作废配对 |
| POST | `/api/print-agent/claim` | 配对码 | 注册设备、签发 JWT |
| GET | `/api/print-agent/pending-jobs` | Agent JWT | 拉取待打任务 |
| PATCH | `/api/print-agent/jobs/[id]` | Agent JWT | 更新 done/failed |
| POST | `/api/print-agent/print-jobs/[id]/retry` | Owner | 重试失败任务 |
| GET | `/api/print-agent/print-jobs/recent` | Owner | Dashboard 最近任务 |
| POST | `/api/print-agent/heartbeat` | Agent JWT | 设备心跳 |
| GET/PATCH | `/api/print-agent/settings` | Owner / Agent | 代理配置 |
| GET/PATCH | `/api/print-agent/routing` | Agent JWT | 档口路由同步 |
| GET/POST | `/api/print-agent/devices` | Owner | 设备列表 |
| POST | `/api/print-agent/devices/[id]/revoke` | Owner | 吊销设备 |
| GET | `/api/print-agent/receipt-printers` | Owner | 账单打印机列表 |
| PATCH | `/api/print-agent/bill-receipt-printer` | Owner | 默认账单机 |
| GET | `/api/print-agent/runtime-config` | Agent | 远程配置 |
| GET | `/api/print-agent/support-snapshot` | Support JWT | 运维快照 |
| GET | `/api/downloads/print-agent/[artifact]` | 公开 | 安装包重定向 |

### 5.2 详见 [`04-printing.md`](./04-printing.md)

---

## 6. 分单 / 顾客账单

| 方法 | 路径 | 鉴权 | 职责 |
|------|------|------|------|
| GET | `/api/restaurants/[slug]/customer/session` | 顾客 | 活跃会话 + 近期订单 |
| GET | `/api/restaurants/[slug]/customer/bill` | 顾客 | 账单页数据 |

分单提交走 `checkout/request`，无独立 `bill_splits` CRUD API。

---

## 7. 经营分析

| 方法 | 路径 | 鉴权 | 职责 |
|------|------|------|------|
| GET | `/api/analytics/value-overview?range=7d\|30d` | Owner | `AnalyticsService.getValueOverview` |

不接受客户端 `restaurant_id`。

---

## 8. 设置 / 员工 / 功能

| 方法 | 路径 | 鉴权 | 职责 |
|------|------|------|------|
| GET/PATCH | `/api/restaurant/settings` | Owner | 餐厅资料 |
| GET/PATCH | `/api/restaurant/features` | Owner | `feature_flags` |
| GET/POST | `/api/dashboard/staff` | Owner | 员工账号 |
| PATCH/DELETE | `/api/dashboard/staff/[id]` | Owner | 更新/禁用 |
| POST | `/api/dashboard/staff/[id]/reset-password` | Owner | 重置密码 |
| GET/POST/PATCH | `/api/dashboard/buffet` | Owner | 自助餐规则 |
| GET/PATCH | `/api/dashboard/abnormal-operations` | Owner | 异常列表 |
| PATCH | `/api/dashboard/abnormal-operations/[id]` | Owner | 确认/忽略 |

---

## 9. 认证

| 方法 | 路径 | 职责 |
|------|------|------|
| POST | `/api/auth/login` | 店主登录 |
| POST | `/api/auth/staff/login` | 员工登录（按 slug/角色） |

员工现场页：`/[slug]/kitchen|waiter`；Dashboard 员工：`/dashboard/*`（middleware 角色分流）。

---

## 10. 定时任务

| 方法 | 路径 | 调度 | 职责 |
|------|------|------|------|
| GET/POST | `/api/cron/nightly-close-sessions` | Vercel Cron 04:00/05:00 UTC | 里斯本夜间批量关台 |

---

## 11. `apps/ops` API（`/api/ops/*`）

| 领域 | 路径示例 |
|------|----------|
| 认证 | `/api/ops/auth/login`、`logout` |
| Bootstrap | `/api/ops/bootstrap` |
| 餐厅 | `/api/ops/restaurants`、`[id]`、`suspend`、`resume` |
| 员工代管 | `/api/ops/restaurants/[id]/staff` |
| 打印运维 | `/api/ops/print/jobs`、`pairings`、`devices`、`revoke` |
| 平台管理员 | `/api/ops/admins` |
| 审计 | `/api/ops/audit`、`export` |

鉴权：`platform_admin_accounts`；与租户站 **Cookie 隔离**（独立域名）。

---

## 错误码惯例（节选）

| code | 含义 |
|------|------|
| `session_billing` | 会话结账中，禁止加菜/转台等 |
| `no_active_session` | 无 open/billing 会话 |
| `already_paid` | 重复确认收款 |
| `whole_table_paid` | 禁止恢复点餐 |
| `rate_limited` | 限流 |
| `unauthorized` | 401 |
| `migration_required` | 503，需 `supabase db push` |

---

## 相关文档

- [`01-architecture.md`](./01-architecture.md)
- [`04-printing.md`](./04-printing.md)
- [`../print-agent-plan.md`](../print-agent-plan.md)
