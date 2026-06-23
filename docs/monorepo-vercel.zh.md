# Monorepo 与 Vercel 双项目部署

> 状态：已落地目录结构（2026-06-23）  
> 关联：[`platform-admin-plan.zh.md`](./platform-admin-plan.zh.md)

## 仓库布局

```text
restaurant-ordering/
├── apps/
│   ├── web/           @mesa/web   — 租户产品（顾客 / 店主 / 员工）
│   ├── ops/           @mesa/ops   — Mesa 运营后台
│   └── print-agent/   Go 打印代理（GitHub Release，不上 Vercel）
├── packages/
│   └── shared/        @mesa/shared — web 与 ops 共用代码
├── package.json       npm workspaces 根
└── supabase/
```

根目录执行 `npm ci` 安装全部 workspace；日常开发仍在仓库根：

```bash
npm run dev        # apps/web :3000
npm run dev:ops    # apps/ops  :3001
npm run build      # 仅 web
npm run build:ops  # 仅 ops
```

环境文件（`.env.local.dev` 等）仍放在 **仓库根**，`scripts/dev-env.sh` 会 `source` 后进入对应 app 启动 Next。

## Vercel：两个 Project，同一 `main`

| | **mesa-web** | **mesa-ops** |
|--|--------------|--------------|
| Root Directory | `apps/web` | `apps/ops` |
| 域名示例 | `app.example.com` | `ops.example.com` |
| Cron | 有（关台等，见 `apps/web/vercel.json`） | 无 |
| `ignoreCommand` | `scripts/vercel-ignore-web.sh` | `scripts/vercel-ignore-ops.sh` |
| Install | `cd ../.. && npm ci`（已在各 app `vercel.json`） | 同左 |

### 已有租户生产项目迁移（必做）

若 Vercel 项目是在 monorepo 迁移 **之前** 创建的（Root Directory 为空 = 仓库根）：

1. 打开 Vercel → **mesa-web** → Settings → General  
2. **Root Directory** 设为 `apps/web` → Save  
3. 触发 **Redeploy** Production  
4. 确认 Cron、环境变量、自定义域名仍正常  

未改 Root Directory 时，Vercel 会在仓库根找 `package.json`，**构建会失败**（Next 已迁至 `apps/web`）。

### 新建 mesa-ops

1. New Project → 同一 GitHub 仓库  
2. Root Directory：`apps/ops`  
3. Framework：Next.js（读取 `apps/ops/vercel.json`）  
4. 配置运营侧环境变量（`SUPABASE_SERVICE_ROLE_KEY`、`ADMIN_BOOTSTRAP_SECRET` 等）  
5. 绑定独立域名（建议 `ops.*`，与租户站隔离 Cookie）

### Ignored Build Step 行为

- 只改 `apps/web/**` → 仅 mesa-web 构建  
- 只改 `apps/ops/**` → 仅 mesa-ops 构建  
- 改 `packages/shared/**` → **两个都构建**  
- 只改 `apps/print-agent/**` 或仅 `docs/**` → **两个都跳过**  

脚本在仓库根 `scripts/vercel-ignore-*.sh`；`vercel.json` 内 `ignoreCommand` 从 **仓库根** 执行。

## 环境变量拆分建议

| 变量 | mesa-web | mesa-ops |
|------|----------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | ✅ |
| `NEXT_PUBLIC_BASE_URL` | 租户域名 | ops 域名 |
| `SUPABASE_SERVICE_ROLE_KEY` | 按需（API） | ✅ |
| `ADMIN_BOOTSTRAP_SECRET` | ❌ | ✅ |
| `CRON_SECRET` | ✅ | ❌ |

## CI

GitHub Actions `ci.yml` 在根目录 `npm ci` 后分别 `npm run build:web` 与 `npm run build:ops`。
