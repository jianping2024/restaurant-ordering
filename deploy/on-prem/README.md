# Mesa on-prem (门店纯本地)

> **客户交付路径 = Mode B + Ubuntu `install-ubuntu.sh`（首选）或 Windows ⑤a 安装器**  
> Mode A（`compose.mode-a.yaml`）仅开发机捷径。

## 打包 / 初装 / 升级

**完整正确流程（唯一说明）：** [`docs/technical/on-prem-pack-install-upgrade.zh.md`](../../docs/technical/on-prem-pack-install-upgrade.zh.md)

摘要：

```bash
# 开发机打 stamped zip（初装与升级同一包）
./deploy/on-prem/scripts/pack-release.sh
# → dist/mesa-on-prem-<sha>-<UTC>.zip（勿只认 latest）

# 店内解压约定：/home/remoteadmin/mesa-on-prem-<ver>/

# 初装
cd /home/remoteadmin/mesa-on-prem-<ver> && sudo ./install-ubuntu.sh

# 升级（必须 MESA_HOME，且不要 SkipBuild）
export MESA_HOME=/opt/mesa
cd /opt/mesa/current/deploy/on-prem
sudo -E ./scripts/upgrade.sh /home/remoteadmin/mesa-on-prem-<ver>
```

正式入口：`http://<店内IP>/`（edge `:80`）。桌位二维码用局域网 IP 或公网域打开后台再生成，勿用 localhost。

- Ubuntu 说明副本：`linux/README-INSTALL.zh.txt`（打进包根 `README-UBUNTU.zh.txt`）
- 卸载：`linux/uninstall-mesa.sh`（默认保留数据）

## Windows 安装包（⑤a）

在目标机（管理员 PowerShell）：

```powershell
cd mesa-on-prem-<ver>\deploy\on-prem\windows
powershell -ExecutionPolicy Bypass -File .\Install-Mesa.ps1
# 或指定目录（任意盘）:
.\Install-Mesa.ps1 -MesaHome D:\Mesa -NonInteractive
```

- **MESA_HOME** 用户可选（默认 `%ProgramData%\Mesa`）；数据/日志/配置只认这一份根目录。
- 说明：`windows/README-INSTALL.zh.txt`
- 诊断：`Diagnose-Mesa.ps1`；卸载服务：`Uninstall-Mesa.ps1`（默认保留数据）

## Mode B（开发机 / 已有 Docker）

```bash
chmod +x scripts/*.sh
./scripts/bootstrap-mode-b.sh
./scripts/stack.sh pull
./scripts/stack.sh up
./scripts/apply-migrations.sh
./scripts/stack.sh up web
```

内部一律用 `./scripts/stack.sh`。

### 环境变量（Mode B）

| 变量 | 含义 |
|------|------|
| `SUPABASE_PUBLIC_URL` | 浏览器/Tunnel 同域入口（edge，默认 `http://127.0.0.1`，**不是** `:8000`） |
| `SUPABASE_URL`（compose 注入） | 容器内 `http://kong:8000`（仅服务端） |
| `NEXT_PUBLIC_MESA_SUPABASE_SAME_ORIGIN` | `1` 时浏览器用 `window.location.origin` |
| `SITE_URL` | Auth 站点 URL = edge origin |
| `ADDITIONAL_REDIRECT_URLS` | 含局域网 origin；可选 `MESA_TUNNEL_ORIGIN` 公网域 |
| `MESA_ON_PREM=1` | 开启 `/setup` 等本机安装行为 |
| `MESA_EDGE_PORT` | 同域网关端口，默认 `80` |
| `MESA_PLATFORM_LICENSE_URL` | 云 Ops 根 URL |
| `MESA_LICENSE_CHECKIN_CREDENTIAL` | claim 返回的 check-in 凭证 |
| `MESA_LICENSE_LEASE_SECRET` | 与云 Ops 相同的 lease HMAC 密钥 |

SaaS / Vercel **不要**设 `MESA_ON_PREM` 或 `NEXT_PUBLIC_MESA_SUPABASE_SAME_ORIGIN`。

主入口：`http://<店内IP>/`（edge）。Cloudflare Tunnel 指到本机 `:80`。直接 `:3000`/`:8000` 仅调试。

### 服务授权（ADR-004）

- 营业闸门仍是本机 `restaurants.suspended_at`（一种表示）。
- 店主登录仪表盘时：有网则向平台 check-in 拉 lease → materialize 暂停/到期；断网只认已落盘 lease。
- 平台 ops：`/ops/licenses` 续期 / 暂停 / 签发安装码。
- Mode B 迁移：`apply-migrations.sh` 含 `deployment_mode` / `restaurant_installations` / lease 列。

### 备份与恢复（⑥a）

```bash
./scripts/backup-local.sh          # 本机 snapshot → backups/<UTC>/
./scripts/restore-local.sh [--Force] backups/<stamp>
```

- 无 `config/backup.env`（见 `config/backup.env.example`）时：**只本地成功**，上传标记 `skipped`。
- 配置 `RESTIC_REPOSITORY` + `RESTIC_PASSWORD`（及 S3 凭证）后自动 restic 上传；失败为 `pending_retry`，**不挡营业**。
- Windows：`Backup-Mesa.ps1` / `Restore-Mesa.ps1` / 安装器注册 `MesaOnPremBackup`（每天 03:00）。

### 升级与回滚（⑦a）

详见 [`docs/technical/on-prem-pack-install-upgrade.zh.md`](../../docs/technical/on-prem-pack-install-upgrade.zh.md) §3。

```bash
export MESA_HOME=/opt/mesa   # 必须，否则不同步 apps/web
cd /opt/mesa/current/deploy/on-prem
sudo -E ./scripts/upgrade.sh /home/remoteadmin/mesa-on-prem-<ver>/
./scripts/rollback.sh              # 仅文件回滚；已跑迁移则拒绝
```

- 版本事实：`config/current.json`（或 Mode B 开发态 `deploy/on-prem/current.json`）+ `logs/LAST_UPGRADE.json`。
- 升：备份 → `releases/<ver>` → 同步（保留 `.env`）→ 增量迁移 → rebuild web → `/api/health/live`+`ready`。
- **不**自动升 Supabase vendor 大版本（见 `images.lock`）。
- 迁移已应用后的失败：用 `restore-local` / `Restore-Mesa`，不要假装文件回滚等于库回滚。
- Windows：`Upgrade-Mesa.ps1 -SourcePack …` / `Rollback-Mesa.ps1`。

## Mode A（仅开发）

```bash
supabase start
./scripts/generate-env.mode-a.sh
docker compose -f compose.mode-a.yaml up --build -d web
```

## 打印

Windows `MesaPrintAgent`：服务器地址填店内 edge origin（`http://<店内IP>/`，勿填手机侧的 localhost）。

## 目录

| 路径 | 说明 |
|------|------|
| `linux/install-mesa.sh` | Ubuntu / Debian 客户安装器 |
| `edge/Caddyfile` | 同域网关：`/` → web，`/auth/v1|/rest/v1|/realtime/v1|…` → Kong（勿用宽 `/auth/*`） |
| `windows/Install-Mesa.ps1` | Windows ⑤a 主安装器 |
| `compose.yaml` + `scripts/stack.sh` | Mode B |
| `compose.mode-a.yaml` | Mode A |
| `vendor/supabase-docker/` | 官方自托管 Compose |
| `schema/baseline_public.sql` | Mode B schema baseline |
