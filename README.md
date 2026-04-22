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

打开 `.env.local`，填入你的 Supabase 配置（见下方 Supabase 初始化步骤）。

### 3. 启动开发服务器

```bash
npm run dev
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

在 Supabase Dashboard → SQL Editor 中，将 `supabase/migrations/20240101000000_initial_schema.sql` 的内容粘贴并执行。

### 4. （可选）插入示例数据

执行 `supabase/seed.sql`，但需先将文件中 `owner_id` 替换为真实注册用户的 user id。

### 5. 配置 Supabase Auth

在 Supabase Dashboard → Authentication → URL Configuration：
- Site URL：填入 `http://localhost:3000`

---

## 页面路由

| 路径 | 说明 |
|------|------|
| `/` | 产品落地页 |
| `/auth/login` | 登录 |
| `/auth/register` | 注册（同时创建餐厅） |
| `/dashboard` | 餐厅后台概览 |
| `/dashboard/menu` | 菜单管理 |
| `/dashboard/tables` | 桌位二维码管理 |
| `/dashboard/orders` | 订单历史 |
| `/dashboard/settings` | 餐厅设置（含厨房密码） |
| `/[slug]/menu?table=N` | 顾客点餐页（手机端） |
| `/[slug]/kitchen` | 厨房显示页（需密码） |
| `/[slug]/bill?table=N` | 账单分单页 |

---

## Vercel 部署步骤

### 1. 推送代码到 GitHub

```bash
git init && git add . && git commit -m "init"
git remote add origin <your-github-repo>
git push -u origin main
```

### 2. 在 Vercel 导入项目

1. 前往 [vercel.com](https://vercel.com) → New Project → 导入 GitHub 仓库
2. 在 Environment Variables 中添加三个变量：
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_BASE_URL`（填 Vercel 域名，如 `https://your-app.vercel.app`）
3. 点击 Deploy

### 3. 部署后更新 Supabase

在 Supabase → Authentication → URL Configuration 中将 Site URL 更新为 Vercel 域名。

---

## 快速使用流程

1. 注册账号 `/auth/register`
2. 在 `/dashboard/menu` 添加菜品
3. 在 `/dashboard/tables` 生成桌位二维码并打印
4. 在 `/dashboard/settings` 设置 4 位厨房密码
5. 打开 `/[slug]/kitchen` 输入密码进入厨房显示
6. 顾客扫描二维码即可点餐
