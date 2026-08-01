# On-prem：打升级包 / 初装包与装机升级流程

> 门店 Mode B（Ubuntu 默认 `/opt/mesa`）的**唯一操作说明**。  
> 打包脚本：`deploy/on-prem/scripts/pack-release.sh`；升级：`deploy/on-prem/scripts/upgrade.sh`。  
> 初装细节补充见包内 `README-UBUNTU.zh.txt`（源：`deploy/on-prem/linux/README-INSTALL.zh.txt`）。

## 1. 开发机：打发行包（初装与升级用同一 zip）

初装包和升级包是**同一种 stamped zip**（内含 `apps/web`、`deploy/on-prem`、migrations、`manifest.json`）。差别只在目标机上跑「安装」还是「升级」。

在**仓库根目录**（已 checkout 要发布的 `main` 提交）：

```bash
chmod +x deploy/on-prem/scripts/pack-release.sh
./deploy/on-prem/scripts/pack-release.sh
```

打包门禁（脚本会硬失败）：`ensure_realtime_publication` 接线；`apps/web/Dockerfile` BuildKit npm cache；禁止 `menuImageSameOriginEnabled(process.env)`；Mode B Auth Cookie 四处必须 `getSupabaseAuthCookieOptions`（§2.3 / §3.1）；`NEXT_PUBLIC_PRINT_AGENT_GITHUB_REPO` ARG/ENV + `apps/print-agent/VERSION` COPY；**且** `upgrade.sh` / `install-mesa.sh` 必须把 `VERSION` 同步进 `$MESA_HOME/current`（否则店机 `--build web` 会报 `COPY …/VERSION: not found`）。

产物：

| 文件 | 用途 |
|------|------|
| `dist/mesa-on-prem-<git短sha>-<UTC>.zip` | **唯一正式包名**（交给客户 / 升级） |
| `dist/mesa-on-prem-LATEST-NAME.txt` | 记录上述正式文件名 |
| `dist/mesa-on-prem-latest.zip` | 便利拷贝，**易被覆盖，勿当唯一依据** |

解压后目录名 = zip 去掉 `.zip`；根目录有 `PACK-ID.txt`、`install-ubuntu.sh`、`manifest.json`。

店内解压落盘约定（本项目现场）：

```text
/home/remoteadmin/mesa-on-prem-<ver>/
```

拷贝示例：

```bash
scp dist/mesa-on-prem-<ver>.zip remoteadmin@<店内IP>:/home/remoteadmin/
ssh remoteadmin@<店内IP>
cd /home/remoteadmin
unzip -o mesa-on-prem-<ver>.zip
# → /home/remoteadmin/mesa-on-prem-<ver>/
```

---

## 2. 目标机：首次安装

前置：Ubuntu 22.04/24.04、Docker Engine + Compose、sudo。

```bash
cd /home/remoteadmin/mesa-on-prem-<ver>
chmod +x install-ubuntu.sh
sudo ./install-ubuntu.sh
# 或：sudo ./install-ubuntu.sh --mesa-home /opt/mesa
# 首次若需当场编 web：加 --build-web
```

装完后：

1. 浏览器打开 **`http://127.0.0.1/setup`**（同域 edge 默认 **`:80`**，不要用 `:3000` 当正式入口）
2. 云 Ops 安装码 + 店主密码认领 → 跳转 `/auth/login`
3. 局域网正式入口：`http://<店内IP>/`（如 `http://192.168.0.141/`）
4. Print Agent「服务器地址」：按 **§2.2**（局域网 edge origin，勿 `localhost` / `:3000`）
5. 若启用公网 Tunnel 或局域网域名：按 **§2.1** 配 Auth 回调白名单（易漏）

健康探针（装机/升级脚本与 compose 使用）：

```bash
curl -sS http://127.0.0.1:3000/api/health/live
curl -sS http://127.0.0.1:3000/api/health/ready
# 经 edge：
curl -sS http://127.0.0.1/api/health/live
```

期望 JSON：`{"ok":true,"status":"live"|"ready"}`。

### 2.1 Auth 多入口白名单（必查，易漏）

配置文件（唯一手改处）：

```text
$MESA_HOME/current/deploy/on-prem/.env
# 默认：/opt/mesa/current/deploy/on-prem/.env
```

| 变量 | 作用 |
|------|------|
| `SITE_URL` | Auth 主站点 origin = 局域网 edge（例 `http://192.168.0.141`，**无**尾斜杠） |
| `ADDITIONAL_REDIRECT_URLS` | GoTrue `GOTRUE_URI_ALLOW_LIST`：凡用来打开网页并登录的 origin，都要写成 `origin/**`，逗号分隔 |
| `MESA_TUNNEL_ORIGIN` | 可选；bootstrap 时若设置会**自动**并入白名单。Tunnel **后装**时不会自动补——必须手改 `ADDITIONAL_REDIRECT_URLS` |

**默认装机**往往只有 `SITE_URL=http://<店内IP>`，**没有** `ADDITIONAL_REDIRECT_URLS` / `MESA_TUNNEL_*`。仅用 IP 打开一般够用；一旦加了公网域或局域网域名登录，缺白名单会出现回调/登录失败。

示例（按店替换 IP / 域名；**追加勿覆盖**已有项）：

```text
SITE_URL=http://192.168.0.141
ADDITIONAL_REDIRECT_URLS=http://192.168.0.141/**,http://pirata.lan/**,https://pirata.farvoo.com/**
```

说明：

- `http://<店内IP>/**`：局域网正式入口（建议始终保留）
- `http://<局域网名>/**`：可选（路由器 DNS / hosts，如 `pirata.lan`）；DNS 可后配，白名单可先写
- `https://<公网域>/**`：Cloudflare Tunnel 等公网入口；**有 Tunnel 就必须写**，不要只依赖 `SITE_URL`
- 仅写 `ADDITIONAL_REDIRECT_URLS` 即可生效；`MESA_TUNNEL_ORIGIN` 可有可无（便于对照，不替代白名单）
- 桌位码：少用不稳定的 `.local`（mDNS）；优先稳定 IP、路由器局域网名或公网域

改完后**重建 Auth**（只 `restart` 可能吃不到新 `.env`）：

```bash
sudo /opt/mesa/bin/mesa-stack up -d --force-recreate auth
# 确认：
sudo grep -E '^(SITE_URL|ADDITIONAL_REDIRECT|MESA_TUNNEL)=' /opt/mesa/current/deploy/on-prem/.env
```

初装就带 Tunnel 时，也可在 bootstrap 设 `MESA_TUNNEL_ORIGIN=https://你的域`，避免事后漏补。

局域网自测（SSH 店机）：

```bash
curl -sS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3000/api/health/live
curl -sS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3000/api/health/ready
curl -sS -o /dev/null -w "%{http_code}\n" http://192.168.0.141/
# 未登录访问后台常见 307/302，说明路由通
curl -sS -o /dev/null -w "%{http_code}\n" http://192.168.0.141/dashboard/settings/staff
```

### 2.2 Print Agent「服务器地址」

打印跑在**另一台 Windows**（`MesaPrintAgent`），不进 Docker。配置里的服务器地址 = 店内 Mesa **正式入口 origin**（与浏览器打开后台一致），走 edge `:80`。

| 填法 | 是否推荐 | 说明 |
|------|----------|------|
| `http://192.168.0.141` | **推荐** | 店机局域网 IP；最稳，断公网仍可打 |
| `http://pirata.lan` | 可选 | 仅当路由器 DNS/hosts 已解析且 §2.1 白名单已含该 origin |
| `https://pirata.farvoo.com` | 不推荐作店内主配置 | 依赖 Tunnel/外网；断网或 Tunnel 挂则打印断 |
| `http://localhost` / `127.0.0.1` | **禁止** | Agent 在别的电脑上时指不到店机 |
| `http://…:3000` | **禁止作正式配置** | `:3000` 仅本机调试；正式入口无端口（`:80`） |

注意：

- **不要**尾斜杠也可以；与网页同源即可（例 `http://192.168.0.141`）
- Agent 与店机须同局域网（或能路由到该 IP）
- 改网页用的局域网名/公网域后：Auth 走 §2.1；Agent 仍优先保持 **IP**，避免 DNS 抖动影响出单

### 2.3 Realtime publication（看板不实时）

**原因：** `baseline_public.sql` 不带 `supabase_realtime` 成员；initial 的 `ALTER PUBLICATION` 又在 covered 里被跳过 → 店库常 **0 表**。与公网/局域网无关。

**打包/装机/升级（唯一修法）：** `apply-migrations.sh` **每次**跑 `schema/ensure_realtime_publication.sql`（幂等，至少 `orders`/`table_sessions`/`bill_splits`）。`pack-release.sh` 缺文件或未调用则打包失败。  
**不要**只靠一条会被 `baseline_covered` 跳过的 migration。

**已装店应急 / 抽查：**

```bash
docker exec -it supabase-db psql -U postgres -d postgres -c "
SELECT tablename FROM pg_publication_tables
WHERE pubname='supabase_realtime' ORDER BY 1;
"
# 若为空，升含 ensure 的包，或临时：
# ALTER PUBLICATION supabase_realtime ADD TABLE
#   public.orders, public.table_sessions, public.bill_splits;
```

员工须在列表页 `/dashboard/waiter`；详情页楼面 Realtime 按设计休眠。勿用轮询冒充修复。

**Mode B same-origin Auth Cookie（订上频道但无 CDC）：** 服务端 `SUPABASE_URL=http://kong:8000` 写入 `sb-kong-auth-token`；浏览器若用页面 origin 推导 Cookie 名会对不上 → Realtime **无 JWT** → RLS 滤掉 `postgres_changes`。唯一修法：`getSupabaseAuthCookieOptions()`（`apps/web/src/lib/supabase/url.ts`）在 same-origin 下固定与 `kong` host 对齐的 Cookie 名，且 **browser/server/middleware/route-handler** 四处都走该函数。升级后员工 **重新登录** 一次。`pack-release` 门禁校验四处接线。

---

## 3. 目标机：升级（已有 `/opt/mesa`）

**必须**设置 `MESA_HOME`，否则 `upgrade.sh` 不会把包内 `apps/web` 同步进 `/opt/mesa/current`，`--build web` 编的仍是旧源码。

**不要**对含 `NEXT_PUBLIC_*` / 前端逻辑变更的包使用 `--SkipBuild`。

```bash
export MESA_HOME=/opt/mesa
cd /opt/mesa/current/deploy/on-prem
sudo -E ./scripts/upgrade.sh /home/remoteadmin/mesa-on-prem-<ver>
```

脚本顺序：备份 → stage → 同步（保留 `.env`）→ 增量 migration + **Realtime ensure（§2.3）** → rebuild web → health → `current.json`。

成功标志：终端 `Upgrade OK → …`；且：

```bash
curl -sf http://127.0.0.1:3000/api/health/live >/dev/null \
  && curl -sf http://127.0.0.1:3000/api/health/ready >/dev/null \
  && echo OK
curl -sI http://127.0.0.1/auth/login | head -5
sudo /opt/mesa/bin/mesa-stack ps
```

若 health 失败但 `/`、`/auth/login` 已是 200：先以页面为准排查；旧包曾因缺少 `/api/health/*` 误报失败（现已补路由，新包应过探针）。

回滚：`sudo ./scripts/rollback.sh`（**已跑迁移则拒绝** → 用 `restore-local.sh`）。

### 3.1 Web 镜像构建为何慢、缓存在哪

升级默认会 `stack up --build web`。耗时几乎全在 Docker 里的 **`npm ci` + `next build`**（店机常见十几分钟）。构建日志里的 `npm warn deprecated …` / 「old versions may be purchased…」只是弃用提示，**不是付费、不是失败**。

**Docker 层缓存（不是 `/home/remoteadmin`）**

| 位置 | 是什么 |
|------|--------|
| `/home/remoteadmin/mesa-on-prem-…` | 仅解压的升级包源码 |
| `/opt/mesa/current/` | 运行中的 Mesa 树 |
| `/var/lib/docker/` | **镜像层与 BuildKit 缓存**（清 home **不会**清这里） |

`apps/web/Dockerfile` 的 `deps` 阶段：仅当根/`apps/web`/`packages/*` 的 `package.json` 与 `package-lock.json` **未变**，且**上一次 `npm ci` 成功写完层**时，才会显示 `CACHED` 并跳过安装。若上次 `npm ci` **`ETIMEDOUT` 失败**，该层不会留下 → 重试必须再全量装一遍（与是否动过 home 无关）。

**加速手段（写在 Dockerfile，不要在店机 shell 里敲）**

`apps/web/Dockerfile` deps 已用 `RUN --mount=type=cache,target=/root/.npm npm ci`（BuildKit）。lock 变了或上次 `npm ci` 失败时，重复下载会快很多。店机勿在 shell 敲 `RUN …`。需 Docker BuildKit（较新默认开启）。

**网络**：构建中 `npm error network read ETIMEDOUT` 是店机访问 `registry.npmjs.org` 中断。可先 `curl -I https://registry.npmjs.org/` 与 `docker run --rm node:20-bookworm-slim npm ping`；通则直接重跑同一条 `upgrade.sh`。中长期可再考虑预构建 web 镜像随包下发（见交接/后续优化），避免门店现场编译。

**打印助手安装包下载**：web 镜像内已烘入 `NEXT_PUBLIC_PRINT_AGENT_GITHUB_REPO`（Dockerfile ARG 默认值）并 COPY `apps/print-agent/VERSION`，后台「设置 → 打印助手」才会显示安装包下载卡片；下载按钮 302 到 GitHub Release，店机浏览器需能访问 `github.com`。`pack-release.sh` 对此 fail-closed。**不要**指望在店机 `.env` 里加 `NEXT_PUBLIC_*` 再 `restart`——必须 `--build web`。`upgrade.sh` / `install-mesa.sh` 必须把包内 `apps/print-agent/VERSION` 同步进 `$MESA_HOME/current`，否则 Docker `COPY` 失败或仍用旧镜像。

---

## 4. 升级后业务验收（二维码）

网页对外 origin 跟**当前打开后台的地址**走（`getPublicWebOrigin`）：

| 怎么打开后台 | 生成的桌位/员工登录码 |
|--------------|------------------------|
| `http://192.168.x.x/` | 局域网 URL（手机同 Wi‑Fi 可扫） |
| `https://店的公网域/` | 公网 URL |
| `http://localhost/` 或 `127.0.0.1` | **仅本机**；别人扫码打不开店内机 |

给客人的码：用局域网 IP 或公网域开后台再生成；不要用 localhost。

---

## 5. 常见错误

| 错误 | 正确做法 |
|------|----------|
| 只认 `mesa-on-prem-latest.zip` | 用 stamped 名 + `PACK-ID.txt` / `LATEST-NAME.txt` |
| `upgrade.sh` 未 `export MESA_HOME=/opt/mesa` | 必须 `-E` 且带 `MESA_HOME` |
| `--SkipBuild` 跳过 web | 前端/同域/QR 相关变更必须 rebuild |
| 正式入口用 `:3000` | 正式用 edge `:80` → `http://<IP>/` |
| Tunnel / 局域网域名登录失败 | 查 §2.1：`.env` 补 `ADDITIONAL_REDIRECT_URLS=…/**`，`--force-recreate auth` |
| 只有 `SITE_URL`、无白名单 | 常见；纯 IP 可暂用。有公网域或 `*.lan` 登录时必须补白名单 |
| Print Agent 填 localhost / `:3000` / 公网域 | 查 §2.2：填 `http://<店内IP>`（edge，无 `:3000`） |
| 扫码下单成功但前台不实时 | §2.3：publication；Mixed Content → same-origin 无参 inline；WS 已 join 但无 CDC → Auth Cookie 名（`getSupabaseAuthCookieOptions`），升级后重新登录 |
| Caddy 宽匹配 `/auth/*` | 只代理 `/auth/v1/*` 等，避免抢走 Next `/auth/login` |
| 升级失败立刻 Restore | 先 curl 登录页与 `/api/health/*`；确认是否误报 |
| 终端执行 `RUN --mount=… npm ci` | 那是 **Dockerfile** 行，改 `apps/web/Dockerfile` 后重新打包升级，不是店机 shell 命令 |
| 清 `/home/remoteadmin` 后升级又全量 `npm ci` | home 不含 Docker 缓存；多半是**上次 `npm ci` 失败未成层**或 lock 变更 |
| `npm warn deprecated` / purchased 文案 | 忽略；真失败看 `ETIMEDOUT` / `exit code` |

---

## 6. 相关路径

| 用途 | 路径 |
|------|------|
| 打包 | `deploy/on-prem/scripts/pack-release.sh` |
| 升级 | `deploy/on-prem/scripts/upgrade.sh` |
| Ubuntu 初装 | `install-ubuntu.sh` → `linux/install-mesa.sh` |
| 栈 | `$MESA_HOME/bin/mesa-stack` 或 `deploy/on-prem/scripts/stack.sh` |
| Health 实现 | `apps/web/src/lib/ops-health.ts`，`/api/health/live`·`ready` |
| 网页对外 origin | `apps/web/src/lib/site-origin.ts` → `getPublicWebOrigin` |
| Auth 白名单 `.env` | `$MESA_HOME/current/deploy/on-prem/.env` → `ADDITIONAL_REDIRECT_URLS`（§2.1） |
| Print Agent 服务器地址 | 店内 edge origin，见 §2.2（推荐 `http://<店内IP>`） |
| Realtime publication | §2.3；ensure：`schema/ensure_realtime_publication.sql` ← `apply-migrations.sh` |
| 交接总览 | `docs/on-prem-handoff.zh.md` |
