# Mesa — 葡萄牙餐厅点餐 SaaS

多租户餐厅 SaaS 系统，支持扫码点餐、实时厨房显示、智能分单。

**技术栈**：Next.js 14 + Supabase + TypeScript + Tailwind CSS

---

## 本地启动步骤

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

```bash
cp .env.local.example .env.local
```

- **本地库**：`bash scripts/sync-local-supabase-env.sh`（见下方「本地 Supabase」）
- **云端库**：在 `.env.local` 填入云项目配置（见下方 Supabase 初始化）

### 3. 启动开发服务器

```bash
supabase start          # 仅本地库需要
npm run dev             # 本地 Docker Supabase（读 .env.local.dev）
npm run stage           # 云端 stage 项目（读 .env.local.supabase）
npm run cloud         # 云端 Supabase（读 .env.local）
```

访问 http://localhost:3000

---

## Supabase 初始化步骤

### 1. 创建 Supabase 项目

1. 前往 [supabase.com](https://supabase.com) 注册并创建新项目
2. 记录项目 URL 和 anon key（在 Project Settings → API 中）

### 2. 配置环境变量

在 `.env.local` 中填入：

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

### 3. 运行数据库迁移

推荐使用 Supabase CLI 推送迁移（按时间顺序）：

```bash
supabase login
supabase link --project-ref <your-project-ref>
supabase db push
```

Schema 已 squash 为单文件 `supabase/migrations/20240101000000_initial_schema.sql`；新变更请追加带时间戳的新 migration，勿改 baseline。

如果远端是历史库且出现“表已存在但迁移未记录”，先执行 `supabase migration repair` 后再 `supabase db push`。

### 4. （可选）插入示例数据

执行 `supabase/seed.sql` 会自动创建本地演示账号与「巨好吃餐厅」菜单（来自云库快照，不含订单）。登录：`dev-owner@local.test` / `localdev123`。更新快照：`node scripts/generate-juhaochi-seed.mjs`。

**本地 Supabase**：`.env.local.dev` 仅在本机生成（已 gitignore，勿提交）。首次：

```bash
supabase start
bash scripts/sync-local-supabase-env.sh
npm run dev
```

`npm run dev` 会先加载 `.env.local.dev`；已注入的变量不会被 `.env.local` 覆盖。

**云端 stage**：`npm run stage` 使用 `.env.local.supabase`（联调 Supabase 项目 restaurant-ordering-dev）。

**云端**：`npm run cloud` 使用现有 `.env.local`（其他云 Supabase 项目）。

### 5. 配置环境变量（运营开户 / 服务端）

除 `NEXT_PUBLIC_*` 外，运营后台与 bootstrap 还需：

- `SUPABASE_SERVICE_ROLE_KEY`：Supabase 项目 Settings → API → `service_role` secret
- `ADMIN_BOOTSTRAP_SECRET`：长随机串；仅用于 **首个运营账号** bootstrap（`@mesa/ops` 的 `/ops/bootstrap`），不再用于租户侧开新店

租户 Web（`@mesa/web`）建议配置 `NEXT_PUBLIC_OPS_APP_URL`（运营后台公网 URL），以便 `/auth/admin/register` 自动跳转到 `/ops/login`。

### 6. 配置 Supabase Auth

在 Supabase Dashboard → Authentication → URL Configuration：

- **Site URL**：本地填 `http://localhost:3000`；上线后改为生产域名（如 Vercel）
- **Redirect URLs**：把 `http://localhost:3000/auth/callback` 与生产环境的 `https://你的域名/auth/callback` 都加入白名单

### 7. 店主账号如何创建（公开注册已关闭）

1. **运营后台**（推荐）：在 `@mesa/ops` 登录后打开 **创建餐厅**（`/ops/restaurants/new`）。若尚无运营账号，先在 `/ops/bootstrap` 用 `ADMIN_BOOTSTRAP_SECRET` 创建首个运营账号（仅需一次）。
2. 在 [Supabase Dashboard](https://supabase.com/dashboard) → **Project Settings → API** 配置 **service_role** 密钥到 `.env.local`（`SUPABASE_SERVICE_ROLE_KEY`）。
3. 通知店主使用 **`/auth/login`** 登录后台（邮箱已在创建时标为已确认，无需验证链接）。

旧路径 **`/auth/admin/register`** 已下线（跳转到运营登录）。`POST /api/admin/create-restaurant` 返回 **410**，请改用 `POST /api/ops/restaurants`。

建议在 Supabase → **Authentication** → **Providers → Email** 中关闭 **Allow new users to sign up**（禁止匿名 `signUp`），与上述流程一致。

### 8. 注册报「Error sending confirmation email」/ 用户创建不了（必看）

Supabase **内置邮件**不是给公开注册用的：在未配置 **自定义 SMTP** 时，Auth **只会给当前组织「Team」里成员的邮箱发信**，其他地址会失败，表现为注册报错、Users 里没有新用户。见官方说明：[Send emails with custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp)。

**正式解决（推荐）：**

1. 打开 Dashboard → **Authentication** → **SMTP**（或直接 [项目 Auth SMTP 设置](https://supabase.com/dashboard/project/_/auth/smtp)）
2. 启用 **Custom SMTP**，按你的邮件服务商填写（常用：[Resend + Supabase](https://resend.com/docs/send-with-supabase-smtp)）
3. 保存后重新注册测试

**若已配 Resend 仍失败：**发件人填的是 `onboarding@resend.dev` 时，Resend **只允许发到你在 Resend 注册用的那个邮箱**，不能给任意 Gmail 发确认信。请到 [Resend Domains](https://resend.com/domains) **添加并验证你自己的域名**，然后把 Supabase 里的 **Sender email** 改成 `noreply@你的域名`（或任意 `@你的域名` 地址），再测注册。

**仅本地试功能（不推荐上生产）：**

- Authentication → **Providers** → **Email**：关闭 **Confirm email**（无需确认信即可 `signUp` 成功）

**仅临时测一封内置邮件：**把测试邮箱加进 Supabase **Organization → Team** 成员（只适合验证模板，不适合真实用户注册）。

---

## 页面路由

| 路径 | 说明 |
|------|------|
| `/` | 产品落地页 |
| `/auth/login` | 登录 |
| `/auth/register` | 提示「公开注册已关闭」（跳转登录） |
| `/auth/admin/register` | **已下线** — 重定向至运营后台 `/ops/login`（需 `NEXT_PUBLIC_OPS_APP_URL`） |
| `/dashboard` | 餐厅后台概览 |
| `/dashboard/settings/menu` | 菜单管理 |
| `/dashboard/tables` | 桌位二维码管理 |
| `/dashboard/orders` | 订单历史 |
| `/dashboard/settings` | 餐厅设置 **Hub**（基本资料、员工管理、桌位、菜单等 Tab） |
| `/dashboard/settings/staff` | 员工账号（创建、停用、删除、重置密码等） |
| `/[slug]/menu?table_id={uuid}` | 顾客点餐页（手机端；QR 绑稳定 `table_id`，界面显示 `display_name` 如 A-01） |
| `/[slug]/staff/login` | 员工登录（店内入口；登录名或完整 `{login}@mesa.in`） |
| `/auth/staff/login` | 员工登录（全局入口；不选店） |
| `/auth/staff/change-password` | 员工首次登录 / 重置密码后的强制改密 |
| `/[slug]/kitchen` | 厨房显示页（需 **已登录** 的厨房角色员工） |
| `/[slug]/waiter` | 服务员观察页（需 **已登录** 的服务员角色员工） |
| `/[slug]/bill?table_id={uuid}` | 账单分单页 |
| `/[slug]/waiter/[tableId]` | 服务员单桌详情（路径为桌位 UUID） |

---

## 桌位模型（定稿）

- 桌位身份 **`table_id`（UUID）** 与展示名 **`display_name`（如 A-01）** 分离；改显示名 **不重打 QR**。
- 设置页：默认 A-01 递增、店内名称唯一、停用桌须确认（软删，不硬删）。
- 打印入队：`print_jobs.payload` **成对写入** `table_id` + `display_name` 快照；热敏纸 **只印 display_name**，UUID 仅用于日志/队列/重打。
- 完整设计见 [`docs/restaurant-tables-design.zh.md`](docs/restaurant-tables-design.zh.md)；转台/并台见 [`docs/table-transfer-merge-plan.zh.md`](docs/table-transfer-merge-plan.zh.md)。

---

## 后厨与服务员看板（实时与会话）

- **员工账号登录**（或 **店主**从后台侧边栏打开看板，**同一浏览器会话**无需再录员工密码）后，页面通过 **Supabase Realtime** 订阅 `orders` 与 `table_sessions`，并在进入时 **立即拉取** 最新数据（未满足则跳转到 `/[slug]/staff/login`）。
- **仅展示活跃餐次下的订单**：`table_sessions` 为 `open` 或 `billing` 时，对应 `orders.session_id` 会出现在后厨与服务员看板；餐次关闭后，这些订单从两页看板消失（无需整页刷新）。
- **服务员「关台」**：当该桌没有「制作中」且没有「可端菜」时，可结束当前餐次（`closed_reason = waiter_closed`），用于未开做前撤台、错台等；已有出餐中的桌台需先跟随后厨流程或逐单处理。详见 [`docs/table-transfer-merge-plan.zh.md`](docs/table-transfer-merge-plan.zh.md) 中「服务员关台与看板可见性」。
- **员工账号（替换 PIN）**：Hub「员工管理」`/dashboard/settings/staff`；实施顺序与 CRUD/API/RLS 约定见 [`docs/staff-accounts-plan.md`](docs/staff-accounts-plan.md)。

---

## Vercel 部署步骤

### 1. 推送代码到 GitHub

```bash
git init && git add . && git commit -m "init"
git remote add origin <your-github-repo>
git push -u origin main
```

### 2. 在 Vercel 导入项目（monorepo：两个 Project）

仓库为 npm workspaces：`apps/web`（租户产品）+ `apps/ops`（运营后台）。**同一 `main` 分支、两个独立 Vercel Project**，互不影响构建与回滚。详见 [`docs/monorepo-vercel.zh.md`](docs/monorepo-vercel.zh.md)。

**mesa-web（现有生产项目 — 须改 Root Directory）**

1. Vercel → 现有项目 → Settings → General → **Root Directory** → `apps/web` → Save  
2. Redeploy Production 一次  
3. Environment Variables（与原先相同，域名改为租户域名）：
   - `NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY`、`NEXT_PUBLIC_BASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`（按需）、`CRON_SECRET` 等  
   - **不要**在此项目配置 `ADMIN_BOOTSTRAP_SECRET`（归 ops 项目）

**mesa-ops（新建）**

1. New Project → 同一 GitHub 仓库 → Root Directory **`apps/ops`**  
2. Production Branch：`main`  
3. 环境变量：`SUPABASE_SERVICE_ROLE_KEY`、`ADMIN_BOOTSTRAP_SECRET`、Supabase URL/anon key 等（见运营计划文档）

两个项目的 `vercel.json` 已配置 `ignoreCommand`：仅改 `apps/ops` 时跳过 web 构建，反之亦然。

### 3. 部署后更新 Supabase

在 Supabase → Authentication → URL Configuration 中将 Site URL 更新为 Vercel 域名。

---

## 快速使用流程

1. 配置 `SUPABASE_SERVICE_ROLE_KEY` 与 `ADMIN_BOOTSTRAP_SECRET`，在运营后台 `/ops/bootstrap` 创建首个运营账号，再在 `/ops/restaurants/new` 创建店主与餐厅（见 [`docs/platform-admin-plan.zh.md`](docs/platform-admin-plan.zh.md)）。
2. 店主在 `/auth/login` 登录，在 `/dashboard/settings/menu` 添加菜品
3. 在 `/dashboard/tables` 生成桌位二维码并打印
4. 在 `/dashboard/settings/staff` **创建厨房 / 服务员员工账号**（每人 **`{登录名}@mesa.in`** + 初始密码；登录名全平台唯一）
5. 在 `/dashboard/tables` 下载或打印 **桌位二维码** 与 **`/[slug]/staff/login` 员工登录二维码**
6. 员工用手机打开 **`/[slug]/staff/login`**，用登录名（或完整邮箱）+ 密码登录；首次或重置后须完成 **`/auth/staff/change-password`**
7. 再打开 **`/[slug]/kitchen`** 或 **`/[slug]/waiter`** 进入对应看板（角色不匹配会提示错误）
8. 顾客扫描二维码点餐，加单会追加到同一餐次
9. 顾客下单后可随时进入账单页，金额按该餐次实际下单总额计算
10. 服务端确认收款并关台后，顾客刷新账单页会自动回到点单页
