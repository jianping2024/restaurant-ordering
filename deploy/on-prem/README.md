# Mesa on-prem（门店纯本地 · Web 栈）

> **客户交付路径 = Mode B + Ubuntu `install-ubuntu.sh`**  
> **店机 OS：Ubuntu 22.04 / 24.04 LTS + Docker Engine**（原生 Linux，**不作废的 Windows/WSL 全栈安装**）。  
> **打印：** 另机 Windows `MesaPrintAgent`（见 §打印）；不进本目录安装器。  
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

**Web 运行日志：** `compose.yaml` 中 `web` 使用 json-file `max-size=20m` / `max-file=5`（约 100MB 环形）。后台管理员可在设置「系统日志」按时间段+关键字查询；容器只读挂载 `docker.sock` 供该 API 读 Engine logs（应用仍只打 stdout，不另写第二份文件）。

**Auth 多入口白名单（易漏）：** 见上文档 **§2.1**。配置 `$MESA_HOME/current/deploy/on-prem/.env` 的 `ADDITIONAL_REDIRECT_URLS`（`http://<IP>/**` + 可选局域网名 + 公网 `https://域/**`）；改完 `mesa-stack up -d --force-recreate auth`。仅有 `SITE_URL`、后装 Tunnel 时务必补白名单。

**Print Agent 服务器地址：** 见上文档 **§2.2**。推荐 `http://<店内IP>`（edge，无 `:3000`）；勿 `localhost`；勿把公网域当店内主配置。

**Realtime publication：** §2.3。`pack-release` / `apply-migrations` 每次 ensure；缺则打包失败。

升级慢 / `npm ci` 缓存 / 勿在 shell 敲 `RUN …`：见上文档 **§3.1**。

- Ubuntu 说明副本：`linux/README-INSTALL.zh.txt`（打进包根 `README-UBUNTU.zh.txt`）
- 卸载：`linux/uninstall-mesa.sh`（默认保留数据）
- 开机拉栈：`mesa-on-prem.service`（`install-mesa.sh` 安装）
- 日切：`mesa-daily-cutover.timer`（Lisbon 05:05 → `scripts/daily-cutover.sh`：夜间关台 → 本机 backup）

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
| `SITE_URL` | Auth 站点 URL = 局域网 edge origin（无尾斜杠） |
| `ADDITIONAL_REDIRECT_URLS` | Auth 回调白名单：`origin/**` 逗号分隔；须含店内 IP，有 Tunnel/局域网名则一并写入（见 §2.1） |
| `MESA_TUNNEL_ORIGIN` | 可选；仅 bootstrap 时自动并入白名单。后装 Tunnel 须手改 `ADDITIONAL_REDIRECT_URLS` |
| `MESA_ON_PREM=1` | 开启 `/setup` 等本机安装行为 |
| `MESA_EDGE_PORT` | 同域网关端口，默认 `80` |

## 备份与恢复（⑥）

```bash
export MESA_HOME=/opt/mesa
./scripts/backup-local.sh
./scripts/restore-local.sh [--Force] backups/<stamp>
```

- 无 `config/backup.env`（见 `config/backup.env.example`）时：**只本地成功**，上传标记 `skipped`。
- 配置 `RESTIC_REPOSITORY` + `RESTIC_PASSWORD`（及 S3 凭证）后自动 restic 上传；失败为 `pending_retry`，**不挡营业**。
- 店机用 cron / systemd timer 调度（Ubuntu）；**已删除** Windows `MesaOnPremBackup` 计划任务路径。

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
- 迁移已应用后的失败：用 `restore-local`，不要假装文件回滚等于库回滚。

## Mode A（仅开发）

```bash
supabase start
./scripts/generate-env.mode-a.sh
docker compose -f compose.mode-a.yaml up --build -d web
```

## 打印

Windows `MesaPrintAgent`「服务器地址」= 店内 Mesa 正式入口（与后台同源）。详见 [`docs/technical/on-prem-pack-install-upgrade.zh.md`](../../docs/technical/on-prem-pack-install-upgrade.zh.md) **§2.2**。

- **推荐：** `http://<店内IP>`（edge `:80`，无 `:3000`）
- **可选：** 已解析的局域网名（如 `http://pirata.lan`）
- **禁止：** `localhost` / `127.0.0.1`（Agent 在另一台机时）
- **勿作店内主配置：** 公网 Tunnel 域（断外网/Tunnel 则打印断）

Agent 安装包与发布流程在 `apps/print-agent` / GitHub Release，**不**经本目录 Windows Web 安装器（该路径已移除）。

## 目录

| 路径 | 说明 |
|------|------|
| `linux/install-mesa.sh` | Ubuntu / Debian 客户安装器 |
| `edge/Caddyfile` | 同域网关：`/` → web，`/auth/v1|/rest/v1|/realtime/v1|…` → Kong（勿用宽 `/auth/*`） |
| `compose.yaml` + `scripts/stack.sh` | Mode B |
| `compose.mode-a.yaml` | Mode A |
| `vendor/supabase-docker/` | 官方自托管 Compose |
| `schema/baseline_public.sql` | Mode B schema baseline |
