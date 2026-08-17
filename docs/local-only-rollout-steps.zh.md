# 门店纯本地部署：落地步骤（方案定稿）

> **状态：方案已定稿**（2026-07-24；**2026-08-01** 明确：店机 = 原生 Ubuntu，Windows/WSL 全栈安装作废；打印仍 Windows agent）  
> **工程完成度 / 卡点交接：** [`on-prem-handoff.zh.md`](./on-prem-handoff.zh.md)  
> 冲突时以本文为准（产品步骤）。细设计历史稿 [`local-on-premise-deployment-plan.md`](./local-on-premise-deployment-plan.md)（文首已标明作废的 Windows 全栈路径）。  
> **打包真源：** [`technical/on-prem-pack-install-upgrade.zh.md`](./technical/on-prem-pack-install-upgrade.zh.md)  
> ADR：[`ADR-001`](./decisions/ADR-001-offline-first.md)、[`ADR-002`](./decisions/ADR-002-local-database.md)、控制面 [`ADR-004`](./decisions/ADR-004-on-prem-entitlement.md)

## 0. 一句话说清楚

**店里只有一套 Farvoo，跑在店内主机上。** 域名指到这台机。没有平台 SaaS，没有「平时云、断网切本地」，没有双库同步。

```text
顾客 / 店员 / 厨房  ──域名或局域网──►  本机 Docker（Web + 本地 Supabase）
                                              │
                                         print_jobs
                                              │
                                    Windows print-agent（桥）
                                              │
                                         USB / 网口打印机
```

- 店员：开台 / 点单 / 收款 / 打票 / 关台 → **永远打本机**（断公网只要局域网还在，就能干）。
- 顾客扫码：域名进本机；断公网扫不了 → **可接受**。
- 打印：**现有 Windows print-agent = Windows 侧桥**（不进 Docker）；USB + 网口照旧。桥的另一头从「平台云」改成「本机 Farvoo」。
- **DNS 和业务代码不相干**：解析在路由器/公网 DNS/隧道侧做。

---

## 1. 已拍板（不要再扯回去）

| 项 | 决定 |
|----|------|
| 权威数据 | 只有店内 Postgres（自托管 Supabase） |
| 平台云 SaaS | **客户交付不做**；本店营业不依赖 Vercel + 云库 |
| 店员路径 | 固定本机，无故障切换、无热备双写 |
| 顾客扫码 | 域名进本机；断公网挂掉没事 |
| 打印 | **agent 留 Windows**（= 桥接）；不进 Docker；USB + TCP 9100 |
| DNS / 证书 | 安装与网络事项，不塞进业务逻辑代码 |
| 研发环境 | `dev` / `stage` / `cloud` **保留**，只给研发；客户走 `on-prem` 发行 |

### 1.1 明确不做

- PWA / 浏览器离线 POS、IndexedDB 双写订单  
- 云 ↔ 本地自动切换、双库智能合并  
- 把 print-agent 收进 Docker / 取消托盘（第一版）  
- 用 `npm run dev` 当客户生产  
- 第一版强依赖「无 Docker 授权的任意破电脑」  
- **Windows / WSL / Docker Desktop 跑 Farvoo Web+库全栈**（已作废；店机仅 Ubuntu）

### 1.2 还剩什么（多数不挡 POC）

| 项 | 状态 | 何时必须定 |
|----|------|------------|
| 备份上 cloud、一天一次 | **已废弃上报** | 店内日切只做清台 + 本机 `backup-local`；不上报经营指标 |
| 店机 OS / 运行时 | **已定** | **Ubuntu 22.04/24.04 + Docker Engine**（原生）；安装器 `install-ubuntu.sh` |
| 现有云店迁本地 | 未定 | **仅当有存量 SaaS 店要迁**；无则跳过 |
| 顾客公网扫码：店内 DNS vs 隧道 | 未定 | 试点前；**POC 可用局域网 IP/书签** |
| 单店是否装 `apps/ops` | 默认不装 | 有平台代运需求再加 |
| 葡萄牙财政 Agent | 不进第一版 | 另立项 |

**架构上已无卡点。** 余下是工程量与试点前的交付选项。

---

## 2. 常见疑问（人话）

### 2.1 打印：agent 留 Windows = 桥接，不是两条路

Docker 里的 Linux 栈碰不到本机 USB 队列；所以要有一个 **Windows 程序**当桥。你们**已经有**这座桥：`MesaPrintAgent.exe`。

```text
本机 Web/库 ──API──► print-agent（Windows）──► USB / 网口
```

不是另做桥，也不是第一版把打印塞进 Docker。只需让 agent **连本机 URL**，不要连已不存在的平台云。

### 2.2 「生产镜像」是什么？

开发：`npm run dev` 现炒。  
**生产镜像**：先 `build` 打成 Docker 里的运行罐头，店里只负责开罐头。版本固定、能开机自启。

### 2.3 「Compose」是什么？

一张清单（`compose.yaml`），一句命令拉起网关、Web、库、Auth、Realtime、Storage 等。打印**不在** Compose 里，旁边跑 Windows agent。镜像版本钉死，禁止客户机拉 `latest`。

### 2.4 店机跑 Docker：Ubuntu（不是 Windows Desktop）

**定稿：**

```text
Ubuntu 22.04 / 24.04 LTS（店机）
  └─ Docker Engine + Compose 插件（apt / 官方脚本，开源免费）
        └─ Farvoo Compose（Web + 自托管 Supabase + edge）
另机 Windows
  └─ MesaPrintAgent（桥 → USB / 网口）
```

| 方案 | 费用 | 地位 |
|------|------|------|
| **Ubuntu + Docker Engine** | 免费 | **唯一客户交付店机路径** |
| Windows + WSL / Docker Desktop 跑全栈 | — | **已作废**（代码与安装器已移除） |
| 仅 Windows 跑 print-agent | — | **保留**（打印桥，不跑 Web/库） |

开机：Ubuntu `systemd` 单元 `mesa-on-prem.service` 拉栈；不依赖 Windows 计划任务 `MesaOnPremStack` / `MesaOnPremBackup`。

### 2.5 夜间关台 + 本机备份——店内一条日切

**已定（店内 Ubuntu）：**

- **一条** `mesa-daily-cutover.timer`（Lisbon 05:05）：夜间关台 → 本机 `backup-local`。  
- 云 SaaS 夜间关台仍走 Vercel cron，互不影响。  
- 不向平台上报经营日报；店主增值分析仍在本机懒密封。

---

## 3. 别指望「只打包 + 改配置」

| 块 | 配置/打包够不够 | 实话 |
|----|-----------------|------|
| 本机跑库 + Web | 接近，但要生产镜像和 Compose | 不能拿 `npm run dev` 交货 |
| 域名指到店 | **纯网络配置** | 与业务代码无关 |
| 打票 | **大体够用** | agent 留 Windows；改连本机 URL + 开机自启 |
| 开机自启 / 备份 / 升级 | **不够** | 要安装器和运维组件 |

---

## 4. 总览：几大步

```text
① 定支持范围（硬件 / Docker / 打印机 / 域名方式 / 备份策略）
② 本机生产栈（Web 生产镜像 + Compose 本地 Supabase）
③ print-agent 对接本机（URL / 配对 / 开机）——桥留 Windows
④ 域名与证书指到本机（可并行，偏配置）
⑤ 安装器、开机自启、健康检查（含 agent）
⑥ 备份与恢复
⑦ 升级与回滚（Web/库镜像 + agent 安装包版本）
⑧ 试点验收
```

---

## 5. 分步明细

### 步骤 ①：定支持范围

**干什么**

- 主机：**Ubuntu 22.04/24.04**；建议 4 核 / 16GB / 256GB SSD；常开 + 建议 UPS。  
- 运行：**Docker Engine + Compose** 跑 Web/库（见 §2.4）。  
- 打印：另机 **Windows** MesaPrintAgent；USB 与网口均可。  
- 域名：在「店内 DNS」与「公网 DNS/隧道」中选定推荐项并写进矩阵。  
- 备份：本机日任务（清台 + backup-local）；细节见步骤 ⑥。  
- 验收边界：断公网必须能开台、点单、收款、打票、关台；顾客扫码不断网验收。

**怎样算完**

- [ ] 支持矩阵一页定稿  
- [ ] 不做清单与 §1.1 一致  
- [ ] §1.2 缺口有书面选择或「试点前再定」标记  

---

### 步骤 ②：本机生产栈（Web + 本地库）

**干什么**

- Compose 拉起自托管 Supabase（Auth / DB / Realtime / Storage）+ Web。  
- Web：**生产镜像**（standalone），env 指向本机 Supabase。  
- 按现有 migrations 顺序执行；每店独立密钥。  
- 数据目录固定（如 `C:\ProgramData\Farvoo\`），升级不得误删。  
- 单机默认一家店（一个 restaurant / slug）；RLS 仍保留。

**怎样算完**

- [ ] 空机可起全套容器  
- [ ] 本机浏览器：登录、开台、点单、结账、关台  
- [ ] **拔外网**后上述仍成功  

---

### 步骤 ③：print-agent 对接本机（桥，不进 Docker）

**干什么**

- 保持托盘、配对、USB、TCP 9100、出纸逻辑。  
- 服务器地址 = **本机 Farvoo**（域名或 `127.0.0.1`）。  
- 本机 Web 照旧写 `print_jobs`；agent claim / 回报走本机 API；Realtime 也指向本机。  
- 本机 HTTPS 若自签：agent 信任策略要可安装（或安装器写入）。  
- 开机：栈起来后 agent 起来。  
- Dashboard 打印助手可保留下载/配对，文案改为连本机。

**怎样算完**

- [ ] 拔外网：厨打 + 账单至少一种打印机实测通过  
- [ ] 重启后 agent 能再连本机打票  
- [ ] 不依赖公网平台云  

---

### 步骤 ④：域名与证书（可与 ②③ 并行）

**干什么**

- 按矩阵实施店内 DNS 或公网 DNS/隧道。  
- 证书有网时签好；断网仍可用已签发证书。  
- 桌码/书签用稳定主机名，不印会变的 IP。

**怎样算完**

- [ ] 用域名打开本机 Farvoo  
- [ ] 换 DNS 实现不需发业务代码版本  

---

### 步骤 ⑤：安装、开机自启、健康检查

**干什么**

- 安装：`install-ubuntu.sh`（Docker / 磁盘 / 端口 → 目录与密钥 → 起栈 → 迁移 → `/setup` 认领）。  
- 开机自启：`mesa-on-prem.service` 拉 Docker 栈；print-agent 在 **Windows 另机** 自启（托盘/登录，见 agent 文档）。  
- 健康检查：首页、登录、DB、Realtime、agent 心跳/最近打印、磁盘。

**怎样算完**

- [ ] 空机（Ubuntu）重复装到可营业  
- [ ] 重启店机后栈自动起来、无需手点  
- [ ] 失败有人话原因  

---

### 步骤 ⑥：备份与恢复

**干什么**

- 每日任务：本机一致性导出（Postgres + Storage 菜单图等 + 关键配置）→ 校验 → **上传到现有 cloud 环境**（§2.5）。  
- 本机保留最近若干份，避免「只信远端、店里断网无法自救」。  
- RPO 按产品约定约 **1 天**（一天一传）；RTO 写进交付说明（换机恢复数小时级为量级目标）。  
- 上传用店机出站 HTTPS；cloud 只收备份，不反向写经营库。  
- 定期做一次「从 cloud 拉回空机」演练。

**怎样算完**

- [ ] 连续多日能在 cloud 侧看到新备份对象/快照  
- [ ] 拔外网当日：本地备份仍成功，上传失败可重试、不挡营业  
- [ ] 空机仅用 cloud 备份能恢复到可开台打票  
- [ ] 备份失败有告警（本地或云侧可察）

---

### 步骤 ⑦：升级与回滚

**干什么**

- 版本钉死：Web / Supabase 镜像 digest + 迁移集合 + **print-agent 安装包版本**。  
- 维护窗：备份 → 升栈/迁移 → 升或保留 agent → 冒烟；失败回滚。  
- 禁止营业中自动乱升 `latest`。

**怎样算完**

- [ ] ≥3 次版本升级演练  
- [ ] 一次迁移失败回滚到可营业  

---

### 步骤 ⑧：试点

**干什么**

- 内部机 → 1～3 家真店。  
- 必测：拔外网、重启、打印机拔线、磁盘将满、备份失败、升级一次。

**怎样算完**

- [ ] 完整营业日断公网仍完成开台→点单→厨打→收款→账单→关台  
- [ ] 问题进矩阵或修版本，不靠现场改库  

---

## 6. 建议排期（量级）

| 顺序 | 内容 | 大约 |
|------|------|------|
| ① | 支持矩阵 + §1.2 缺口选择 | 数天 |
| ② | 本机生产栈 + 断网店员闭环 | 2～3 周 |
| ③ | agent 对接本机 | 数天～1 周 |
| ④ | 域名（并行） | 按店小时～1 天 |
| ⑤ | 安装与自启 | 约 1～2 周 |
| ⑥ | 备份恢复 | 约 2 周 |
| ⑦ | 升级回滚 | 约 2～3 周 |
| ⑧ | 试点 | 约 4 周 |

优先内部 **②+③ POC**，再堆 ⑤⑥⑦。

---

## 7. 验收清单

**必须过**

- [ ] 拔外网：开台、点单、收款、打票、关台  
- [ ] 重启：Docker 栈 + print-agent 自起，数据在，不靠平台云  
- [ ] 打印走本机 agent（USB 或网口）  
- [ ] 日志无密码 / JWT / 整单隐私乱打  

**不强求**

- [ ] 顾客断公网仍能扫码  
- [ ] agent 进 Docker / 无托盘  
- [ ] 任意破电脑一键装  

---

## 8. 文档关系

| 文档 | 角色 |
|------|------|
| **本文** | 方案定稿、步骤、验收；产品步骤冲突时最高优先 |
| [`on-prem-handoff.zh.md`](./on-prem-handoff.zh.md) | **工程完成度与卡点交接**（控制面 + Mode B 包） |
| [`technical/local-perm-install-tools.zh.md`](./technical/local-perm-install-tools.zh.md) | local-perm 安装技术工具清单（OS / Docker / 镜像 / 可选组件） |
| [`local-on-premise-deployment-plan.md`](./local-on-premise-deployment-plan.md) | Compose/备份/升级细设计；打印进 Docker **以本文为准不做** |
| [`ADR-001`](./decisions/ADR-001-offline-first.md) | 纯本地权威，非 PWA 离线 |
| [`ADR-002`](./decisions/ADR-002-local-database.md) | 店内自托管 Supabase 为权威 |
| [`ADR-003`](./decisions/ADR-003-printing-strategy.md) | 打印策略；本地交付时 agent 连本机 |
| [`ADR-004`](./decisions/ADR-004-on-prem-entitlement.md) | 云/本地双模式 + 授权控制面 |

---

## 9. 下一步（实施入口）

工程状态先看 [`on-prem-handoff.zh.md`](./on-prem-handoff.zh.md) §5。产品步骤仍可按：

1. **P0：** 用最新 stamped zip 在 **Ubuntu** 店机/验证机跑绿 `install-ubuntu.sh` → `/setup`。  
2. **步骤 ①** 一页支持矩阵（Ubuntu 硬件 / Docker Engine / 打印机；扫码方式可写「POC 用局域网」）。  
3. **步骤 ②+③ 内部 POC**：本机生产栈 + **另机** agent 连本机，拔外网开台结账打票。  
4. 控制面连云 UAT（push / Ops 密钥）→ 再 ⑤ → ⑥ → ⑦ → ⑧ 试点。
