# Mesa 当前功能逻辑说明（Research）

本文档记录当前项目已实现并生效的业务逻辑，用于后续开发、测试和回归验证。

## 1. 系统角色与入口

- **顾客端**：`/[slug]/menu?table_id={uuid}`（扫码进入；QR 绑 **`table_id`**，界面与小票展示 **`display_name`**，如 `A-01`）
- **厨房端**：`/[slug]/kitchen` — **店主**（同一会话已登录 `/dashboard`）或 **厨房员工**（`/{slug}/staff/login` 等）可进入；未满足则跳转员工登录。Realtime 见下。
- **服务员观察端**：`/[slug]/waiter` — **店主**或 **`waiter` 角色员工**，规则同上。
- **员工登录**（已实现）：
  - **店内入口**：`/[slug]/staff/login` — 可只填 **登录名 + 密码**（服务端拼成 **`{login_name}@mesa.in`**），或填完整邮箱；URL 中的 `slug` 用于校验账号属于本店。
  - **全局入口**：`/auth/staff/login` — 填 **`{login_name}@mesa.in` + 密码**，不选店，凭邮箱解析餐厅与角色。
  - **首次或重置密码后**：`/auth/staff/change-password` 强制改密后再进入厨房/服务员页。
- **店主后台**：`/dashboard/*`；**设置 Hub**（`/dashboard/settings`）含 **基本资料、员工管理、桌位、菜单、出品档口、自助餐、打印助手** 等 Tab。**员工管理**：`/dashboard/settings/staff`（`StaffAccountsManager` — 创建/停用/删除/重置密码等）。

### 1.1 平台管理员 vs 店内角色（勿混为一谈）

| 维度 | **平台管理员（Mesa 运营）** | **店内 / 租户侧** |
|------|------------------------------|-------------------|
| **是谁** | Mesa 内部运营 / 技术支持；**目标态**为独立平台账号登录 **`/ops/*`**（见 [`docs/platform-admin-plan.zh.md`](docs/platform-admin-plan.zh.md)）。**现状**：仍可用环境变量 **`ADMIN_BOOTSTRAP_SECRET`** + **`/auth/admin/register`** 代开新店 | **店主**：`restaurants.owner_id`；**厨房 / 服务员**：**独立 Supabase Auth 账号**，合成邮箱 **`{login_name}@mesa.in`**（全平台 `login_name` 唯一），见 [`docs/staff-accounts-plan.md`](docs/staff-accounts-plan.md) |
| **数据归属** | 不天然属于某一家 `restaurants`；跨店读写走 **`/api/ops/*` + service role**，且写操作须 **审计** | 所有 `/dashboard` 与 RLS 以 **`owner_id = auth.uid()`** 绑定「本店」；员工以 **`restaurant_staff_accounts`** 绑定 **`restaurant_id` + `user_id`** |
| **典型能力** | 餐厅列表与开户、店主重置密码、**远程吊销**打印设备 / 配对码、跨店 `print_jobs` 排障、套餐与功能开关 override（分阶段，见运营计划） | 菜单、订单、桌位、员工、本店打印助手等 |

**设计原则**：平台级能力（开新店、远程吊销凭证、SaaS 计费/审计等）与租户内能力（菜单、订单、桌位）应 **分接口、分登录态、分文档与 UI 入口**，避免混用同一套登录态或同一页配置。

**实施计划**：[`docs/platform-admin-plan.zh.md`](docs/platform-admin-plan.zh.md)

## 2. 多语言（zh/en/pt）

- 采用全局语言方案（`LanguageProvider` + `messages` 字典）。
- 后台与前台核心页面支持中文、英文、葡语切换。
- 桌位页员工入口文案、员工设置等已接入国际化。

## 3. 餐厅与密码 / 员工账号

- 餐厅在 `restaurants` 表中管理。
- **（规划中）** 注册 / 开建新门店须采集 **`country_code`**（ISO 3166-1 alpha-2，如 `PT` / `CN`）：写入 `restaurants` 时 **必填**（含店主 onboarding 与平台管理员代建餐厅）；**门店所在地等**，**不**推导小票语言。票面默认语言用 **`print_locale`**（`zh` / `en` / `pt`；**默认 `pt` = 欧洲葡萄牙语 `pt-PT` 语义，非 `pt-BR`**），见 `docs/print-agent-plan.md` **「默认打印语言 `print_locale`」**。
- **共享 PIN（4 位厨房/服务员口令）**：**已移除** — 设置 Hub「基本资料」中 **不再维护** `kitchen_password` / `waiter_password`；旧 **`/api/restaurants/[slug]/staff/session`** 路由已删除；厨房/服务员页 **仅认 Supabase Auth 员工会话**。
- **数据库**：历史迁移中可能仍存在 `kitchen_password` / `waiter_password` 等列；**可选后续**在迁移中正式 `drop` 列并清理遗留 helper（见 [`docs/staff-accounts-plan.md`](docs/staff-accounts-plan.md) 迁移清单）。
- **员工账号**：表 **`restaurant_staff_accounts`** + Supabase **`auth.users`**；店主在 **`/dashboard/settings/staff`** 维护；登录邮箱格式 **`{login_name}@mesa.in`**（见实施计划）。

## 4. 桌位与餐次（Table + Session）模型

> **定稿（待代码落地）**：详见 [`docs/restaurant-tables-design.zh.md`](docs/restaurant-tables-design.zh.md)。

### 4.1 桌位 `restaurant_tables`

- **`id`（`table_id`）**：永久稳定；QR、API、FK 均指向此 UUID。
- **`display_name`**：展示用名称（新店默认 **A-01、A-02…** 递增）；**店内唯一**（活跃行）；可随时修改，**不影响 QR**。
- **停用**：软删（`deleted_at`），设置页须 **Modal 确认**；不硬删有历史的行。
- **废弃**：`restaurants.table_numbers` 数组、`rename_restaurant_table_number` RPC、`?table=字符串` URL。

### 4.2 餐次 `table_sessions`

- 用于管理「一桌一餐次」生命周期；关联 **`table_id`**（非字符串桌号）。
- 会话状态：
  - `open`：就餐进行中
  - `billing`：已呼叫结账，待服务员处理
  - `closed`：已收款关台
- 一桌同一时刻只能有一个活跃会话（`open/billing`）；唯一约束 **`(restaurant_id, table_id)`**。
- 转台 / 并台 / 关台：见 [`docs/table-transfer-merge-plan.zh.md`](docs/table-transfer-merge-plan.zh.md)（RPC 参数为 **`table_id`**）。

## 5. 下单与加单逻辑（顾客端）

- 顾客首次下单时：
  1. 若无活跃会话则创建 `table_session(open)`。
  2. 创建或复用本会话订单记录。
- 顾客继续加单时：
  - 复用同一餐次同一订单（不新开订单）。
  - 新增菜品以新 `batch_id` 追加，保留加单批次信息。
- 订单总状态由菜品状态推导（菜品级状态优先）。
- 为避免类型导致的计算异常，金额计算统一使用数值安全逻辑（price/qty 转 number）。

## 6. 菜品级出餐（厨房端）

- 厨房对每个菜品执行状态流转：`pending -> cooking -> done`。
- 订单整体状态由菜品状态聚合得出（而不是手动直接改订单状态）。
- 已加入并发保护（乐观锁思路，基于 `updated_at`）以减少多人操作冲突。
- 厨房卡片支持按 `batch_id` 显示“首次下单/加单”批次信息。

## 7. 顾客端“已下单”与实时感知

- 顾客菜单页会读取本桌当前会话订单并展示“已下单”列表。
- 新加单批次会短时显示 `NEW` 标记，帮助顾客确认加单已提交。
- 菜品状态变化可通过实时数据更新传导到顾客/服务员/厨房端视图。

## 8. 结账与分单逻辑（当前规则）

- 当前已调整为：
  - **顾客下过单后，任何时候都可进入结账页**（不再要求全部出餐完成）。
  - 结账金额按本餐次**实际已下单金额**计算（不按 `done` 过滤）。
- 分单支持：
  - 均摊
  - 按菜分配
  - 自定义金额
  - 可不选择分单模式（仅总计）
- 呼叫结账后：
  - 写入/更新 `bill_splits`（同一会话复用请求，避免重复插入）
  - 会话状态切换到 `billing`
  - 分单结果会持久化并在刷新后恢复
- **恢复点单与部分收款后的续结**（按菜分单锁定、已收款项保留、已收菜品不可改分配）：详见 [`docs/checkout-resume-ordering.zh.md`](docs/checkout-resume-ordering.zh.md)。

## 9. 服务员侧结账处理与关台

- 后台订单页集成结账请求管理（展示待处理请求）。
- 结账详情 UI：
  - **已收款项**：逐位确认收款后写入 `session_collected_payments`，在顶部汇总展示。
  - **分单结果**：仅展示**尚未确认收款**的客人；已确认者从该列表移除（避免与已收款项重复），确认时仍按 `bill_splits.result` 原始 `person_index` 调用 RPC。
- 服务员/店主确认收款后：
  - 分账行 `paid: true`；全员付清时 `bill_splits.status -> paid`、`table_sessions.status -> closed`
- **恢复点单**：多人分账且仅部分收款时允许将餐次从 `billing` 回到 `open` 继续加菜；`session_collected_payments` 保留。按菜分单在部分收款后**不得再改分单模式**，已收款对应的菜品分配冻结，详见 [`docs/checkout-resume-ordering.zh.md`](docs/checkout-resume-ordering.zh.md)。
- **强制关台**（未走完分账全员 paid）：须同时取消未付分账、作废当餐订单行并关餐次，与看板「结账请求」绿灯一致；详见 [`docs/table-session-close.zh.md`](docs/table-session-close.zh.md)。
- 关台后，顾客若刷新账单页会被服务端强制跳转回点单页（`/menu?table_id={uuid}`）。

## 10. 员工入口与桌位二维码（后台桌位页）

- 桌位二维码：`/[slug]/menu?table_id={uuid}`；打印卡片标题为 **`display_name`**（客人不看到 UUID）。
- **员工统一登录入口（二维码打印）**：`/[slug]/staff/login`（与 `src/components/dashboard/TablesManager.tsx` 中链接一致）。
- 厨房 / 服务员 **业务页** `/[slug]/kitchen`、`/[slug]/waiter`：**需已由上述入口完成员工登录**，未登录会跳转回 `staff/login`。
- 支持下载二维码，已接入三语文案。
- **打印队列（出品联 / 小票 / 预结）**：顾客或服务员提交订单后，经 **`POST /api/restaurants/[slug]/orders/append`**（地理围栏 + **`enqueue_token`**）再 **`POST .../station-tickets/auto`**（校验 token）**自动入队** **`print_jobs`**（按本批 `batch_id`、各出品档口分组）。**无**厨房/服务员页「手动打印出品」按钮。店主在 **餐厅设置 → 打印助手** 排障；本地 **print-agent** 拉取打印。档口：**`COALESCE(菜品档口, 分类档口)`**，分类沿 **`parent_id` 继承**；无档口不入队（代点时会提示）。见 [`docs/print-agent-plan.md`](docs/print-agent-plan.md)。
- **打印 payload 桌位字段（已定）**：凡涉及桌位的任务（**`station_ticket` / `order_receipt` / `pre_bill`**），入队时 **成对写入** **`table_id`（UUID）** + **`display_name`（快照）**；**热敏纸只印 `display_name`**，`table_id` 用于日志、后台队列筛选与历史重打关联；**禁止**把 UUID 印到纸面。与 [`docs/restaurant-tables-design.zh.md`](docs/restaurant-tables-design.zh.md) §8 一致。

## 11. 已知设计取向（当前版本）

- 采用“**同一餐次单订单 + 批次追加**”而非“每次加单新订单”。
- 采用“**菜品级出餐**”而非“整单一次性完成”。
- 采用“**呼叫结账后由员工关台**”而非顾客端自动结束桌台。
- 采用「**按员工账号（Supabase Auth）+ 角色**」替代「**整店共享 4 位 PIN**」，便于设备独立登录与审计。

## 12. 后续可选 / 文档级待办

- **平台运营后台**：见 [`docs/platform-admin-plan.zh.md`](docs/platform-admin-plan.zh.md)（P0 替代 `/auth/admin/register` 为主开户路径；P1 打印凭证远程吊销与审计）。
- **数据库**：在确认无依赖后 **删除** `restaurants.kitchen_password` / `waiter_password`（及版本列等）并收缩 `staff-password` 类 helper；见 [`docs/staff-accounts-plan.md`](docs/staff-accounts-plan.md)。
- **安全**：按需进一步 **收紧 anon RLS**（计划中同上）。
- 其它产品文档（如 `README.md`、本文件、`print-agent-plan.md`）已与 [`docs/restaurant-tables-design.zh.md`](docs/restaurant-tables-design.zh.md) 桌位与打印 payload 定稿对齐；实施代码时以定稿为准。
