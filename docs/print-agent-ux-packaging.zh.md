# Mesa Print Agent：客户体验与包装路线图

**状态**：产品/实施备忘（2026-05，进度见下表）  
**范围**：Windows 收银机侧 **安装、常驻、配置、排障、与 Mesa Web 闭环**；**不含** Authenticode 代码签名（见 [`print-agent-plan.md`](./print-agent-plan.md) · P1-4）。  
**关联**：[实施计划](./print-agent-plan.md)、[USB 方案](./print-agent-usb-plan.md)、[`apps/print-agent/README.md`](../apps/print-agent/README.md)、[`installer/WINDOWS-README.txt`](../apps/print-agent/installer/WINDOWS-README.txt)。

### 进度总览（Windows 代理 · 本地代码，发布 tag 由维护者自行打）

| 文档项 | 状态 | 版本参考 |
|--------|------|----------|
| P0-1 托盘主壳 + 无默认黑窗 | **已落地** | v0.2.35–0.2.40 |
| P0-1 绿/黄/红图标 + 中文菜单 + 日志目录 | **已落地** | v0.2.40+ |
| P0-1 单实例 / 启动可见（弹窗+日志）/ 托盘退出杀进程 | **已落地** | v0.2.38–0.2.41 |
| P0-2 向导试打 + 出纸确认 + 排障 | **已落地** | v0.2.42+ |
| **界面语言 `ui_locale`**（zh/en/pt，仅 UI+试打条） | **已落地** | v0.2.43+ |
| P0-3 运行期人话（日志/托盘） | **已落地** | v0.2.44+：`agent.log` 随 `ui_locale`；错误行尾附技术摘要 |
| P1 心跳 / configure 全量本地化 / 安装收尾 | **未做** | — |

---

## 背景与问题

当前代理 **功能链路已通**（配对、`configure` 映射、轮询 `pending-jobs`、LAN/USB 出纸、营业时段 `schedule`）。现场常见痛点来自 **「像开发工具」而非「像收银软件」**：

| 现象 | 根因（典型） |
|------|----------------|
| 日志写 `printed` 但无纸 | USB 未接电脑、`winspool` 队列名与实体机不一致、假成功进 Windows 队列 |
| 一连上狂打历史单 | 库内长期 `pending` 积压；代理重连后按时间顺序消费（**已修复**：超过 **20 分钟** 的任务在 API 侧作废且不再下发，代理侧二次跳过，见下文「已落地」） |
| 店主不敢关黑窗口 | 文档要求保持 **控制台窗口** 打开，易被误认为关窗即停打 |
| 配置分散 | Dashboard 生成码 → 本机 `pair` → `configure`；英文本地页，内部词多（`winspool:`、`station_printers`） |

本文档归纳 **面向餐厅客户的包装改进**，供排期；与 [`print-agent-plan.md`](./print-agent-plan.md) 中 **P0/P1** 条目互补，不重复协议与 RLS 细节。

---

## 已落地（与体验相关）

- **托盘与常驻（P0-1，v0.2.35–0.2.41）**：`windowsgui` 无默认黑窗；托盘先于配对/初始化；`Global\MesaPrintAgent-SingleInstance` 单实例；`ShellExecute` 打开浏览器 + 首装/配对 URL 弹窗；日志 `%LOCALAPPDATA%\Mesa Print Agent\agent.log`；**v0.2.40+** 绿/黄/红图标、中文菜单（打印机设置 / 测试打印 / 打开日志 / 调试控制台 / 关于 / 退出）、只读状态行、退出确认；**v0.2.41+** 退出时取消向导 HTTP 并 `os.Exit` 结束进程；**v0.2.48+** **每次启动**弹窗确认已启动（已配对/未配对文案不同），不再「终身只弹一次」。
- **界面语言（v0.2.43+）**：`config.json` 字段 `ui_locale`（默认 `zh`，可选 `en`/`pt`）；configure 顶栏可改；托盘菜单/tooltip/弹窗与试打条标题随此设置；**订单/厨房真实打印仍用 Mesa 下发的 `payload.locale`，与 `ui_locale` 无关**。
- **首装试打确认（P0-2，v0.2.42+）**：`configure` / `setup` 页「③ 试打确认」；`POST /api/test-print`；出纸「是/否」、否时排障卡片；未完成确认关闭会二次提示；保存须至少映射一个出品档口（与 §6 校验一致）。
- **任务最大年龄 20 分钟**：`GET /api/print-agent/pending-jobs` 拉取前将超时 `pending`/`processing` 标为 `failed`；仅返回 `created_at` 在窗口内的 `pending`；Go 代理处理前再次跳过。实现：`src/lib/print-job-max-age.ts`、`src/lib/expire-stale-print-jobs.ts`、`apps/print-agent/job_max_age.go`。
- **Dashboard**：打印助手配对码、最近任务、`print-job-error-hints` 中文/英/葡 hint；`buildPrintAgentConfigureUrl` 深链本机 `http://127.0.0.1:17892/configure`。
- **安装**：Inno Setup、`WINDOWS-README.txt` 首装步骤（含托盘颜色说明，v0.2.40+）；Inno **登录自启** 文案在 README 中，安装脚本是否勾选任务以 `mesa-print-agent.iss` 为准。
- **API 试打任务**：`claim` 成功可插入 `connection_test` 的 `order_receipt`（服务端 P0-3）；与向导本地试打（P0-2）互补，非同一 UI。

---

## 目标体验（一句话）

店主只需理解：**装一次 → 托盘绿灯 → 试打有一张纸 → 营业日不用管**；异常在 **Mesa 打印助手** 或托盘里能看到 **人话原因 + 下一步**，而不是读黑窗口日志。

---

## 优先级路线图

```mermaid
flowchart LR
  A[P0 托盘 + 藏控制台] --> B[P0 试打 + 排障向导]
  B --> C[P1 Dashboard 在线状态]
  C --> D[P1 本地化 configure]
  D --> E[P2 升级提示 + 安装收尾页]
```

---

## P0 — 必须优先（对客户感受影响最大）

### 1. 系统托盘为主壳（扩展 P1-3）

**现状（2026-05）**：**P0-1 主体已落地**（v0.2.40–0.2.41）：托盘为主、无默认黑窗、三色图标、中文菜单、日志目录、退出确认与进程退出。未做：到期前 15 天提醒（仍属 P1-3）、`configure` 并入主进程（仍为子进程）。

**建议（剩余）**：

- 托盘图标状态：**绿** 已连接且轮询正常 / **黄** 仅 schedule 外或等待映射 / **红** 连续失败或无法连 Mesa。
- 右键菜单：**打开设置**（`configure`）、**测试打印**、**打开日志目录**、**关于/版本**、**退出**。
- 默认 **无控制台**；`-console` 或环境变量保留给实施/排障。
- 用户文档与安装完成页 **只讲托盘**，删除「请保持黑窗口打开」表述（同步改 [`apps/print-agent/README.md`](../apps/print-agent/README.md)、[`WINDOWS-README.txt`](../apps/print-agent/installer/WINDOWS-README.txt)）。

**与 P1-3 关系**：托盘是 **主交互**，到期提醒是托盘能力之一，**不**单独做「只有气泡的托盘」。

### 2. 首装闭环：配对 → 映射 → 试打 → 确认

**现状（2026-05）**：**P0-2 已落地**（v0.2.42+）：`configure` / `setup` 在保存映射后提供试打条、**是/否** 出纸确认与排障卡片；未做：`pair_ui.html` 单独收尾页、**每个档口** 各打一条（当前为选一个档口试打）。

**建议（剩余）**：

1. 配对成功（6 位码 + Mesa URL）。
2. 为每个已映射 **出品档口** 提供 **「打印测试条」**（至少默认/第一个档口必选）。
3. UI：**「纸上是否已打印测试内容？」** → **是** / **否**。
4. **否** → 分步排障卡片：
   - USB：线是否接电脑、驱动是否安装、Windows **打印机** 列表是否出现设备；
   - 队列：所选名称是否与实体机一致（避免打到 PDF/旧队列）；
   - 走纸：按机身 **FEED**；
   - 队列暂停/脱机：打开 Windows 打印队列查看。

**成功标准**：用户点击「是」，而不仅是 agent 日志 `printed`（WinSpool 接受 ≠ 一定出纸）。

### 3. 运行期人话反馈（日志 / 托盘 / 可选本地状态页）

**现状**：托盘 **tooltip / 菜单状态行** 已对常见 `summary` 做中文映射（`agent_status.go`）；**文件日志与 `log.Printf` 仍为英文技术句**。

**待做**：将现有技术日志映射为店主可读文案（中/英/葡与 Mesa 一致），例如：

| 内部/日志 | 用户文案方向 |
|-----------|----------------|
| `skipped expired job` | 超过 20 分钟的旧单已自动跳过，无需补打除非在 Mesa 点「重试」 |
| `outside schedule` | 非营业时间，暂停拉单（显示下一营业窗口） |
| `receipt job waiting for printer mapping` | 结账打印机未配置，请打开「打印设置」映射档口 |
| `print failed (winspool:…)` | 打印失败：请在 Windows 打开「{打印机名}」队列，检查暂停/脱机/缺纸 |

---

## P1 — 高价值（与 Mesa Web 一体）

### 4. Agent 心跳 + Dashboard「在线」展示

**现状**：Dashboard 仅有 **最近 `print_jobs` 列表**，无法区分「代理未运行」与「暂无新单」。

**建议**（轻量 API，如 `POST /api/print-agent/heartbeat`）：

| 字段 | Dashboard 展示 |
|------|------------------|
| `last_seen_at` | 在线 / 离线（阈值如 2× 轮询间隔） |
| `agent_version` | 是否低于推荐版本 |
| `mapped_station_count` | 配置是否完整 |
| `last_print_at` + `last_print_status` | 最近一次结果 |
| `schedule_open` | 当前是否在营业时段内 |

店主在浏览器即可确认收银机在干活，**不必**看本机黑窗口。

### 5. 本地设置页本地化与降术语

**现状**：`pair_ui.html`、`configure_ui.html`、`setup_ui.html` 以英文为主；技术地址格式 `tcp:`、`winspool:` 直接暴露。

**建议**：

- 语言：`zh` / `en` / `pt`，与 [`restaurants.print_locale`](../supabase/migrations/20260514120000_print_jobs_and_print_locale.sql) 或 Dashboard 语言联动；URL 参数 `lang=pt`（`buildPrintAgentConfigureUrl` 可扩展）。
- 映射 UI：**「后厨 → 选择打印机」**，`winspool`/`tcp` 放入「高级」折叠。
- 未映射档口列表 + 警告：「这些菜下单后不会自动打出品联」。

### 6. 打印机发现与映射产品化

在现有 `discover` + configure 扫描基础上：

- **USB**：枚举 Windows 打印机，标注推荐 80mm / UNYKA。
- **LAN**：扫描结果支持 **「设为后厨/吧台」** 快捷绑定（需 station 列表 API，configure 已可拉 stations）。
- **多档口同机**：黄条说明可共用同一队列，但会排队。
- **保存前校验**：至少一个出品档口已映射（结账小票另靠 `receipt_printer_id` 或默认首档口，与现逻辑一致）。

### 7. Mesa 打印助手闭环按钮

- **「在本机打开设置」**：探测 `127.0.0.1:17892`；不可达则提示先启动 Mesa Print Agent。
- 生成配对码：**大号 6 位 + 过期倒计时 + 复制**；生成后自动带 `code` 打开 configure（已有 `freshCode` + `buildPrintAgentConfigureUrl`，可加强 UI）。
- 任务 `failed`：展示 `print-job-error-hints` + 链到本机 configure。

---

## P2 — 锦上添花

### 8. 版本升级提示（不依赖签名）

- 启动时对比 GitHub Release / Mesa 配置的推荐版本。
- Dashboard 下载区：推荐版本 vs 本机 heartbeat 上报版本。
- 升级说明：**关闭托盘 → 运行新安装包 → 配置保留**。

### 9. 安装包交付（非签名层面）

- Inno **最后一屏**：勾选「立即打开设置」、链接 3 步图文（可链 Mesa 帮助或 PDF）。
- 快捷方式：「Mesa 打印设置」→ `configure`；「Mesa 打印状态」→ 托盘或状态页。
- **便携 zip vs Setup**：明确 zip **不** 配置开机自启。
- **驱动**：按钮打开 UNYKA 驱动下载页 + 检查项「已安装驱动后再映射 USB」。
- **SmartScreen**：安装向导内图示「更多信息 → 仍要运行」（补充 [`WINDOWS-README.txt`](../apps/print-agent/installer/WINDOWS-README.txt) 文字说明）。

### 10. 其它（规划内、优先级更低）

- 滚动日志文件 + 托盘「打开日志目录」（[`print-agent-plan.md`](./print-agent-plan.md) §二 · 日志）。
- Windows **服务** 模式（多用户/无登录自启）：小馆单用户场景优先级低于托盘。
- Realtime 推任务替代纯轮询：降低延迟，对「包装」为加分项。
- configure 页 **QR** 将 `configure?api=&code=` 发给另一台设备（次要）。

---

## 与现有计划条目的对应

| 本文档项 | `print-agent-plan.md` |
|----------|------------------------|
| §1 托盘主壳 | 扩展 **P1-3**（托盘不应仅做到期提醒） |
| §2 试打确认 | **P0-2 向导已落地**；服务端 `claim` 试打任务仍对应 plan **P0-3** |
| §4 心跳 | 新增（应用端 API + 打印助手 UI） |
| §5 本地化 | 安装包端 UI（未单列，可并入 P1） |
| §8 升级提示 | 与 **P1-5** Releases 衔接 |
| §9 安装收尾 | **P1-4** Inno 增强 |
| 20 分钟过期 | **已落地**（本文档「已落地」） |

---

## 实施检查清单（排期用）

**安装包端（Go + Inno）**

- [x] 托盘（v0.2.35+）：状态 tooltip + 菜单 + 默认隐藏控制台（`-console` 调试）
- [x] 托盘先于配对阻塞（v0.2.37+）：`systray.Run` 不再等 `initAgentSession` 结束
- [x] 单实例 + 启动反馈（v0.2.38–0.2.39）：Mutex、`agent.log`、配对 URL 弹窗
- [x] 托盘：绿/黄/红多状态图标 + 中文菜单 + 测试打印 + 打开日志（v0.2.40+）
- [x] 托盘退出结束进程（v0.2.41+）：取消向导 HTTP + `os.Exit`
- [x] 向导：试打 + 用户确认出纸 + 排障分支（v0.2.42+，`/api/test-print`）
- [x] 日志文件人话（P0-3，v0.2.44+）：与 `ui_locale` 共用 `ui_i18n` / `log_strings.go`
- [x] 凭证半年 + 到期提醒（v0.2.51–0.2.52）：Dashboard 顶栏/打印助手 30 天横幅；托盘关于/状态/每日轻提示；`valid_until` 写入 config
- [x] `configure` 并入托盘进程（v0.2.47+）
- [x] 心跳上报 + 版本字段（v0.2.56+：`POST /api/print-agent/heartbeat`、Dashboard「已配对收银机」）
- [ ] configure/pair/setup：全页 `lang` 与降术语 UI（§5；试打区块已中文）
- [ ] 启动时可选检查新版本

**应用端（Next / Dashboard）**

- [x] `heartbeat` API + `print_agent_devices` 存储 `last_seen` 等字段
- [x] 打印助手：在线状态、版本落后提示（设备列表面板）
- [ ] 「打开本机设置」可达性检测
- [ ] 配对码 UI 强化 + 深链 configure

**文档**

- [x] 本文档
- [x] `WINDOWS-README.txt` 托盘颜色与菜单说明（v0.2.40+）
- [ ] 同步 `apps/print-agent/README.md`（托盘为主、勿保持黑窗、20 分钟过期）

---

## 现场排障速查（可摘入帮助页）

1. **托盘/代理是否在运行**（未来）；当前：任务管理器是否有 `MesaPrintAgent`。
2. **USB 是否接在收银 PC 上**，Windows 是否识别打印机。
3. **`configure` 中档口映射的 Windows 名** 是否与 **设置 → 打印机** 中一致。
4. **Windows 打印队列** 是否暂停、脱机、积压历史任务（可全部取消）。
5. **Mesa 打印助手** 最近任务是否 `failed`，看 hint；超过 20 分钟需 **重试** 才会再入队。
6. **营业 schedule**：非时段内代理不拉单，属正常。

---

*维护：代理体验变更时请更新「已落地」节与 [`print-agent-plan.md`](./print-agent-plan.md) 检查清单，避免三处文档矛盾。*
