# 数据库迁移执行手册（dev / staging / cloud）

新增或修改 `supabase/migrations/*.sql` 并合并到 `main` 后，按本手册把迁移应用到三个环境。

## 环境对照

| 环境 | 用途 | Supabase 项目 | project-ref | Next 启动命令 | 环境文件 |
|------|------|---------------|-------------|---------------|----------|
| **dev** | 本机 Docker Supabase | 本地实例 | — | `npm run dev` | `.env.local.dev` |
| **staging** | 联调 / 预发 | restaurant-ordering-dev | `mnvqmrrvbqwuxfxlewdm` | `npm run stage` | `.env.local.supabase` |
| **cloud** | 生产（Vercel Production） | restaurant-ordering | `spgnhkaqtsbytvletpdm` | `npm run cloud` | `.env.local` |

约定：

- 迁移文件只追加在 `supabase/migrations/`，**不要改已应用过的历史文件**。
- 同一变更需同步更新 `docs/ai-schema.md`。
- 应用顺序建议：**dev → staging → cloud**（先在本地验证，再上联调，最后生产）。

## 前置条件（每次执行前）

```bash
# 1. 在仓库根目录
cd /path/to/restaurant-ordering

# 2. 已登录 Supabase CLI（只需做一次，过期再 login）
supabase login

# 3. 本地 dev 需要 Docker 里的 Supabase 在跑
supabase start          # 未启动时
bash scripts/sync-local-supabase-env.sh   # 可选：刷新 .env.local.dev 里的 URL/keys
```

确认有待推送的迁移：

```bash
ls -1 supabase/migrations | tail -3
```

---

## 一、dev（本机 Docker）

```bash
cd /path/to/restaurant-ordering

# 确保本地栈运行
supabase status

# 应用尚未执行的迁移（不删数据）
supabase migration up --local
```

若需要**清空本地业务数据并从头灌 seed**（慎用，仅本地）：

```bash
supabase db reset
```

### dev 验证

```bash
# 看本地与迁移目录是否对齐
supabase migration list --local | tail -5

# 抽查新表/函数（示例：session_collected_payments）
docker run --rm postgres:17 psql \
  "postgresql://postgres:postgres@host.docker.internal:54322/postgres" \
  -c "\d session_collected_payments"
```

---

## 二、staging（联调库）

```bash
cd /path/to/restaurant-ordering

supabase link --project-ref mnvqmrrvbqwuxfxlewdm --yes
supabase db push --yes
```

### staging 验证

```bash
supabase migration list | tail -5
# Local 与 Remote 列应一致，最新时间戳 migration 两边都有
```

联调前端：

```bash
npm run stage   # 读取 .env.local.supabase，应指向 staging 项目
```

**若 push 失败 `status=INACTIVE`**：到 Supabase Dashboard 恢复/解冻 staging 项目后重试。

---

## 三、cloud（生产库）

```bash
cd /path/to/restaurant-ordering

supabase link --project-ref spgnhkaqtsbytvletpdm --yes
supabase db push --yes
```

CLI 会列出待应用 migration 并确认；加 `--yes` 可非交互执行。

### cloud 验证

```bash
supabase migration list | tail -5
```

生产 Web：推 `main` 后等 Vercel Production Ready（见 `docs/ci-and-release.zh.md`）。**仅 db push 不算 Web 已上线**。

---

## 四、一键检查三环境（推送后）

在仓库根执行：

```bash
# 本地
supabase migration list --local | tail -3

# staging
supabase link --project-ref mnvqmrrvbqwuxfxlewdm --yes >/dev/null
supabase migration list | tail -3

# cloud
supabase link --project-ref spgnhkaqtsbytvletpdm --yes >/dev/null
supabase migration list | tail -3
```

期望：三个环境 Remote（或 local）均包含最新 migration 文件名时间戳。

---

## 五、常见问题

| 现象 | 处理 |
|------|------|
| `IPv6 is not supported...` | 先 `supabase link --project-ref <ref> --yes`，再 `db push`；或升级 CLI |
| `Remote database is up to date` | 该环境已应用，无需重复 push |
| migration 与远端历史冲突 | **不要**改旧 migration；新建时间戳 migration 修复；必要时联系人工对账 `supabase_migrations.schema_migrations` |
| 新 migration 时间戳早于已应用文件 | 使用 `migration up --local --include-all` 与 `db push --yes --include-all` |
| 需要 staging 数据与 cloud 一致 | 用 `scripts/sync-cloud-to-staging.sh`（会先 `db push` 再覆写数据，见脚本注释） |

---

## 六、本次执行记录（2026-06-29）

迁移：`20260710120000_resume_ordering_preserve_by_item_split.sql`（按菜分单恢复点单始终保留 `bill_splits` 为 `confirmed`）

| 环境 | 命令 | 结果 |
|------|------|------|
| dev | `supabase migration up --local --include-all` | 已应用 `20260710120000`；RPC 含 `v_preserve_split`（`by_item` 或部分收款 → `confirmed`） |
| staging | `link mnvqmrrvbqwuxfxlewdm` + `db push --yes` | Remote 已含 `20260710120000` |
| cloud | `link spgnhkaqtsbytvletpdm` + `db push --yes` | Remote 已含 `20260710120000` |

CLI 当前 link：**cloud**（`spgnhkaqtsbytvletpdm`）。

---

## 六（历史）、2026-06-29 — 部分收款恢复点单

迁移：`20260629130000_resume_ordering_preserve_partial_split.sql`（部分收款恢复点单保留 `bill_splits` 为 `confirmed`）

| 环境 | 命令 | 结果 |
|------|------|------|
| dev | `supabase migration up --local --include-all` | 已应用 `20260629130000`；RPC `resume_table_session_ordering` 含 `v_has_partial_payment` 分支 |
| staging | `link mnvqmrrvbqwuxfxlewdm` + `db push --yes --include-all` | Remote 已含 `20260629130000` |
| cloud | `link spgnhkaqtsbytvletpdm` + `db push --yes --include-all` | Remote 已含 `20260629130000` |

说明：该 migration 时间戳早于已应用的 `20260709120000`，须加 **`--include-all`** 才能 push。

---

## 六（历史）、2026-06-29 — session_collected_payments

迁移：`20260709120000_session_collected_payments_resume_ordering.sql`

| 环境 | 命令 | 结果 |
|------|------|------|
| dev | `supabase migration up --local` | 已是最新（表 `session_collected_payments` 已存在） |
| staging | `link mnvqmrrvbqwuxfxlewdm` + `db push --yes` | Remote 已含 `20260709120000` |
| cloud | `link spgnhkaqtsbytvletpdm` + `db push --yes` | 已应用 `20260709120000` |

CLI 当前 link：**cloud**（`spgnhkaqtsbytvletpdm`）。若需联调 staging 可 `link mnvqmrrvbqwuxfxlewdm`。

---

## 七、新 migration 标准流程（ checklist ）

1. [ ] 编写 `supabase/migrations/<timestamp>_*.sql`
2. [ ] 更新 `docs/ai-schema.md`
3. [ ] 本地 `supabase migration up --local` + 抽查表/RPC
4. [ ] staging `db push --yes`
5. [ ] cloud `db push --yes`
6. [ ] `npm run lint` / `npm run build`（若改了 web）
7. [ ] 推 `main`，确认 Vercel Production Ready
