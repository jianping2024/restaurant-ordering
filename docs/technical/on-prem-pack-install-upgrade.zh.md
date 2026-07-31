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
4. Print Agent「服务器地址」填**同一局域网 origin**（不要填本机 `localhost`）
5. 可选：Cloudflare Tunnel → 本机 `:80`；`.env` 设 `MESA_TUNNEL_ORIGIN=https://你的域` 写入 Auth 回调白名单

健康探针（装机/升级脚本与 compose 使用）：

```bash
curl -sS http://127.0.0.1:3000/api/health/live
curl -sS http://127.0.0.1:3000/api/health/ready
# 经 edge：
curl -sS http://127.0.0.1/api/health/live
```

期望 JSON：`{"ok":true,"status":"live"|"ready"}`。

---

## 3. 目标机：升级（已有 `/opt/mesa`）

**必须**设置 `MESA_HOME`，否则 `upgrade.sh` 不会把包内 `apps/web` 同步进 `/opt/mesa/current`，`--build web` 编的仍是旧源码。

**不要**对含 `NEXT_PUBLIC_*` / 前端逻辑变更的包使用 `--SkipBuild`。

```bash
export MESA_HOME=/opt/mesa
cd /opt/mesa/current/deploy/on-prem
sudo -E ./scripts/upgrade.sh /home/remoteadmin/mesa-on-prem-<ver>
```

脚本顺序：备份 → stage 到 `$MESA_HOME/releases/<ver>/` → 同步到 `current`（**保留现有 `.env`**）→ 增量 migration → `stack up` → **`stack up --build web`** → 探 `live`+`ready` → 写 `config/current.json`。

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
| Caddy 宽匹配 `/auth/*` | 只代理 `/auth/v1/*` 等，避免抢走 Next `/auth/login` |
| 升级失败立刻 Restore | 先 curl 登录页与 `/api/health/*`；确认是否误报 |

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
| 交接总览 | `docs/on-prem-handoff.zh.md` |
