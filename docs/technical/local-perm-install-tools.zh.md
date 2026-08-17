# local-perm · Ubuntu 部署与运维技术工具

> **目的：** 理清 **Ubuntu 店机** 部署、日常运维要准备/安装的技术工具。  
> **不做：** 逐步安装命令（见 [`on-prem-pack-install-upgrade.zh.md`](./on-prem-pack-install-upgrade.zh.md)）、Windows/WSL 路径、研发 `dev/stage/cloud`。

**local-perm** = 店内 Mode B 永久权威本机（`/opt/mesa`）。打印在另机 Windows，不进本清单的「店机必装」。

---

## 1. 通道分工（避免装错用途）

| 通道 | 工具 | 谁用 |
|------|------|------|
| 店内营业 | 局域网 → 本机 **:80** | 店员、厨房、Print Agent |
| 顾客公网扫码 | **Cloudflare Tunnel**（`cloudflared`） | 顾客手机 |
| 远程运维 | **Tailscale** + **SSH** | 你们 / 技术支持 |

---

## 2. 店机必装 / 必有

| 工具 | 用途 |
|------|------|
| **Ubuntu 22.04 或 24.04 LTS** | 店机 OS |
| **Docker Engine** | 跑 Farvoo + 自托管 Supabase 容器 |
| **Docker Compose v2**（`docker compose`） | `stack.sh` / systemd 启停 |
| **curl** | 健康检查 `/api/health/*` |
| **openssl** | bootstrap 生成密钥 |
| **unzip** | 解压 `mesa-on-prem-*.zip` |
| **systemd** | `mesa-on-prem.service` 开机拉栈 |
| **sudo** + 可写磁盘 | 默认 `MESA_HOME=/opt/mesa` |

建议规格：4 核 / 16GB / 256GB+ SSD；NTP 正常；能出网（首次拉镜像）。

---

## 3. 强烈建议（运维）

| 工具 | 用途 |
|------|------|
| **Tailscale**（`tailscaled`） | 远程进店机；勿当顾客/店员业务入口 |
| **openssh-server** | 经 Tailscale SSH 装机、升级、排障 |
| **ufw**（或等价） | 见下 |
| **rsync** | 见下 |
| **ca-certificates** | 见下 |

**ufw（或 nftables/iptables 等等价防火墙）**  
Ubuntu 自带的简单主机防火墙：决定「谁可以连进这台机的哪些端口」。店机默认只该对局域网开 **:80**（业务）；SSH（22）尽量只允许来自 Tailscale 网卡 `tailscale0`，避免公网扫端口撞上 sshd。不装防火墙也能跑 Farvoo，但远程交付时等于少一层「别误开端口」的保险。

**rsync**  
按文件增量同步目录的工具。`install-mesa.sh` / `upgrade.sh` / `rollback.sh` 用它把发行包内容高效拷进 `/opt/mesa`（只传有变化的文件）。没有 rsync 时脚本会退回普通拷贝，能装，但大包升级更慢、更笨。`apt install rsync` 即可。

**ca-certificates**  
系统里的「受信任根证书」包。店机用 HTTPS 出网时（拉 Docker Hub、连 Cloudflare/Tailscale、云 Ops 授权、restic 上传 S3/R2），TLS 要靠这套根证校验对端。Ubuntu 桌面/server 镜像通常已带；精简或被删过的系统若缺它，会出现证书报错、HTTPS 全挂。保活即可，一般不用单独折腾配置。

---

## 4. 按需安装

| 工具 | 何时需要 |
|------|----------|
| **cloudflared** | 要公网 HTTPS 扫码（指到本机 `:80`） |
| **tunnel-health**（随包） | 检测/记录 Tunnel 闪断；日志 `/opt/mesa/logs/tunnel/`；timer 每 5 分钟 |
| **restic** | 本机日备后加密上传 S3/R2 等（配 `MESA_HOME/config/backup.env`） |
| **jq** / **python3** | 少数 vendor/回滚辅助；非营业硬依赖 |

改公网域或局域网名登录时：还要配 `.env` 的 `ADDITIONAL_REDIRECT_URLS`（工具不是包，但是运维必做项）。

---

## 5. 随发行包带来（不必在 apt 另装）

| 组件 | 说明 |
|------|------|
| **mesa-on-prem stamped zip** | 初装/升级同一包；`install-ubuntu.sh` |
| **Caddy edge**（容器） | 正式入口 `:80` |
| **mesa web**（容器，Node 20 镜像构建） | Next 生产 |
| **自托管 Supabase 钉死镜像** | Postgres / Kong / GoTrue / PostgREST / Realtime / Storage / …（见 `deploy/on-prem/images.lock`） |
| **备份/升级脚本** | `backup-local.sh`、`upgrade.sh`、`mesa-stack` 等 |

宿主机**不必**装 Node、Go、npm、`pg_dump`（库工具在 Postgres 容器内）。

---

## 6. 店机旁边（本机不装，但交付要有）

| 项 | 说明 |
|----|------|
| **Windows + MesaPrintAgent** | 另机；服务器地址填 `http://<店内局域网IP>`（勿 Tailscale IP、勿 `:3000`） |
| **热敏打印机** | USB 或 TCP 9100，挂在 Agent 那台 Windows |
| **云 Ops** | 安装码 / 续期（店机出站 HTTPS）；变量见 ADR-004 |

---

## 7. 一页核对

- [ ] Ubuntu LTS + Docker Engine + Compose v2  
- [ ] curl / openssl / unzip；建议 rsync、ca-certificates  
- [ ] Tailscale + openssh-server（+ ufw）  
- [ ] stamped zip → `install-ubuntu.sh`  
- [ ] 公网扫码 → cloudflared + Auth 白名单  
- [ ] 日备上云 → restic + `backup.env`  
- [ ] 另机 Print Agent + 打印机；Agent 填局域网 IP  

---

## 相关

- 装机/升级步骤：[`on-prem-pack-install-upgrade.zh.md`](./on-prem-pack-install-upgrade.zh.md)  
- 包内说明：`deploy/on-prem/linux/README-INSTALL.zh.txt`  
- 镜像钉死：`deploy/on-prem/images.lock`
