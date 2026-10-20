# On-prem 店机清单（Tailscale / SSH）

> **唯一**店机连接与 scp/升级目标表。新开店只在本文件加一行，勿在聊天规则里平行抄一份。  
> **禁止**把 Linux/SSH/网页密码写进本仓库（含本文件、规则、示例 env）。凭据见本机 Agent 个人 store：`on-prem-store-credentials.md`（不入库）。

相关：打包升级 [`on-prem-pack-install-upgrade.zh.md`](./on-prem-pack-install-upgrade.zh.md) · 工具 [`local-perm-install-tools.zh.md`](./local-perm-install-tools.zh.md) · 安全 [`on-prem-security-baseline.zh.md`](./on-prem-security-baseline.zh.md)

## 使用约定（agent / 人）

1. **先读本表再 scp / SSH**，按店名选行；**禁止**默认某一店（例如一律 Pirata）。
2. 用户只说「scp 上去 / 升店机」而未点名 → **先问是哪一家**（或对照本表列出让用户选）。
3. 解压目录约定：`/home/<ssh_user>/mesa-on-prem-<ver>/`（含 `manifest.json`）。
4. 升级命令（店主本机 sudo；agent **不代跑** `sudo upgrade.sh`）：

```bash
export MESA_HOME=/opt/mesa
cd /opt/mesa/current/deploy/on-prem
sudo -E ./scripts/upgrade.sh /home/<ssh_user>/mesa-on-prem-<ver>
```

5. Tailscale 主机名以 `tailscale status` 为准；变了就改本表。

## 店机表

| 店名（口语） | Tailscale 主机名 | Tailscale IPv4 | 常见局域网 | SSH 用户 | SSH 认证备注 | `MESA_HOME` | 备注 |
|---|---|---|---|---|---|---|---|
| Pirata | `pirata-ms-7e05` | `100.83.99.13` | （现场 LAN） | `remoteadmin` | 本机经 Tailscale 时常为身份信任（`Authenticated using "none"`），**不代表已配密钥** | `/opt/mesa` | Mode B 样板店 |
| Grande Fortuna | `grandefortuna-thinkcentre-m715q` | `100.122.40.70` | `192.168.1.199`（曾见） | `grandefortuna` | 需密码（或后续改 key / Tailscale SSH）；**无**本机「none」信任时勿假定能免密 | `/opt/mesa` | ThinkCentre M715q |

### SSH 目标写法

```text
<ssh_user>@<Tailscale主机名>
# 例
remoteadmin@pirata-ms-7e05
grandefortuna@grandefortuna-thinkcentre-m715q
```

### 新店怎么加

1. 店机装好 Tailscale + openssh，记下 **主机名、IPv4、SSH 用户**。  
2. 在上表加一行。  
3. 密码只写入本机 Agent 个人 store 的 `on-prem-store-credentials.md`（或 Will 当面告知），**永不 commit**。  
4. 用 `scp` 试通后再写交付笔记。

## 与 Cursor 站立规则

Cursor User Rule 里若仍只写 Pirata：以**本文件**为准；排障/scp/升级前打开本表选店。  
诊断只读、不代跑 `sudo upgrade.sh` 的约定不变。
