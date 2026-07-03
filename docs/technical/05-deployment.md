# 部署与运行环境

> **状态**：阶段 5 已填充（2026-06-30）  
> **读者**：开发、运维、AI 代理

## 用途

本地启动、生产部署、离线能力、外部依赖、数据存储、打印机连接与备份风险。

---

## 1. 本地如何启动

环境文件在**仓库根**（勿提交真实密钥）：

| 文件 | 用途 |
|------|------|
| `.env.local.dev` | 本地 Docker Supabase（`npm run dev`） |
| `.env.local.supabase` | 云 stage 项目（`npm run stage`） |
| `.env.local` | 云生产/个人（`npm run cloud`） |

| 命令 | 端口 | 说明 |
|------|------|------|
| `npm run dev` | 3000 | `@mesa/web`，`0.0.0.0` |
| `npm run dev:ops` | 3001 | `@mesa/ops` |
| `npm run stage` / `npm run cloud` | 3000 | 连云 Supabase |
| `npm run print` | — | print-agent Docker 开发重建 |
| `npm run printstop` / `npm run printlog` | — | 代理容器停/日志 |
| `supabase start` + `supabase db push` | — | 本地 DB（需 `supabase link` 用于云迁移） |

**Go 本地**：须用 Docker（见 `AGENTS.md`），勿假设本机安装 Go。

---

## 2. 生产部署

### 2.1 Web（租户）

| 项 | 值 |
|----|-----|
| 平台 | Vercel 项目 **mesa-web** |
| Root Directory | `apps/web` |
| 分支 | `main` → Production |
| 构建 | `npm ci`（根）+ `npm run build` |
| Preview | PR 门禁检查名 **`Vercel`** |
| 推送 | `pnpm push` → 自动 commit + push `main` |

### 2.2 Ops（运营）

| 项 | 值 |
|----|-----|
| 平台 | Vercel 项目 **mesa-ops** |
| Root Directory | `apps/ops` |
| 域名 | 独立子域（与租户 Cookie 隔离） |

### 2.3 数据库

| 项 | 值 |
|----|-----|
| 托管 | Supabase Postgres |
| 迁移 | `supabase db push`（link 后）或 Supabase Dashboard |
| RLS | 全租户隔离；迁移见 `supabase/migrations/` |

### 2.4 Print Agent

| 项 | 值 |
|----|-----|
| 产物 | `MesaPrintAgent-Setup-amd64.exe`（GitHub Release） |
| 标签 | `print-agent-v{VERSION}`，`VERSION` = `apps/print-agent/VERSION` |
| CI | `print-agent-ci.yml`（推 main）；`print-agent-release.yml`（推 tag） |
| 发版前 | `./scripts/check-print-agent.sh` 或 bump VERSION + `pnpm push` 自动 tag |

**注意**：合并 `main` ≠ 可下载安装包；须 **Release 成功** 且含 exe。

### 2.5 Ignored Build Step

`scripts/vercel-ignore-web.sh` / `vercel-ignore-ops.sh`：

- 仅改 `print-agent` 或 `docs` → 常跳过 web/ops 构建  
- 改 `packages/shared` → **两个** Vercel 项目都构建  

详见 [`../monorepo-vercel.zh.md`](../monorepo-vercel.zh.md)。

---

## 3. 是否支持离线

| 组件 | 离线能力 |
|------|----------|
| Web / API | **否**，依赖在线 Supabase 与 Vercel |
| 顾客点餐 | 需网络；无 PWA 离线缓存 |
| print-agent | 本地进程 + 局域网打印机；**仍须**轮询云端 `print_jobs` |
| 私有化 | 中长期见 [`../local-on-premise-deployment-plan.md`](../local-on-premise-deployment-plan.md) |

结论：**在线 SaaS**；仅打印执行在门店局域网侧。

---

## 4. 依赖的外部服务

| 服务 | 用途 |
|------|------|
| Supabase | Auth、Postgres、RLS、Realtime、Storage（`menu-images`） |
| Vercel | Hosting、Cron、Serverless Functions |
| GitHub | 源码、Actions、Release 安装包 |
| （可选）Vercel 外无 Stripe/支付网关 | 结账为店内确认收款 |

---

## 5. 数据如何存储

| 环境 | 存储 |
|------|------|
| 生产 | Supabase Postgres（多租户 RLS） |
| 文件 | Supabase Storage `menu-images`（公开读，店主/前台写） |
| 本地开发 | Docker Supabase 或链接云 dev/stage 项目 |
| print-agent 本地 | Windows 配置文件、加密 token（用户 AppData） |

**无**应用层 Redis；限流部分用内存（`in-memory-rate-limit.ts`，单实例）。

---

## 6. 打印机如何连接

| 方式 | 说明 |
|------|------|
| LAN TCP | ESC/POS  raw socket；代理 `sink_tcp.go` |
| Windows USB | WinSpool RAW；`sink_winspool_windows.go` |
| 配对 | Dashboard → 打印助手 → 六位码 → 代理向导 |
| 档口映射 | 代理同步 `print_stations` routing；菜品按 `print_station_id` 分单 |
| 纸宽 | 首期 **80mm** |

打印机须与运行 print-agent 的 Windows  PC 可达；DHCP 保留私网 IP 见运维文档。

---

## 7. Cron 与定时任务

`apps/web/vercel.json`：

| 路径 | 调度（UTC） | 职责 |
|------|-------------|------|
| `/api/cron/nightly-close-sessions` | `0 4 * * *`、`0 5 * * *` | 批量关台（`auto_nightly`） |

鉴权：`CRON_SECRET` 环境变量。

---

## 8. 环境变量（摘要）

### mesa-web

| 变量 | 必需 | 说明 |
|------|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅（API） | 勿暴露客户端 |
| `CRON_SECRET` | ✅（Cron） | |
| `NEXT_PUBLIC_BASE_URL` | 推荐 | 绝对 URL 生成 |

### mesa-ops

| 变量 | 说明 |
|------|------|
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ |
| `ADMIN_BOOTSTRAP_SECRET` | 首次引导 |
| `NEXT_PUBLIC_TENANT_APP_URL` | 租户站链接 |

完整拆分：[`../monorepo-vercel.zh.md`](../monorepo-vercel.zh.md)。

---

## 9. 备份、恢复与迁移风险

| 风险 | 说明 |
|------|------|
| Supabase 备份 | 依赖 Supabase 项目备份策略；无应用内自助恢复 |
| 迁移顺序 | `migrations/` 有序；**禁止**改已应用历史 |
| 新约束上线 | 如 `bill_splits.cancelled` 须先 `db push` 再部署写代码 |
| 租户隔离 | 恢复/导出须按 `restaurant_id`；禁止跨店 restore |
| print-agent 版本 | 旧代理与新 payload 不兼容时需同步发版 |
| 直推 main | GitHub ruleset 可能阻止；用 PR 或临时调整 ruleset |

迁移操作手册：[`../db-migration-runbook.zh.md`](../db-migration-runbook.zh.md)。

---

## 10. 中长期部署选项（未实施）

| 方案 | 文档 |
|------|------|
| 自建 Postgres 替代 Supabase | [`../supabase-to-postgres-migration.zh.md`](../supabase-to-postgres-migration.zh.md) |
| 门店私有化一体机 | [`../local-on-premise-deployment-plan.md`](../local-on-premise-deployment-plan.md) |
| 其他 SaaS 托管 | [`../saas-hosting-alternatives.zh.md`](../saas-hosting-alternatives.zh.md) |

---

## 相关文档

- [`01-architecture.md`](./01-architecture.md)
- [`04-printing.md`](./04-printing.md)
- [`../ci-and-release.zh.md`](../ci-and-release.zh.md)
- [`../monorepo-vercel.zh.md`](../monorepo-vercel.zh.md)
