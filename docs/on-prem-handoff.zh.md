# 门店本地部署 + 授权控制面：需求与交接

> **日期：** 2026-07-30（§1.4 装机认领终态 2026-07-30 晚补全；**2026-08-01** 废止 Windows/WSL Web 全栈安装器）  
> **状态：** 控制面 + `/setup` 装机桥已合入；Mode B 发行以 **Ubuntu `install-ubuntu.sh`** 为准。  
> **权威方案：** [`local-only-rollout-steps.zh.md`](./local-only-rollout-steps.zh.md) · 打包 [`technical/on-prem-pack-install-upgrade.zh.md`](./technical/on-prem-pack-install-upgrade.zh.md) · ADR：[`ADR-004`](./decisions/ADR-004-on-prem-entitlement.md)  
> **相关会话：** [On-prem license control plane](4c9cf0ea-bf55-4120-b093-b05d28c40651) · [Claim bridge /setup](5144df91-bb08-49f4-9e3f-d26bbc47fe6a)

---

## 0. 一句话

两件事并行：

1. **Ops 授权控制面**（云登记本地店、续期/停运、安装码认领、7 天离线 lease）——控制面 + `/setup` 装机桥已编码；**连云生产 UAT / 推远程 `main` 未完成**。  
2. **Mode B 门店发行包**（本机 Docker 栈 + 迁移 baseline + **Ubuntu** 安装器）——`deploy/on-prem` 源码应在 Git；产物 zip 仍可不入库。

商业形态：**Ubuntu 店机（Docker Engine）+ 另机 Windows Print Agent**。  
**已作废：** Windows/WSL/Docker Desktop 跑 Mesa Web+库全栈；`deploy/on-prem/windows/**`、`Install-Mesa.ps1`、`START-WSL-TEST.cmd`、`MesaOnPremBackup` / `MesaOnPremStack` 已删除。

---

## 1. 需求（已拍板，不要回扯）

### 1.1 交付形态

| 项 | 决定 |
|----|------|
| 营业权威 | 仅店内 Postgres（自托管 Supabase Mode B） |
| 打印 | Windows `MesaPrintAgent`；服务器地址推荐 `http://<店内IP>`（edge，见 `on-prem-pack-install-upgrade.zh.md` §2.2）；不进 Docker |
| 运行时 | **Ubuntu + Docker Engine**（唯一店机路径）；Windows 只跑 Print Agent |
| 升级 | **离线升级包 only**；无在线升级 API |
| 发票 | 不做；停运只挡 Mesa 运营 |

### 1.2 授权控制面（ADR-004）

| 项 | 决定 |
|----|------|
| 交付模式 | `restaurants.deployment_mode`: `cloud` \| `on_prem`；创建必选 |
| 云路径 | 保持 `createRestaurantWithOwner`；行为零回归 |
| 本地路径 | `registerOnPremRestaurant`（云侧只登记，不写店内营业库） |
| 运行时闸门 | **唯一** `suspended_at` + `isRestaurantSuspended()`；不另开 license 错误码 |
| 授权时钟 | 唯一 `license_valid_until`；Ops 日一律为 **Europe/Lisbon** 日历日，存该日 `23:59:59.999`；相对续期走 `extendLicenseValidUntil`，绝对设置走 `resolveLicenseCalendarDate` → 同一写库路径 |
| 离线票 | 签名 lease JWT；宽限天数 = `restaurants.license_offline_grace_days`（默认 7）；`decideLicenseMaterialize` → 只写/清 `suspended_at` |
| 安装身份 | `restaurant_installations`（pending → claimed \| revoked）；≠ 打印配对 |
| Ops UI | 单一表面 `/ops/licenses`；餐厅详情只跳转 |
| Check-in | 进店主后台 **生命周期一次**（lifecycle one-shot）；禁止读模型 interval 轮询 |
| 平台「已认领」 | **仅** `restaurant_installations.status === 'claimed'`（不用云 `restaurants.owner_id`） |
| 平台 claim | 验码 → 标 claimed → 签 lease + mint 凭证 → 返回快照；**禁止**平台 `createUser` / 写云 `owner_id` |
| 本机认领 UI | **唯一**页面 `/setup`（安装码 + 店主密码） |
| 本机落库 | **唯一** apply-claim：同 `restaurantId`；首装建本地店+Auth；**已认领则可重绑** lease/配置并重设店主密码；包内只预置 `MESA_PLATFORM_LICENSE_URL`；认领响应下发 checkin+leaseSecret → **`deploy/on-prem/license-state/platform.json`**（升级保留；缺文件+票据无效 → fail-closed）；装机门闩 `verify-on-prem-ready.sh` |
| 认领成功导航 | **只跳** `/auth/login`，**不自动登录** |
| 云店 onboarding | 现有 `/dashboard` → `RestaurantOnboarding` **仅 cloud**；on-prem 空库不得平行「只填店名建店」 |

### 1.3 本地建店端到端（路由交互 · 已拍板）

两套库：**云 = 控制面**；**本机 = 营业权威**。本机 Web 只连本机库。

```text
云 Ops                         本机 Web（:3000）
─────                         ────────────────
/ops/login
/ops/restaurants/new
  （选「本地安装」登记）
/ops/licenses/[id]
  （签发安装码，页上显示一次）
                              栈就绪后打开 /setup
                                填安装码 + 店主密码 → 提交
                              本机 → 云 POST /api/platform/license/claim
                              云返回 restaurantId / 邮箱 / lease / checkinCredential
                              本机 apply-claim（同 id 建店+店主+写配置）
                              成功 → 跳转 /auth/login（不自动登录）
                              店主用登记邮箱 + 刚才密码登录
                              → /dashboard（进门 reconcile：check-in + materialize）
```

| 步 | 路由 / API | 行为 |
|----|------------|------|
| 1 | `/ops/login` | 平台管理员登录 |
| 2 | `/ops/restaurants/new` | `deploymentMode=on_prem`；只登记；不建云 Auth |
| 3 | `/ops/licenses/[id]` | 签发安装码；明文码只展示一次；默认只看活跃安装（pending/claimed），已吊销进「查看历史」；签发/吊销不整页重载 |
| 4 | 本机 `http://127.0.0.1:3000/setup` | 唯一认领页；字段：安装码、店主密码（邮箱以云登记为准，可只读展示） |
| 5 | 云 `POST /api/platform/license/claim` | 平台侧：claimed + lease + 凭证；**不**建云用户 |
| 6 | 本机 apply-claim（服务端） | 本地库：`restaurants.id = 平台 restaurantId`；本地 Auth 店主；认领响应的 checkin+leaseSecret + URL → `license-state/platform.json` |
| 7 | `/auth/login` | 认领成功后的落地页；**禁止**自动建 session；员工登录 preflight 走 `reconcileRestaurantLicense` |
| 8 | `/dashboard` | 登录后营业；lifecycle `reconcileRestaurantLicense` → on_prem check-in → `applyLicenseMaterialize` |

**Prem 内置超管（与认领店主并行）：** 装机 `ensure-prem-builtin-admin` 创建 Auth 用户 `admin` / 默认密见安装说明；**不**写 `restaurants.owner_id`、**不**进员工列表。认领前登录返回 `prem_admin_inactive`；认领后（本机存在 `deployment_mode=on_prem` 且 `owner_id` 非空）可登录，权限与后台管理员相同（`loadBackendAdminRestaurantForUser` 唯一路径）。

失败：停在 `/setup`，提示码无效/过期/已用等，**不**写本地店。

**对线上已有云店：** 存量 `deployment_mode=cloud` 不走 `/setup` / claim；云开户仍 `createRestaurantWithOwner`。装机桥不得改坏该路径。

**实现缺口（相对本节）：** 代码路径已落地（平台 claim 不建 Auth；本机 `/setup` + `/api/setup/claim` + `applyOnPremClaim`；成功只跳 `/auth/login`）。连云生产 UAT / 推远程仍见 §2–§3。

### 1.4 本轮验证目标（工程）

| 目标 | 说明 |
|------|------|
| 主路径 | **原生 Ubuntu** + Docker Engine + `install-ubuntu.sh` / Mode B 脚本 |
| 验证 | 解压 stamped zip → `sudo ./install-ubuntu.sh` → migrate 成功 → `/setup` |
| 客户路径 | 包根 `install-ubuntu.sh`（默认 `MESA_HOME=/opt/mesa`） |
| 明确不做 / 已删除 | Windows/WSL 全栈安装器；`deploy/on-prem/windows/**`；`START-WSL-TEST.cmd`；`MesaOnPremBackup` / `MesaOnPremStack` |
| 打印 | **另机** Windows `MesaPrintAgent`（`apps/print-agent` 发行），不进本 zip |

---

## 2. 完成度总表

图例：✅ 已完成 · 🟡 部分/本机有 · ❌ 未完成 · ⛔ 卡死风险

### 2.1 授权控制面（Git：`d0483ee`，本地 `main` ahead `origin/main` 2）

| 项 | 状态 | 说明 |
|----|------|------|
| Migration `20260730140000_on_prem_license_control_plane.sql` | ✅ | 本地 CLI 已有；**云 Supabase 亦已列出同名迁移**（2026-07-30 MCP 核对） |
| Shared：注册/续期/lease/materialize | ✅ | `packages/shared` + 单测 |
| Ops：`/ops/licenses` + API | ✅ | extend / suspend / resume / installations |
| Platform：`/api/platform/license/claim` · `check-in` | ✅ | claim **不**建平台 Auth；已认领 = installation `claimed` |
| Web：业务边界 reconcile（登录 / 顾客入口 / dashboard） | ✅ | 唯一 `reconcileRestaurantLicense` · `license-materialize.ts` |
| 本机 `/setup` + apply-claim 装机桥 | ✅ | `/setup` + `/api/setup/claim` + `applyOnPremClaim`；成功只跳 `/auth/login` |
| ADR-004 + schema 摘要 + handoff §1.3 | ✅ | 认领终态已写入 ADR / 本文 |
| 本地 UAT 脚本 | 🟡 | `scripts/uat-on-prem-license.mjs` 含 platform-no-owner + setup bridge；需 web:3000 + ops:3001 |
| 推 `origin/main` / 云 Ops 生产 env | ❌ | 本地 ahead 未 push；Vercel Ops 需部署含 license API 的版本，并配 `MESA_LICENSE_LEASE_SECRET` |
| 连云端到端 UAT（登记→码→`/setup`→登录→check-in→续期/停运） | ❌ | 本地同库 UAT 已绿；真云 Ops + 本机双库待 push/部署后验 |

### 2.2 Mode B 发行栈与验证（磁盘 / zip；**不在 Git**）

| 项 | 状态 | 说明 |
|----|------|------|
| `edge/Caddyfile` + `compose` `edge` | ✅（本 diff） | 同域 `/`→web，`/auth/v1|/rest/v1|/realtime/v1|…`→Kong（勿用宽 `/auth/*`，会抢走 Next `/auth/login`）；Tunnel 指 `:80` |
| 浏览器 Supabase URL | ✅（本 diff） | 唯一 `getSupabaseUrl()`；Mode B `NEXT_PUBLIC_MESA_SUPABASE_SAME_ORIGIN=1` → `location.origin`；云不设该开关 |
| 浏览器网页对外 origin（QR / 下载绝对链） | ✅ | 唯一 `getPublicWebOrigin()`（`lib/site-origin.ts`）；浏览器跟 `location.origin`；服务端传 `headers()` 优 Host |
| Auth 双入口白名单 | ✅ | bootstrap：`SITE_URL`=局域网；可选 `MESA_TUNNEL_ORIGIN`→白名单。**后装 Tunnel / 局域网域名**须手改 `.env` 的 `ADDITIONAL_REDIRECT_URLS`（见 `docs/technical/on-prem-pack-install-upgrade.zh.md` §2.1） |
| Schema baseline + Realtime ensure | ✅ | baseline + covered；`ensure_realtime_publication.sql` 每次 apply；`pack-release` 门禁（§2.3） |
| `apply-migrations.sh` | 🟡 | 已修：heredoc 必须 `docker exec -i`；covered 一批事务标记；pending=0 则跳过 incremental |
| `pack-release.sh` 唯一包名 | 🟡 | `mesa-on-prem-<sha>-<UTC>.zip` + `PACK-ID.txt`；勿只认 `latest` |
| Ubuntu `install-mesa.sh` / `install-ubuntu.sh` | ✅ | 客户唯一装机入口；`mesa-on-prem.service` 开机拉栈 |
| Windows/WSL Web 全栈安装器 | ✅ 已删除 | `deploy/on-prem/windows/` 移除（2026-08-01） |
| `apps/web/Dockerfile` + `DOCKER_BUILD` standalone | ✅ | Mode B build 带 `NEXT_PUBLIC_MESA_SUPABASE_SAME_ORIGIN` |
| Ubuntu 干净机装到 `/setup` | 🟡 | 以 stamped zip + `install-ubuntu.sh` 验收 |
| 客户空机 Installer 无人值守验收 | ❌ | 未做完整空机矩阵 |
| 拔外网营业日 / Print Agent 联调 | ❌ | Agent 另机 Windows；联调待排 |
| 步骤 ⑥ 备份上云 / ⑦ 升级演练 ≥3 | ❌ | 脚本有雏形，未按验收清单打勾 |
| **`/dist/` 发行 zip** | ignore | 产物仍不入库；源码在 `deploy/on-prem` |

### 2.3 步骤地图（对照 `local-only-rollout-steps`）

| 步骤 | 完成度 | 备注 |
|------|--------|------|
| ① 支持范围 | 🟡 | 大方向定；支持矩阵一页仍缺正式勾选 |
| ② 本机生产栈 | 🟡 | 包与脚本有；干净机绿跑未闭环 |
| ③ print-agent 本机 | ❌ | 另机 Windows；服务器地址 `http://<店内IP>`（edge） |
| ④ 域名证书 | ❌ | POC 用局域网 IP |
| ⑤ 安装器/自启 | 🟡 | Ubuntu 脚本在；空机重复装 + 重启自起未验收 |
| ⑥ 备份恢复 | 🟡 | `backup-local.sh` + `mesa-daily-cutover`（关台→本机快照）；灾备/恢复演练未闭环 |
| ⑦ 升级回滚 | 🟡 | `upgrade.sh`/`rollback.sh` 有；≥3 次演练无 |
| ⑧ 试点 | ❌ | — |
| 控制面（ADR-004） | 🟡 | 代码+云迁移+装机桥齐；连云 UAT / 推远程未完 |

---

## 3. 卡点（按优先级）

### P0 — 必须先解

1. **`deploy/` 不在 Git**  
   - 现象：安装器、baseline、migrate、pack、verify 全在 ignore 里。  
   - 后果：另一台机器 / 另一人无法从仓库复现；只靠拷贝 zip 或本机目录。  
   - 建议：拆「可提交源」vs「产物」——提交 `deploy/on-prem/**`（排除 `.env`、volumes、`.releases`、`data/`）；继续 ignore `/dist/*.zip`。用 `git add -f` 或改 `.gitignore` 后提交。

2. **Ubuntu 验证尚未用最新 stamped zip 确认绿**  
   - 历史翻车（WSL 时代）：covered 标记失败 → 重跑 `platform_admin`「表已存在」；heredoc 无 `-i` → `mesa_schema_migrations` 未创建。  
   - 当前应使用 stamped 包 + `sudo ./install-ubuntu.sh`；成功日志必须含：  
     `Marked baseline-covered ...` + `No pending incremental migrations`。  
   - `WARN: storage.buckets not ready` **可忽略**（非阻断）。

3. **控制面未推远程 / Ops 生产未配密钥**  
   - 本地 `main` ahead；连云 claim/check-in 依赖已部署 Ops（Ops 配 `MESA_LICENSE_LEASE_SECRET`；店端由认领写入 `platform.json`，包内只预置 URL）。  
   - 装机桥（`/setup` + apply-claim）**代码已合入本分支**；真·云 Ops + 本机双库仍需连云 UAT。

### P1 — 交付前

4. **`apps/web/Dockerfile` 须在发行包内** —— on-prem web `--build` 依赖它；`pack-release` 已打入。  
5. **Print Agent 服务器地址** —— 店内 edge `http://<店内IP>`（§2.2）；migrate / 认领绿之后厨打冒烟。  
6. **店机 OS** —— 合同/支持只写 **Ubuntu + Docker Engine**；Windows 仅 Print Agent。

### P2 — 已知弯路（不要再走）

- Windows 主机直接 `docker compose` 跑 Mesa 全栈（路径/WSL 坑）——**路径已废，勿复活**。  
- PowerShell 5.1 + Unicode 破折号导致脚本解析失败（旧 Windows 安装器）。  
- 嵌套混淆包名（`mesa-on-prem-onprem-*`）。  
- **结论：** 全栈只走原生 Ubuntu；Windows 只跑 Print Agent。

---

## 4. 当前包与命令（本机）

> **打包 / 初装 / 升级正确流程（唯一操作说明）：** [`docs/technical/on-prem-pack-install-upgrade.zh.md`](./technical/on-prem-pack-install-upgrade.zh.md)  
> **local-perm 安装技术工具清单：** [`docs/technical/local-perm-install-tools.zh.md`](./technical/local-perm-install-tools.zh.md)  
> 包名每次打包唯一；**不要只拷 `mesa-on-prem-latest.zip`**。以 `dist/mesa-on-prem-LATEST-NAME.txt` 或解压后 `PACK-ID.txt` 为准。  
> 店内解压目录约定：`/home/remoteadmin/mesa-on-prem-<ver>/`。

| 项 | 值（交接日快照，可能已更新） |
|----|------------------------------|
| 最新 stamped zip | 以 `dist/mesa-on-prem-LATEST-NAME.txt` 为准 |
| 内含目录 | 与 stamped zip 同名 |
| 验证 / 客户入口 | `sudo ./install-ubuntu.sh`（详见包内 `README-UBUNTU.zh.txt`） |
| 重新打包 | `./deploy/on-prem/scripts/pack-release.sh`（仓库根） |
| 店内升级 | `MESA_HOME=/opt/mesa` + `sudo -E ./scripts/upgrade.sh /home/remoteadmin/mesa-on-prem-<ver>` |
| 重导 baseline | `DB_CONTAINER=supabase_db_restaurant-ordering ./deploy/on-prem/scripts/export-schema-baseline.sh` |
| 本地授权 UAT | `node scripts/uat-on-prem-license.mjs`（先对齐 `MESA_LICENSE_LEASE_SECRET`） |
| Print Agent | 另装 Windows 发行包；服务器地址 `http://<店内IP>` |

成功 migrate 期望：

```text
Pack ID: mesa-on-prem-<sha>-<stamp>
...
Marked baseline-covered migrations (rows excluding baseline marker: 67).
No pending incremental migrations (baseline covers current tree).
```

---

## 5. 建议下一手（顺序）

1. **确认 `deploy/on-prem` 源码在 Git**（排除 secrets/volumes），Dockerfile / pack 门禁齐全。  
2. **用最新 stamped zip 在 Ubuntu 再跑一遍** `install-ubuntu.sh`，截成功 migrate + `/setup` 认领登录。  
3. **push 本地 `main`（用户明确说 push 时）**；确认云 Ops 部署与 `MESA_LICENSE_LEASE_SECRET`。  
4. 跑通连云 UAT：Ops 登记 → 发码 → `/setup` → `/auth/login` → dashboard check-in → 续期/停运。  
5. Print Agent 指 `http://<店内局域网IP>`（§2.2，勿 localhost / `:3000`），厨打冒烟。  
6. 再排 ⑤ 空机 Installer、⑥ 备份恢复、⑦ 升级演练。

---

## 6. 文件地图（给人接手）

| 需求 | 路径 |
|------|------|
| 本交接 | `docs/on-prem-handoff.zh.md`（本文） |
| 打包/初装/升级流程 | `docs/technical/on-prem-pack-install-upgrade.zh.md` |
| local-perm 技术工具清单 | `docs/technical/local-perm-install-tools.zh.md` |
| 步骤总方案 | `docs/local-only-rollout-steps.zh.md` |
| 授权 ADR | `docs/decisions/ADR-004-on-prem-entitlement.md` |
| 控制面迁移 | `supabase/migrations/20260730140000_on_prem_license_control_plane.sql` |
| Ops 许可逻辑 | `apps/ops/src/lib/license-control.ts` |
| 店端物化 | `apps/web/src/lib/license-materialize.ts` |
| UAT | `scripts/uat-on-prem-license.mjs` |
| 发行树（本机） | `deploy/on-prem/**`（**当前 gitignore**） |
| 产物 | `dist/mesa-on-prem-*.zip`（**gitignore**） |

---

## 7. 明确不在本轮范围

- 葡萄牙财政 Agent  
- 店内默认装 `apps/ops`  
- 云↔本地双写/故障切换  
- print-agent 进 Docker  
- Authenticode 签名 MSI / 全量离线镜像包  
- 营业中自动拉 `:latest`
