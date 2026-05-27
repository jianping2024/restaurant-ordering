# 打印助手 USB 支持计划（P2）

与主路线图 [`print-agent-plan.md`](./print-agent-plan.md) 的关系：第一期 **网口 RAW `IP:9100`** 已落地；本文档规划 **纯 USB / USB 为主** 场景，对应主计划 **P2-6 §4「纯 USB 打印机」**。

**参考样机**：UNYKA **UK56009**（USB + LAN，ESC/POS，80mm）— USB 路径须在该型号上 **实机打样验收**，不能假设与网口字节流完全一致。

---

## 1. 现状与缺口

| 层级 | 今天 | USB 场景下的问题 |
|------|------|------------------|
| Mesa 云端 | `print_jobs` 入队、`claim`、配对 | **无需改协议**（仍下发 ESC/POS 字节） |
| `apps/print-agent` | `tcpPrint(hostPort)` → `net.Dial` :9100 | USB 线 **没有** `IP:9100`；`discover` 扫不到 |
| 配置 | `default_printer` / `station_printers` 值为 `host:port` 字符串 | 无法表达「Windows 打印机队列名」 |
| 配对向导 | 浏览器页只完成 Mesa `api_base` + 配对码 | **未**引导选打印机 |
| 安装包 | Inno + zip，无驱动 | USB 通常需 **先装厂商驱动** 并出现系统「打印机」 |

结论：**USB 支持是代理端「输出通道」扩展**，不是 Mesa Next.js 大改；Dashboard 以 **文案 + 向导步骤** 为主。

---

## 2. 技术路线对比（Windows 收银机）

| 路线 | 做法 | 优点 | 缺点 | 建议 |
|------|------|------|------|------|
| **A. 继续用网口** | UK56009 插网线，仍 `IP:9100` | 已实现；多机多 IP 清晰 | 店里若只接了 USB 则不可用 | **默认推荐**，零开发 |
| **B. Windows 打印后台 RAW** | 驱动装好后，用 **打印机共享名** + `WritePrinter` 发 RAW | 与现有 Go 代理一致；店员熟悉「选打印机」 | 依赖驱动/队列名；需处理占用与权限 | **P2 首选实现** |
| **C. USB 虚拟 COM** | 走 `COM3:` 等串口发 ESC/POS | 部分机型支持 | 波特率/流控因机型而异；发现 COM 口不稳定 | 仅作 **机型白名单** 备选 |
| **D. libusb 直连** | 用户态绑 USB 端点 | 不经过 spooler | 需 per-vendor；Win 驱动冲突；维护成本高 | **不推荐** 首期 |
| **E. 集成 QZ Tray** | 浏览器/本地服务打 RAW | 成熟 | 第三方许可、多进程、与自建代理重复 | **不采纳**（见 `receipt-printing-research.md`） |
| **F. 换硬件** | USB→网口小盒子 / 打印机内置打印服务器 | 代理仍用 TCP | 额外硬件成本 | 实施说明里作 **运维备选** |

**决策（建议锁定）**：P2 在 Windows 上实现 **B（WinSpool RAW）**；网口 **A** 保持并行；配置层用 **统一「打印目标」抽象** 区分 `tcp` 与 `winspool`。

---

## 3. 目标架构（代理端）

### 3.1 打印目标抽象

将 `tcpPrint` 升级为接口，避免 `printerAddrForJob` 只能返回 host:port：

```text
print_jobs → ESC/POS bytes → PrinterSink.Write(raw) → 设备
```

**配置（向后兼容）** — 二选一演进：

**方案 1（推荐）**：扩展字符串前缀（改动小）

```json
{
  "default_printer": "winspool:UNYKA UK56009",
  "station_printers": {
    "<uuid-kitchen>": "tcp:192.168.1.51:9100",
    "<uuid-bar>": "winspool:Bar Printer"
  }
}
```

- `tcp:192.168.1.50:9100` — 现有语义  
- `winspool:<Windows 队列显示名>` — USB/驱动路径  
- 无前缀且含 `:` → 仍视为 legacy `host:port`（兼容旧 config）

**方案 2（更清晰）**：结构化对象（迁移成本高）

```json
{
  "default_printer": { "kind": "winspool", "name": "UK56009 Receipt" },
  "station_printers": { "<uuid>": { "kind": "tcp", "host": "192.168.1.51", "port": 9100 } }
}
```

首期 USB 可用 **方案 1**；文档与向导 UI 用下拉保存为带前缀字符串。

### 3.2 代码模块（`apps/print-agent`）

| 文件 / 模块 | 职责 |
|-------------|------|
| `sink.go` | `type PrinterSink interface { Write([]byte) error; Close() error }` |
| `sink_tcp.go` | 现有 `tcpPrint` 迁入 |
| `sink_winspool.go` | `//go:build windows` — Win32 `OpenPrinter` / `StartDocPrinter` / `WritePrinter` RAW |
| `config.go` | `resolveSink(target string) (PrinterSink, error)` |
| `main.go` | 打印循环改为 `sink.Write(payload)` |
| `discover.go` | 保留 TCP 9100 扫描；新增 `discover-winspool` 或合并列表 |
| `pair_ui.html` / 本地向导 | **步骤 2**：列出本机 Windows 打印机（仅已就绪队列） |

非 Windows 构建：`sink_winspool_stub.go` 返回明确错误「USB 仅支持 Windows」。

### 3.3 WinSpool RAW 实现要点（Windows）

1. **列印机枚举**：`EnumPrinters`（级别 2/4），过滤 **已连接、非离线** 队列。  
2. **RAW 提交**：`DOC_INFO_1` + `pDataType = "RAW"`（或 `"XPS_PASS"` 禁用 — 必须 RAW ESC/POS）。  
3. **独占**：打印期间持有打印机句柄；失败时 `error_message` 写清「队列忙 / 权限 / 驱动」。  
4. **驱动前提**：文档要求安装 UK56009 **ESC/POS 驱动** 或「Generic / Text Only」+ RAW（以实机为准）；**安装包不捆绑驱动**（许可与体积）。  
5. **权限**：代理以 **当前登录用户** 运行（与现有 `PrivilegesRequired=lowest`、配对向导一致）；服务账户跑代理列 **P2.1 风险**。

### 3.4 配对 / 设置向导（傻瓜化，与 USB 对齐）

在现有 `http://127.0.0.1:17890/pair` 之后增加 **同端口设置流**（或 `/setup`）：

| 步骤 | 内容 |
|------|------|
| 1 | Mesa 网址 + 配对码（**已有**） |
| 2 | **选择打印机**：下拉「本机 Windows 打印机」+ 可选「扫描网口 9100」；支持「厨房 / 吧台」映射到 `station_printers`（读 Dashboard 档口 UUID 说明） |
| 3 | **测试打印**（调用现有 connection test job 或本地 test pattern） |
| 4 | 完成，写入 `config.json`，进入轮询 |

Dashboard **打印助手** 增补：

- USB 店：先装驱动 → 再下代理 → 配对向导选队列  
- 仍推荐 UK56009 **插网线** 的短说明（零风险路径）

---

## 4. Mesa 应用端改动（少）

| 项 | 是否必做 | 说明 |
|----|----------|------|
| `print_jobs` 表结构 | 否 | payload 仍为 ESC/POS |
| 入队 API | 否 | |
| `print-agent/claim` | 否 | |
| Dashboard 打印助手 | **文案 + 链接** | USB 安装检查清单；档口 UUID 复制按钮 |
| `GET /api/print-agent/runtime-config` | 可选 | 下发 `supported_sink_kinds: ["tcp","winspool"]` 供向导展示 |
| i18n | 是 | 中/英/葡三条路径说明 |

**不做**：浏览器直连 USB（WebUSB 权限复杂且不适合收银机长期运行）。

---

## 5. 分阶段交付

### 阶段 P2-USB-0：调研与打样（1–2 天）

- [ ] UK56009 **仅 USB** 接 Windows 11：厂商驱动安装路径、队列显示名、RAW 测试页  
- [ ] 用 PowerShell / 小工具验证 `WritePrinter` RAW 能出纸（葡语重音、切刀指令）  
- [ ] 记录是否与网口 ESC/POS 字节级一致（编码、行宽 80mm）  
- [ ] 决定 `pDataType` 与是否需 **端口监视器**（多数 ESC/POS 驱动默认 RAW）

### 阶段 P2-USB-1：WinSpool 单队列（MVP）

- [ ] `sink` 抽象 + `tcp` 迁移  
- [ ] `winspool:` 单台 `default_printer`  
- [ ] `station_printers` 仍可 tcp；**同一台 PC 多 USB 机** 映射多个 winspool 名  
- [ ] 错误回写 `print_jobs.error_message`（队列不存在、离线、RAW 被拒）  
- [ ] 单元测试：mock sink；集成测试仅 Windows CI job（`windows-latest` + 假 spooler 难，以 **手工验收** 为主）

### 阶段 P2-USB-2：向导与发现

- [ ] 本地 `/setup` 页：枚举打印机 + 测试打  
- [ ] `MesaPrintAgent.exe discover` 输出 tcp + winspool 两段  
- [ ] `WINDOWS-README.txt` + Dashboard 引导  
- [ ] 版本 **print-agent-v0.2.x** 发布

### 阶段 P2-USB-3：运维与边缘（可选）

- [x] 开机自启（Inno `[Tasks]` autostart → `{userstartup}` 快捷方式，默认勾选）  
- [ ] 打印机更名检测（队列名变了提示重配）  
- [ ] RDP / 多用户会话下 spooler 行为说明  
- [ ] macOS USB（**另立项**；CUPS RAW，非本期）

---

## 6. 安装包与发布调整

**已定：单一安装包** — LAN 与 USB 共用 **`MesaPrintAgent-Setup-amd64.exe`** / 同一便携 zip；不按连接方式拆两个 exe。区别仅在 **配对/设置向导** 与 **`config.json`**（`tcp:` / `winspool:`）。Dashboard 可提供「网线设置说明」「USB 设置说明」两个链接，均指向 **同一 GitHub Release 资产**。

| 项 | 调整 |
|----|------|
| Inno Setup | **不捆绑** 驱动；可选「安装后打开设置页」快捷方式；README 分 LAN / USB 两节（同一安装包） |
| 便携 zip | 同一 `MesaPrintAgent.exe` + `WINDOWS-README.txt`（含 UK56009 网线优先与 USB 驱动链接） |
| CI | 仍单 job 产出一份 Setup + zip；WinSpool 代码 `//go:build windows` 合入同一二进制 |
| 代码签名 | 仍第一期无签名；USB 驱动安装与代理无关 |

---

## 7. 测试计划（验收）

| # | 场景 | 期望 |
|---|------|------|
| 1 | UK56009 USB + 官方驱动，单队列，`default_printer` winspool | 下单后出品联出纸 |
| 2 | 同机网口厨房 + USB 吧台（`station_printers` 混合 tcp/winspool） | 各档口走正确 sink |
| 3 | 队列名配置错误 | `failed` + 可读 `error_message` |
| 4 | 打印机离线 / 盖打开 | 失败可恢复，不崩代理进程 |
| 5 | 配对向导选机 + 测试打 | 无需命令行 |
| 6 | 与仅 LAN 店共存 | 旧 `192.168.x.x:9100` config **无迁移** 仍可用 |

---

## 8. 风险与产品建议

| 风险 | 缓解 |
|------|------|
| 驱动装成 GDI/图形模式，RAW 乱码 | 文档 + 向导 **测试打**；维护「UK56009 USB 驱动检查清单」 |
| 多台 USB 打印机 USB Hub 供电 | 实施说明写硬件建议 |
| 队列名随语言/驱动变化 | 向导用 **队列 ID**（`PRINTER_INFO_2`）内部存储，显示名仅展示（P2-USB-3） |
| 代理以 Windows 服务跑在 Session 0 | 第一期坚持 **用户登录后启动** |
| 开发量超预期 | 店内优先 **DHCP + 网线**；USB 作 P2 |

**产品默认话术**：同一台 UK56009 **优先插网线**；USB 作为 **无布线** 场景的 P2 能力，不替代 LAN 主路径。

---

## 9. 工作量粗估

| 阶段 | 人天（约） |
|------|------------|
| P2-USB-0 打样 | 1–2 |
| P2-USB-1 WinSpool MVP | 3–5 |
| P2-USB-2 向导 + 文档 | 2–3 |
| P2-USB-3 运维 | 1–2 |
| **合计** | **7–12** |

---

## 10. 与主计划文档的同步

完成立项后，在 [`print-agent-plan.md`](./print-agent-plan.md) 中：

- 将 **P2-6 §4** 链接到本文档  
- 在 **已确认网络与打印机** 表中补一行：**USB（Windows WinSpool RAW）** = P2，见 `print-agent-usb-plan.md`  
- Checklist 增加 `P2-USB-1` … 勾选项（实施时更新）

---

## 11. 已确认决策

| 项 | 决策 |
|----|------|
| **支持范围** | **仅验收 UNYKA UK56009**（USB + LAN）；票样/编码以该机打样定稿；其他 ESC/POS 机不承诺。 |
| **参考图** | 仓库 [`docs/assets/reference-printer-unyka-uk56009.png`](./assets/reference-printer-unyka-uk56009.png) 为该机底板铭牌（型号 **UK56009**，**USB+LAN**，**ESC/POS**，80mm）。 |
| **配置格式** | 待定：倾向 `tcp:` / `winspool:` 字符串前缀（见 §3.1）。 |
| **平台** | P2 USB 首期 **仅 Windows**（WinSpool RAW）。 |
| **单店多机** | `station_printers` 支持每档口 `tcp:` / `winspool:`；设置向导首期只配 `default_printer`，多档口可手改 config。 |
| **安装包形态** | **单一安装包**（与 LAN 版不拆包）；见 §6。 |

**实现进度（v0.2.0）**：WinSpool RAW（`github.com/alexbrainman/printer`）、`tcp:`/`winspool:` 配置、本机 `/setup` 向导、`discover` 列出两类打印机。须在 **Windows + UK56009 USB** 上实机验收。
