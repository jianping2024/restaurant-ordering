# Mesa 客户本地私有化部署方案

> 状态：架构建议稿（细设计参考）  
> 日期：2026-06-23；打印路径于 2026-07-24 与定稿对齐  
> 适用范围：未来仅向餐厅客户提供 Windows 本地安装版本；Web、数据库、认证、实时服务、图片存储运行在本机 Docker 中。  
> **方案定稿（人话步骤，冲突时以它为准）**：[`local-only-rollout-steps.zh.md`](./local-only-rollout-steps.zh.md)。  
> **打印定稿**：print-agent **留在 Windows 宿主机**（桥接），**不**强制进入 Compose；下文「打印进 Docker / 取消托盘」视为远期备选，第一版不做。

## 1. 结论

建议把 Mesa 从当前的“开发环境切换模式”改造成一个有明确版本、可安装、可运维、可恢复的本地软件产品：

- 每家餐厅部署一台专用 Windows 主机，通过 Docker Desktop + WSL2 运行 Linux 容器栈。
- 使用固定版本、固定镜像摘要的 Docker Compose 发行包交付。
- Web、完整自托管 Supabase、反向代理、备份代理、日志代理和升级代理进入 Docker Compose；**打印使用现有 Windows print-agent，指向本机 Web API**。
- 客户端只需要浏览器，不要求在收银机、厨房屏或手机安装开发工具。
- 安装、升级、备份和日志上传只允许主动向外发起 HTTPS 连接，不开放数据库或远程管理端口到公网。
- 互联网中断时，点餐、后台、厨房、结账和打印继续在本地运行；远程备份、日志上传和升级检查延后执行。

不建议把当前 `npm run dev`、`npm run stage`、`npm run cloud` 中任何一种直接交付给客户。这些命令运行的是开发服务器，并依赖人工管理环境文件，不具备生产级进程管理、备份、升级和恢复能力。现有 print-agent **可继续作为客户版打印桥**（USB / WinSpool / TCP 9100），但须对接本机 Mesa，而非平台云；第一版不改造成容器内 `print-worker`。

## 2. 当前项目判断

### 2.1 现有运行方式

| 命令 | 当前作用 | 是否适合客户生产 |
|---|---|---|
| `npm run dev` | Next.js 开发服务器 + 本地 Docker Supabase | 否 |
| `npm run stage` | Next.js 开发服务器 + 云端 Stage Supabase | 否 |
| `npm run cloud` | Next.js 开发服务器 + `.env.local` 云数据库 | 否 |
| `npm run print` | 打印代理本地开发容器 | 否，需纳入正式发行栈 |

### 2.2 当前打印 Agent 的关键限制

现有 agent 有两条打印路径：

- `tcp:<ip>:9100`：直接连接 LAN 热敏打印机，可在 Linux 容器中运行；
- `winspool:<printer-name>`：调用 `winspool.drv` 向 Windows 打印队列写入 RAW 数据，只能在 Windows 进程中运行。

当前开发 Dockerfile 明确构建的是 Linux/Alpine agent，非 Windows 生产镜像；非 Windows 构建中的 Winspool 实现会直接返回“不支持 USB/Windows printer queue”。

Supabase 自托管服务使用 Linux 容器。Windows 上的 Docker Desktop 在同一运行模式下不能同时把 Supabase 跑在 Linux containers、又把现有 Winspool agent 跑成 Windows container。因此在“所有业务组件必须进入 Docker”的约束下，正式打印方案必须采用：

- 标准方案：所有打印机使用 LAN TCP 9100；
- USB 打印机：增加 USB-to-Ethernet 打印服务器或更换为带网口的机型，使其转换为 TCP 9100；
- 不把 Windows 共享打印机、USB 直通 WSL2 或 Docker Desktop USB 透传作为正式支持能力。

若未来必须支持 USB 直连，只能增加一个运行在 Windows 宿主机上的受限打印桥接服务，再由容器 agent 调用它。这属于例外架构，不符合当前“全部进入 Docker”的严格目标，应单独立项，不纳入第一版。

### 2.3 当前已经实现本地 Docker Supabase

项目当前已经具备本地 Docker Supabase 开发运行能力：

```text
supabase start
        ↓
Supabase CLI 启动本地 Docker 服务
        ↓
scripts/sync-local-supabase-env.sh
        ↓
从 supabase status 读取 API URL、anon key、service-role key
        ↓
npm run dev 使用 .env.local.dev 连接本地 Supabase
```

README 和现有脚本已经明确支持此流程。因此本地化方案不需要重新证明 Supabase 能否在 Docker 中运行，也不需要把 Supabase 替换成普通 PostgreSQL。

项目实际使用的 Supabase 能力包括：

- Auth：店主和员工身份认证；
- PostgREST/RPC：业务查询及结账、关台、转台、并台等原子操作；
- Realtime：订单、餐次、账单和打印任务实时更新；
- Storage：菜单图片；
- RLS：餐厅数据隔离；
- 数据库函数、触发器、约束和 Realtime publication。

后续工作的重点是把当前基于 Supabase CLI 的本地开发栈产品化为 Windows 客户生产发行栈：

- 将 Supabase 服务纳入 Mesa 自己的固定版本 Compose 文件；
- 固定并验证全部镜像版本和 digest，不在客户机使用浮动最新版；
- 把 schema、RLS、Realtime publication、Storage bucket 和 seed/初始化流程纳入安装器；
- 生成每个客户实例独立的数据库密码、JWT 和服务端密钥；
- 增加健康检查、日志限制、持久化、备份恢复和升级回滚；
- 将 Next.js 从 `next dev` 改为生产构建和生产启动；
- 将后台 `print-worker` 与 Web、Supabase 一起接入同一 Docker 内部网络。

结论：当前已经实现“本地 Docker 运行 Supabase”；尚未完成的是“可交付给 Windows 客户的生产级、自包含、可升级 Supabase 发行栈”。

## 3. 产品边界与目标

### 3.1 建议服务指标

| 指标 | 建议目标 |
|---|---|
| 本地业务可用性 | 互联网中断不影响核心营业 |
| 安装时间 | 标准硬件、网络正常时 20 分钟内 |
| 升级维护窗口 | 通常 5 分钟内；数据库大版本升级另行安排 |
| 数据库备份 RPO | 默认 1 小时 |
| 数据库恢复 RTO | 默认 2 小时内 |
| 本地备份保留 | 7 天 |
| 远程备份保留 | 24 个小时点、30 个日点、12 个月点 |
| 日志本地保留 | 14 天或 2 GB，以先到者为准 |
| 远程日志 | 默认错误和运行指标；敏感日志需客户授权 |

RPO/RTO 必须写入客户合同或服务说明，不能只作为内部技术假设。

### 3.2 明确不做

- 不支持客户任意 Windows 电脑作为数据库主机。
- 不支持直接暴露 PostgreSQL、Supabase Studio、Docker API 或 SSH 到公网。
- 不支持自动升级到未验证的 Supabase 单组件最新版。
- 不保证只有本地备份时能够应对硬盘损坏、火灾或主机丢失。
- 不把“容器正在运行”视为备份成功；必须定期执行恢复演练。

## 4. 推荐部署架构

```text
顾客手机 / 收银台 / 厨房屏 / 服务员设备
                    │
              餐厅局域网 HTTPS
                    │
             Caddy 反向代理 :443
              ┌─────┴─────┐
              │           │
         Mesa Web     Supabase Gateway
         Next.js       Auth / REST /
                       Realtime / Storage
              │           │
              └─────┬─────┘
                    │
              PostgreSQL + RLS
                    │
     ┌──────────────┼──────────────┐
     │              │              │
 打印代理       备份代理        日志/健康代理
 TCP 9100      加密后上传       出站 HTTPS
```

### 4.1 Windows 宿主机

第一版只正式支持一种基准环境：

- Windows 11 Pro 64-bit；Windows Server 暂不作为第一版承诺范围；
- WSL2、Docker Desktop 和 Docker Compose；
- BIOS/UEFI 已开启虚拟化；
- 4 核 CPU、16 GB RAM、256 GB 企业级 SSD；
- 推荐第二块 SSD 或外接加密存储保存本地备份；
- 有条件时配置 UPS，并启用断电后自动开机。

Supabase 官方给出的完整自托管栈建议资源为 4 核、8 GB 以上内存和 80 GB 以上 SSD。Mesa 还需要 Next.js、备份、日志和升级组件，因此生产基线建议提高到 16 GB。

采用 Docker Desktop 是当前 Windows 优先目标下的现实选择，但必须把以下事项纳入产品设计：

- 安装前确认 Docker Desktop 商业授权条件；
- 使用 WSL2/Linux containers，不切换到 Windows containers；
- 配置 Docker Desktop 随 Windows 启动；
- 使用专用 Windows 运维账号，避免依赖普通员工登录状态；
- 禁止 Docker Desktop 自动升级，版本随 Mesa 兼容矩阵统一发布；
- 将 WSL2 虚拟磁盘放在空间充足的固定磁盘，并监控其增长；
- 明确测试 Windows 更新、Docker Desktop 更新和异常重启后的自动恢复。

后续若 Docker Desktop 的授权或无人值守运行不满足商业交付，应评估在 Windows 上安装受控 WSL2 Linux 发行版，并在 WSL2 内直接运行 Docker Engine。该方案运维复杂度更高，不建议与第一版同时支持。

### 4.2 容器组成

建议发行栈至少包含：

- `gateway`：Caddy，只开放 `80/443`；
- `web`：`next build` 后的 Next.js standalone 生产镜像；
- `supabase-*`：固定版本的数据库、Auth、REST、Realtime、Storage、网关及必要依赖；
- `print-worker`：由现有 Go agent 核心逻辑重构的后台打印服务，只支持 TCP 9100；
- `backup-agent`：负责数据库、Storage 和配置备份；
- `support-agent`：健康检查、日志过滤上传、升级检查；
- `installer`：仅在安装和升级时运行，不常驻或仅保留受限管理接口。

Supabase Studio 默认不对客户开放。需要现场维护时，可临时只绑定到 `127.0.0.1`，通过受控运维通道访问。

### 4.3 打印模块重新设计

客户不需要理解或操作 Agent。新架构中它只是 Docker 内部的 `print-worker`，职责只有一个：可靠发现新的打印任务并自动打印。

旧设计中的下载、安装、托盘、Cloud URL、配对码、独立配置向导、凭证续期和单独升级全部取消。打印配置、状态和故障处理统一放入 Mesa 网页。

#### 4.3.1 已有可复用基础

当前系统已经具备可靠打印队列：

- 下单后按 `print_station_id` 向 `print_jobs` 写入 `pending` 任务；
- 使用 `restaurant_id` 保持租户边界；
- 按订单、批次和打印站检查重复任务；
- worker 可把任务更新为 `processing`、`done` 或 `failed`；
- 已有任务超时、失败重试、打印机路由、ESC/POS 和队列重排逻辑；
- 网页已经能读取最近任务、设备心跳、最近打印结果和路由快照。

因此不需要重新设计订单打印数据模型。需要重新设计的是任务唤醒方式、打印机状态模型和网页管理方式。

#### 4.3.2 新订单自动检测

从系统层面看，打印不是“检测订单”，而是订单、结账等业务事务产生的明确副作用。系统在提交业务结果时就应创建对应打印任务，不需要事后猜测或扫描业务表。

推荐使用 PostgreSQL Transactional Outbox。现有 `print_jobs` 直接承担 Outbox 和可靠打印队列：

```text
下单 / 加菜 / 结账 / 预结账
   ↓
一个数据库事务同时完成：
1. 更新业务数据
2. 插入对应 print_jobs
   ↓
事务提交时触发 PostgreSQL NOTIFY(job_id)
   ↓
print-worker 已通过 LISTEN 保持数据库监听，立即被唤醒
   ↓
通过 FOR UPDATE SKIP LOCKED 原子领取任务
   ↓
生成 ESC/POS 并发送到 TCP 9100 打印机
   ↓
记录 done / retry / failed / uncertain
   ↓
网页实时刷新任务和打印机状态
```

设计原则：

- 业务数据和 `print_jobs` 必须在同一个数据库事务中提交；
- 事务失败时，订单和打印任务一起回滚，不会打印不存在的订单；
- 事务成功时，打印任务一定已经持久化，不会因 Web 进程崩溃而丢失；
- PostgreSQL `NOTIFY` 只负责低延迟唤醒，`print_jobs` 才是可靠事实来源；
- worker 收到 `job_id` 后仍需从数据库读取并校验任务，不能直接打印通知 payload；
- worker 启动、数据库连接重建或异常恢复时，执行一次未完成任务恢复；
- 正常运行期间不做持续轮询；
- 使用数据库原子领取，防止多个 worker 重复处理同一任务；
- Web 请求不等待物理打印完成；业务提交成功后立即响应，打印异步执行；
- 已打印但状态回写失败属于“不确定结果”，必须进入人工确认，不能自动盲目重打。

这里需要区分“系统知道要打印”和“Web 进程亲自打印”：

- 系统当然知道下单或结账后需要打印，因此应在业务事务中立即创建打印任务；
- Web 进程不应直接连接打印机，因为打印机离线、缺纸或响应缓慢会阻塞下单和结账；
- Web 进程也不应在数据库提交后再调用一次普通 HTTP enqueue，因为这是不可靠的双写；
- 专用 `print-worker` 负责所有网络 I/O、重试、超时和打印状态。

该设计同时满足：

- **高效**：事务提交后立即唤醒，无持续轮询；下单请求不等待打印机；
- **安全**：打印服务不需要 service-role key，只使用权限受限的数据库角色或内部 API；
- **可靠**：业务结果与打印任务同事务，通知丢失也不会丢任务；
- **优雅**：业务层只声明“需要打印什么”，worker 专注“如何打印”；
- **可扩展**：同一机制覆盖后厨单、酒水单、预结账单、付款小票和补打。

Supabase Realtime 继续用于网页状态刷新，但不作为后端打印任务的核心传输通道。核心链路使用 PostgreSQL 原生事务、`LISTEN/NOTIFY` 和可靠队列表。

#### 4.3.3 业务事务设计

每个会产生打印的业务动作应调用数据库函数或服务端事务，而不是由多个独立请求分别写业务表和打印表：

| 业务动作 | 同一事务内的操作 |
|---|---|
| 首次下单 | 创建/更新订单、写入菜品批次、创建各档口 `station_ticket` |
| 加菜 | 追加菜品批次、创建该批次各档口 `station_ticket` |
| 预结账 | 固化账单快照、创建 `pre_bill` |
| 确认付款 | 更新付款/分单状态、按产品规则创建付款小票 |
| 手工补打 | 创建引用原始业务快照的新打印任务，记录操作人和原因 |

必须为业务事件设置幂等键，例如：

```text
restaurant_id + job_type + business_event_id + print_station_id
```

数据库建立唯一约束，防止浏览器重试、网络重发或重复点击产生两张相同小票。不要只依靠应用代码先查询再插入，因为并发请求仍可能重复。

打印任务 payload 应保存打印时需要的不可变快照。后续菜名、价格、桌名或打印站配置发生变化，不应改变已经创建的小票内容。

#### 4.3.4 `print-worker` 职责

`print-worker` 作为 Compose 常驻服务：

- 使用最小权限数据库角色连接本地 PostgreSQL；
- 通过 `LISTEN` 等待新的 `print_jobs` 提交通知；
- 使用数据库 RPC 或 `FOR UPDATE SKIP LOCKED` 原子领取任务；
- 启动和重连时恢复遗留的 `pending` 及超时 `processing` 任务；
- 根据打印站读取打印机配置；
- 生成 ESC/POS RAW 数据；
- 检查并连接打印机 `IP:9100`；
- 执行打印、重试和状态回写；
- 周期性检测已配置打印机；
- 提供健康状态和测试打印内部接口；
- 接收 `SIGTERM` 后停止领取新任务并安全退出。

可以复用现有 Go agent 的 ESC/POS、路由、TCP 打印、调度、重试和部分心跳代码，但不应继续把它作为一个面向用户的独立产品。

#### 4.3.5 打印机配置和状态模型

打印机配置应成为服务端正式数据，而不是只保存在 agent 的 `config.json` 或设备路由快照中。建议新增餐厅范围的打印机表，例如：

```text
restaurant_printers
  id
  restaurant_id
  display_name
  host
  port
  enabled
  last_seen_at
  last_status
  last_error
  last_successful_print_at
  created_at
  updated_at
```

打印站与打印机使用独立映射表：

```text
print_station_printers
  restaurant_id
  print_station_id
  printer_id
  priority
```

这样可以支持：

- 多个档口共用一台打印机；
- 一个档口配置主打印机和备用打印机；
- 更换打印机 IP 时不修改档口；
- 网页统一显示每台打印机的真实状态；
- worker 重建或升级后自动恢复配置；
- 所有查询和修改继续受 `restaurant_id` 与 RLS 约束。

这是数据库 schema 变更，实施时必须新增 migration，并同步更新 `docs/ai-schema.md`。

#### 4.3.6 网页“打印中心”

当前 `/dashboard/settings/print-assistant` 应重构为“打印中心”，删除以下内容：

- Agent 下载；
- 配对码；
- 已配对设备和凭证到期；
- 本机打开设置；
- Agent 单独版本升级提示。

页面建议包含：

1. **系统状态**
   - 打印服务：运行中、离线、启动中或异常；
   - 任务通知通道：已连接、重连中或异常；
   - 待打印、打印中、失败和需人工确认的任务数；
   - 最近一次成功打印时间。

2. **打印机列表**
   - 名称、IP、端口；
   - 在线、离线、缺纸/盖开状态（仅设备协议支持时）、未知；
   - 最近检测时间、最近成功打印、最后错误；
   - 启用/停用、编辑、测试连接、测试打印。

3. **档口映射**
   - 收银、厨房、水吧等打印站绑定到物理打印机；
   - 显示未映射档口；
   - 可选主打印机和备用打印机。

4. **打印任务**
   - 最近任务及 `pending/processing/done/failed/uncertain` 状态；
   - 按档口、打印机和状态筛选；
   - 失败原因和处理建议；
   - 明确区分“确认未打印后重试”和“直接重试”。

5. **运行设置**
   - 营业时间；
   - 失败重试次数和间隔；
   - 打印机检测频率；
   - 订单小票和账单打印策略。

页面状态通过 Supabase Realtime 自动更新；页面重新进入或 Realtime 重连时重新读取当前状态。

#### 4.3.7 打印机在线状态

TCP 9100 端口连接成功只能说明网络端口可达，不能可靠判断缺纸、开盖或打印是否真正完成。状态应分级展示：

| 状态 | 判断依据 |
|---|---|
| 在线 | 最近 TCP 探测成功 |
| 离线 | 连续多次 TCP 连接失败 |
| 打印正常 | 最近任务发送成功 |
| 打印失败 | 连接或写入失败 |
| 设备告警 | 仅在打印机支持 SNMP、厂商 API 或 ESC/POS 双向状态时提供 |
| 未知 | worker 未运行、刚启动或长时间未检测 |

第一版承诺“网络可达和打印发送结果”，不要把 TCP 连接成功表述成确定有纸或确定已出纸。后续可按支持的打印机型号增加 SNMP 或双向状态协议。

#### 4.3.8 打印机发现

Windows Docker Desktop 下，容器看到的通常是 Docker/WSL2 虚拟网段，现有根据容器网卡自动扫描 `/24` 的实现不可靠。

第一版采用：

- 管理员在网页填写打印机固定 IP；
- 提供连接测试和测试打印；
- 安装时为打印机设置静态 IP 或 DHCP reservation。

后续如需自动发现，由网页明确提供餐厅 LAN CIDR，例如 `192.168.1.0/24`，worker 只扫描该私有网段。扫描必须有范围限制、速率限制和审计记录。

#### 4.3.9 旧 Agent 功能处理

| 旧功能 | 新设计 |
|---|---|
| Windows 安装包 | 删除 |
| 托盘程序 | 删除 |
| Cloud URL | 删除，使用 Docker 内部地址 |
| 6 位配对码 | 删除 |
| 设备凭证续期 | 改为安装时内部生成和自动轮换 |
| 本地 configure 页面 | 合并到网页打印中心 |
| Agent 下载和独立升级 | 随整个 Mesa Compose 升级 |
| Winspool/USB | 第一版不支持 |
| TCP 9100 | 保留 |
| ESC/POS、路由、重试 | 保留核心逻辑 |
| 心跳 | 改为 print-worker 服务状态 |

配对表和旧 API 可以短期保留兼容现有 Cloud 版本，但新的 Windows 本地安装流程不使用它们。删除旧结构必须通过后续新增 migration，不能修改已应用迁移。

#### 4.3.10 最终结论

新方案不是“把旧 Agent 安装进 Docker”，而是从旧 Agent 中提取打印执行能力，重构成用户不可见的本地 `print-worker`。

用户只需要：

1. 在网页录入或选择打印机；
2. 把打印站映射到打印机；
3. 执行一次测试打印；
4. 在网页查看状态和处理失败任务。

之后新订单由本地数据库队列自动触发打印，不需要托盘程序、配对、单独安装或人工启动。

### 4.4 数据卷

持久数据必须使用明确、可备份的受管位置，不依赖匿名 Docker volume：

```text
C:\ProgramData\Mesa\
  releases\<version>\       # 发行包
  current\                  # 当前版本元数据
  config\                   # ACL 仅 Administrators/SYSTEM
  data\                     # Windows 可见的非数据库持久数据
  data\storage\             # 菜单图片等对象
  data\print-worker\        # 打印服务缓存和运行状态
  backups\                  # 本地加密备份
  logs\                     # 有大小和保留期限制的日志
```

安装和升级绝不能删除 `data/`、`backups/` 或覆盖实例密钥。

Storage、print-worker 缓存、备份和日志可使用明确的 Windows bind mount。打印机配置本身保存在数据库。PostgreSQL 数据目录默认放在命名且有固定标识的 WSL2 ext4 volume 中，不直接运行在 NTFS bind mount 上；备份代理定期执行一致性导出到 Windows 可见目录和远程仓库。安装器必须记录 volume 名称，卸载和升级脚本不得删除它。

## 5. 局域网访问与 HTTPS

扫码点餐要求各种手机都能稳定解析地址。不要使用动态 IP、`localhost` 或兼容性不稳定的 `.local` 名称生成二维码。

推荐方案：

1. 每个实例分配稳定域名，例如 `r-<instance-id>.local.mesa.example`。
2. 餐厅路由器或本地 DNS 把该域名解析到 Mesa 主机固定局域网 IP。
3. 使用 DNS-01 方式申请公网信任的 TLS 证书，证书和私钥只保存在本地主机。
4. 二维码永久使用该域名和稳定 `table_id`，不使用 IP。
5. 网络离线时，本地 DNS 继续工作，已签发证书继续有效；恢复联网后自动续期。

如果无法控制餐厅 DNS，可以退化为固定 IP + HTTP，但应作为明确的低保障安装模式，并评估浏览器 Cookie、安全头和未来 Web API 的限制。

防火墙规则：

- 局域网入站仅开放 `443`，必要时开放 `80` 跳转；
- 打印机端口只允许 Mesa 主机访问；
- PostgreSQL、Supabase 内部端口、Docker socket 不对局域网和公网开放；
- 出站只允许 DNS、NTP、证书、备份、日志和升级所需目标。

## 6. 一键安装设计

### 6.1 安装包形态

提供两个 Windows 发行物：

- 在线安装器：代码签名的 `.exe` 或 `.msi`，下载指定稳定版本；
- 离线安装包：代码签名的 `.exe`/`.msi`，包含所有镜像、迁移、安装程序和校验清单。

发行包结构建议：

```text
mesa-<version>/
  manifest.json
  manifest.sig
  compose.yaml
  compose.production.yaml
  images.lock
  migrations/
  scripts/
    install.ps1
    upgrade.ps1
    rollback.ps1
    backup.ps1
    restore.ps1
    diagnose.ps1
  checksums.sha256
```

`images.lock` 必须固定镜像 tag 和 digest。禁止使用 `latest`。

### 6.2 安装流程

安装器应当幂等，可重复执行：

1. 检查 Windows 版本、虚拟化、WSL2、CPU、内存、磁盘、时间同步、端口和 Docker Desktop。
2. 必要时安装/启用 WSL2 与经过验证的 Docker Desktop 版本；需要重启时保存安装状态并在重启后续跑。
3. 创建专用 Windows 运维账号、计划任务和 `C:\ProgramData\Mesa`，设置最小 ACL。
4. 生成数据库密码、JWT 密钥、服务端密钥、备份密钥和实例 ID。
5. 要求操作员填写餐厅名称、域名、固定 IP、备份授权和支持级别。
6. 导入或拉取固定版本 Linux 镜像并校验签名/摘要。
7. 启动数据库和 Supabase 基础服务。
8. 按顺序执行项目迁移，不执行开发 seed。
9. 启动 Web、打印、备份和支持服务。
10. 创建首个店主账号；初始密码必须首次登录修改。
11. 配置 LAN 打印机 IP、端口和站点映射，并执行测试打印。
12. 执行端到端验收：登录、建测试桌、下测试单、Realtime、图片上传、打印、备份。
13. 创建 Windows 开机/登录恢复任务，验证重启后自动启动。
14. 生成不含密钥的安装报告和恢复码保管提示。

“一键”应理解为一个受控安装向导，而不是隐藏错误的无人值守脚本。前置条件不满足时必须停止，并给出可操作错误。

## 7. 日志、监控与远程支持

### 7.1 本地日志

所有服务输出结构化 JSON 日志，至少包含：

- 时间、实例 ID、服务名、版本、事件类型、严重级别；
- 请求关联 ID；
- 健康状态、备份结果、升级结果；
- 打印任务 ID 和结果，但纸面内容默认不上传。

禁止记录：

- JWT、Cookie、密码、数据库连接串、service key、配对码；
- 顾客姓名、电话、地址、完整订单内容；
- 菜单图片原文件；
- SQL 参数或完整请求体，除非经过显式脱敏和临时授权。

容器日志必须启用滚动限制，避免磁盘被打满。

### 7.2 远程上传

`support-agent` 使用 mTLS 或短期设备凭证，仅主动连接供应商日志入口：

- 常态上传：版本、在线状态、磁盘、CPU、服务健康、备份时间、错误计数；
- 错误上传：脱敏后的 WARN/ERROR；
- 诊断包：客户在后台明确授权后生成，有有效期和审计记录；
- 失败重试：本地加密队列，指数退避，设置最大占用空间；
- 客户可在管理页查看上传状态并关闭非必要遥测。

远程日志平台应按 `instance_id` 隔离权限。支持人员默认不能查询其他客户实例，所有访问保留审计记录。

### 7.3 健康检查

不要只检查容器存活。至少验证：

- HTTPS 首页可访问；
- Auth 登录接口正常；
- REST 执行只读探针；
- Realtime 建连和事件探针；
- Storage 写入/读取/删除专用探针对象；
- 数据库可连接、剩余磁盘充足；
- 最近一次本地和远程备份成功；
- 打印代理心跳及最近错误；
- 证书到期时间；
- 当前版本和可用升级版本。

## 8. 数据库和文件远程自动备份

### 8.1 备份范围

必须同时备份：

- PostgreSQL 全部业务 schema、`auth`、`storage` 元数据、函数、触发器、RLS 和权限；
- Storage 实际对象文件；
- 打印代理必要状态；
- 经加密的实例配置和密钥恢复包；
- 当前应用版本、镜像摘要和迁移版本。

仅备份数据库不能恢复菜单图片；仅复制 PostgreSQL 数据目录也不等于可跨版本恢复。

### 8.2 推荐实现

第一阶段采用“PostgreSQL 一致性逻辑备份 + 文件快照 + restic 加密上传”：

- 每小时执行一次数据库逻辑备份；
- 每日执行一次 Storage 和配置文件备份；
- 备份先写临时文件，成功后原子改名；
- 对备份执行完整性校验；
- 使用 restic 客户端加密并上传到 S3 兼容对象存储；
- 远端 bucket 按客户隔离，凭证只允许写入本实例前缀；
- 云端开启对象版本控制、不可变保留或 Object Lock；
- 备份密钥与对象存储账号分离保管。

逻辑备份恢复简单，适合当前餐厅级数据规模。若单实例数据库持续增长到逻辑备份无法在计划窗口内完成，再升级为 PostgreSQL 物理基础备份 + WAL 连续归档，将 RPO 降至分钟级。

### 8.3 默认计划

```text
每小时：数据库备份
每天 03:00：数据库 + Storage + 配置完整备份
每天 04:00：完整性校验、清理过期快照
每周：自动恢复到隔离临时数据库并执行基础校验
每季度：人工灾难恢复演练并记录耗时
```

只有同时满足以下条件才标记“备份成功”：

1. 导出命令成功；
2. 备份文件非空且校验成功；
3. 加密上传成功；
4. 远端仓库能够列出新快照；
5. 最近一次定期恢复演练成功。

### 8.4 恢复流程

恢复工具必须要求明确选择实例、时间点和目标目录，默认恢复到隔离环境：

1. 安装与备份记录匹配的 Mesa/Supabase/PostgreSQL 版本。
2. 拉取并解密备份。
3. 恢复数据库角色、schema 和数据。
4. 恢复 Storage 文件和实例配置。
5. 运行迁移版本检查，不自动跳过失败迁移。
6. 执行业务一致性检查：餐厅、用户、桌位、活跃餐次、订单、账单、打印队列。
7. 人工确认后切换生产流量。

## 9. 软件升级与回滚

### 9.1 版本策略

Mesa 发行版本使用语义化版本，例如 `2.3.1`，每个版本绑定：

- Web 镜像 digest；
- 打印代理镜像 digest；
- Supabase 全套兼容镜像版本；
- 数据库迁移集合；
- 最低可升级版本；
- 配置 schema 版本；
- 发布说明和已知风险。

Supabase 官方说明其自托管 Compose 版本是作为组合测试的，单独混用各组件版本不保证兼容。因此 Mesa 应维护自己的兼容性矩阵，在 Stage 和升级测试环境验证后再发布。

### 9.2 发布通道

- `stable`：默认客户通道，分批发布；
- `pilot`：少量内部或试点餐厅；
- `manual`：高风险客户，仅人工批准升级。

升级代理每天检查一次签名 manifest，但默认只下载，不应在营业时间自动安装。

### 9.3 升级流程

1. 检查磁盘、服务健康、当前版本和升级路径。
2. 下载到新的 `releases/<version>`，验证签名、摘要和镜像 digest。
3. 执行一次远程备份和本地升级前快照。
4. 进入维护模式，阻止新下单和结账写入。
5. 等待正在处理的请求和打印任务达到安全状态。
6. 停止应用写入服务。
7. 执行数据库迁移；迁移必须有超时、日志和失败退出。
8. 启动新版本并运行健康检查和关键业务冒烟测试。
9. 健康检查通过后切换 `current` 并退出维护模式。
10. 失败则回退应用和配置；如果迁移已产生不兼容数据库变更，执行升级前数据库恢复。
11. 上传脱敏升级报告。

### 9.4 数据库迁移规则

- 继续使用追加式、带时间戳迁移，不修改已发布迁移。
- 优先采用 expand/contract：先增加兼容字段，再切应用，后续版本才删除旧字段。
- 大表 DDL、索引和数据回填必须评估锁表时间。
- 每个版本必须测试“旧版本数据 → 新版本”的真实升级。
- 应用镜像回滚不代表数据库自动回滚；破坏性迁移只能通过恢复备份回退。

### 9.5 不使用 Watchtower 类无条件自动升级

无条件拉取新镜像会绕过版本兼容性、迁移、备份和验收，尤其不适合涉及结账、订单、Auth 和 Realtime 的系统。升级必须由 Mesa 自己的签名发布流程控制。

## 10. 安全设计

- 每个餐厅生成独立密钥，不复制模板环境文件中的默认密钥。
- Windows 安装器、升级器和 PowerShell 脚本必须进行代码签名，并验证发行 manifest。
- `C:\ProgramData\Mesa` 使用 NTFS ACL 限制普通餐厅员工读取配置、备份和日志。
- 不把 Docker named pipe、Docker Desktop 管理权限或 WSL 管理权限授予普通员工。
- 服务端密钥不进入浏览器镜像、日志、安装报告或远程诊断包。
- 配置目录仅 root/专用服务用户可读。
- 管理接口和恢复操作要求本地管理员二次认证。
- 系统开启自动安全补丁，但 Docker/Supabase/Mesa 应用版本由发行流程控制。
- 远程支持优先使用短期、客户授权的反向隧道；不配置长期公网 SSH。
- 备份在客户端加密后上传；云端管理员不能仅凭对象存储权限读取数据。
- 遥测、日志、备份区域和保留期需满足客户所在地的数据保护要求。
- 即使未来每个实例通常只有一家餐厅，也保留现有 `restaurant_id`、RLS 和服务角色边界，避免本地部署降低安全模型。

## 11. 仓库改造建议

建议后续按以下结构实施：

```text
deploy/
  on-prem/
    compose.yaml
    compose.production.yaml
    images.lock
    caddy/
    windows/
      installer/
      scripts/
      scheduled-tasks/
apps/
  print-worker/
  support-agent/
  backup-agent/
docs/
  operations/
    install.md
    backup-restore.md
    upgrade-rollback.md
    incident-response.md
```

Web 应增加：

- Next.js standalone 生产构建；
- `/api/health/live` 和 `/api/health/ready`；
- 维护模式；
- 实例版本和迁移版本接口；
- 本地首次开户向导；
- 备份、日志授权、升级状态管理页；
- 严格的日志脱敏工具。

数据库应增加：

- 可查询的 schema/migration 版本；
- 升级前后业务一致性检查脚本；
- 恢复验收脚本；
- 如有 schema 变更，同步更新 `docs/ai-schema.md`。

打印模块应重构：

- 从现有 Go agent 提取 `print-worker`，构建 Linux 容器正式镜像；
- 使用 Transactional Outbox、PostgreSQL `LISTEN/NOTIFY` 和原子任务领取；
- 增加正式版本号、健康接口、优雅退出和不确定打印结果处理；
- 删除 Cloud URL、Windows tray、下载、配对和独立配置向导；
- 在网页打印中心提供打印机状态、映射、测试打印和失败任务处理；
- 将打印机及档口映射保存到数据库并实施餐厅范围 RLS；
- 第一版只允许 `tcp:<ip>:9100`；
- 本地日志滚动；
- 与服务端兼容版本声明；
- 升级期间的任务排空和安全重试策略。

## 12. 分阶段实施计划

### 阶段 0：产品决策，约 1 周

- 确定支持的 Windows 版本、Docker Desktop 版本、授权、硬件、网络和远程备份供应商。
- 明确第一版只支持 TCP 9100 LAN 打印机，并形成兼容打印机/USB 网络转换器清单。
- 确定 RPO/RTO、日志授权、客户数据责任和支持合同。
- 决定互联网完全离线是否为正式支持场景。

交付标准：形成不可变的支持矩阵和验收清单。

### 阶段 1：单机生产栈，约 2–3 周

- 构建 Next.js standalone 镜像。
- 固定并裁剪 Supabase 自托管 Compose。
- 将现有 agent 核心重构为用户不可见的 `print-worker`。
- 重构网页打印中心，删除下载/配对界面并加入状态、映射和测试打印。
- 实现业务与打印任务同事务提交、`LISTEN/NOTIFY` 唤醒、幂等约束及启动/重连恢复。
- 纳入 Caddy、Windows/WSL2 持久目录和 Windows 开机恢复任务。
- 完成 Windows 安装向导和基础健康检查。

交付标准：新 Windows 主机可从空机安装，并完成真实下单、结账、Realtime、图片和 LAN 打印。

### 阶段 2：备份与可观测性，约 2 周

- 实现数据库、Storage、配置的加密远程备份。
- 实现恢复命令、自动恢复测试和告警。
- 实现日志脱敏、健康遥测和客户授权诊断包。

交付标准：销毁测试主机后，能在另一台主机恢复到目标时间点。

### 阶段 3：升级系统，约 2–3 周

- 实现签名 manifest、固定 digest、发布通道和升级代理。
- 实现维护模式、升级前备份、迁移、健康检查和回滚。
- 建立版本兼容矩阵和自动升级测试。

交付标准：至少连续验证三个版本的升级，并演练一次迁移失败回滚。

### 阶段 4：试点和运营，约 4 周

- 先部署内部环境，再部署 2–3 家试点餐厅。
- 覆盖断网、断电、磁盘不足、打印机离线、备份失败和升级失败。
- 根据真实数据调整资源、日志、备份频率和维护窗口。

交付标准：试点完成营业周期，且至少完成一次真实版本升级和一次异机恢复演练。

## 13. 上线验收清单

- [ ] 断开互联网后，顾客下单、厨房更新、结账和打印正常。
- [ ] 主机重启后所有服务自动恢复，且不会重复打印。
- [ ] Docker Desktop/WSL2 未登录、异常退出或 Windows 更新重启后，系统能按支持策略恢复。
- [ ] 所有正式打印机均通过 TCP 9100 工作，不依赖 Windows Spooler 或 USB 直通。
- [ ] 非授权设备不能访问数据库、Studio 和内部 API。
- [ ] 日志中不存在密钥、Cookie、JWT、连接串或完整订单内容。
- [ ] 本地备份和远程备份均成功，且能够恢复。
- [ ] Storage 图片与数据库记录一起恢复。
- [ ] 升级包签名和镜像 digest 校验有效。
- [ ] 升级失败能够回到可营业状态。
- [ ] 证书续期、磁盘不足、备份失败和服务异常能够告警。
- [ ] 所有二维码使用稳定域名和 `table_id`，不暴露桌位 UUID 到纸面。
- [ ] RLS、Auth、服务角色和打印代理 JWT 校验没有因本地部署而弱化。

## 14. 主要风险

| 风险 | 影响 | 控制措施 |
|---|---|---|
| 餐厅硬件损坏 | 全店不可用 | 标准硬件、UPS、远程备份、可替换备用机 |
| 路由器/DNS 配置不一致 | 手机无法扫码访问 | 安装前网络勘测、支持矩阵、固定域名和验收工具 |
| Docker Desktop 授权或无人值守行为变化 | 无法稳定商业交付 | 固定兼容版本、确认授权、保留 WSL2 Docker Engine 备选路线 |
| Windows 更新或用户退出导致 Docker 未启动 | 全店服务中断 | 专用运维账号、启动任务、健康检测、现场恢复手册 |
| USB 打印机无法从 Linux 容器访问 | 无法打印 | 第一版强制 LAN TCP 9100，提供兼容设备和转换器清单 |
| Supabase 组件自行升级 | Auth/Realtime/Storage 不兼容 | 固定整套版本，只发布验证过的组合 |
| 数据库迁移不可逆 | 升级失败后无法快速恢复 | expand/contract、升级前备份、真实数据升级测试 |
| 备份长期未验证 | 灾难时才发现不可恢复 | 每周自动恢复、季度人工演练 |
| 日志上传包含个人数据 | 合规和客户信任风险 | 默认最小遥测、脱敏、授权、审计和保留期 |
| 磁盘被日志/备份占满 | 数据库停止写入 | 配额、滚动清理、阈值告警、预留空间 |
| 断电导致数据损坏 | 订单或数据库损坏 | UPS、可靠 SSD、正常关机、恢复演练 |

## 15. 最终建议

先不要删除现有 `dev/stage/cloud` 命令。它们仍然适合研发和发布验证。应新增独立的 `on-prem` 生产发行体系，并在试点稳定后，将其定义为唯一客户交付方式。

最优先的工作不是“一键安装界面”，而是先完成以下闭环：

1. 固定且可重复构建的生产容器栈；
2. 可验证的备份和异机恢复；
3. 有数据库迁移保护的升级和回滚；
4. 断网仍可营业的局域网域名、HTTPS 和 TCP 9100 打印链路；
5. 最小化、脱敏、可授权的远程日志与健康监控。

这五项完成后，一键安装只是对稳定运维流程的封装；如果没有这些基础，一键安装只会把不可恢复的复杂系统更快地部署到客户现场。

## 16. 参考资料

- [Supabase：Self-Hosting with Docker](https://supabase.com/docs/guides/self-hosting/docker)
- [Supabase：Self-Hosting 文档入口](https://supabase.com/docs/guides/self-hosting)
- [Docker：Install Docker Engine](https://docs.docker.com/engine/install/)
- [restic：Preparing a new repository](https://restic.readthedocs.io/en/stable/030_preparing_a_new_repo.html)
- [restic：Removing backup snapshots / retention policy](https://restic.readthedocs.io/en/stable/060_forget.html)
