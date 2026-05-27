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
| P1 心跳 + Dashboard 设备在线 | **已落地** | v0.2.56+ |
| P1 设置页全页 i18n + 降术语（§5） | **部分** | v0.2.43+ 托盘/`ui_locale`；configure ③ 试打已 i18n；①② 与 pair/setup 仍多英文 |
| P1 安装收尾（Inno 最后一屏等） | **已落地** | `mesa-print-agent.iss`：自启任务、完成页说明、快捷方式、装完启动 |
| P2 版本升级提示（§8） | **已落地** | v0.2.66+：`runtime-config` 推荐版本、托盘每日弹窗、Dashboard 升级说明 |
| P2 §10（服务/Realtime/QR 等） | **未做** | 见 §10 |

---

## 背景与问题

当前代理 **功能链路已通**（配对、`configure` 映射、轮询 `pending-jobs`、LAN/USB 出纸、营业时段 `schedule`）。现场常见痛点来自 **「像开发工具」而非「像收银软件」**：

| 现象 | 根因（典型） |
|------|----------------|
| 日志写 `printed` 但无纸 | USB 未接电脑、`winspool` 队列名与实体机不一致、假成功进 Windows 队列 |
| 一连上狂打历史单 | 库内长期 `pending` 积压；代理重连后按时间顺序消费（**已修复**：超过 **20 分钟** 的任务在 API 侧作废且不再下发，代理侧二次跳过，见下文「已落地」） |
| 店主不敢关黑窗口 | **已缓解**：正式包托盘为主、无默认黑窗（见 README / `WINDOWS-README.txt`）；仍有人习惯找「黑窗口」 |
| 配置分散 / 术语重 | 主路径：**Dashboard 打印助手** → 深链 `configure`（`:17892`）；`pair`（`:17890`）多为首装兜底。设置页 **① 重配、② 扫描映射** 仍偏英文，下拉偶见 `tcp:` / `winspool:` 技术地址 |

本文档归纳 **面向餐厅客户的包装改进**，供排期；与 [`print-agent-plan.md`](./print-agent-plan.md) 中 **P0/P1** 条目互补，不重复协议与 RLS 细节。

---

## 已落地（与体验相关）

- **托盘与常驻（P0-1，v0.2.35–0.2.41）**：`windowsgui` 无默认黑窗；托盘先于配对/初始化；`Global\MesaPrintAgent-SingleInstance` 单实例；`ShellExecute` 打开浏览器 + 首装/配对 URL 弹窗；日志 `%LOCALAPPDATA%\Mesa Print Agent\agent.log`；**v0.2.40+** 绿/黄/红图标、中文菜单（打印机设置 / 打开日志 / 调试控制台 / 关于 / 退出；试打在设置页）、只读状态行、退出确认；**v0.2.41+** 退出时取消向导 HTTP 并 `os.Exit` 结束进程；**v0.2.48+** **每次启动**弹窗确认已启动（已配对/未配对文案不同），不再「终身只弹一次」。
- **界面语言（v0.2.43+）**：`config.json` 的 `ui_locale`（默认 `zh`，可选 `en`/`pt`）；**托盘**菜单/tooltip/弹窗、`agent.log` 人话行随此设置；**configure** 顶栏可改语言，**`/api/ui-locale` + `ui_i18n.go`** 已翻译标题与 **③ 试打/排障**，**① 重配、② 扫描与档口下拉** 仍大量硬编码英文。**`pair_ui` / `setup_ui` 未接 i18n**（setup 试打区有硬编码中文）。**订单/厨房纸面语言**仍用 Mesa `print_locale` → `payload.locale`，与 `ui_locale` 无关。
- **心跳与在线（v0.2.56+）**：`POST /api/print-agent/heartbeat`；Dashboard **已配对收银机** 列表（`last_seen`、版本、映射数等）。
- **首装试打确认（P0-2，v0.2.42+）**：`configure` / `setup` 页「③ 试打确认」；`POST /api/test-print`；出纸「是/否」、否时排障卡片；未完成确认关闭会二次提示；保存须至少映射一个出品档口（与 §6 校验一致）。
- **任务最大年龄 20 分钟**：`GET /api/print-agent/pending-jobs` 拉取前将超时 `pending`/`processing` 标为 `failed`；仅返回 `created_at` 在窗口内的 `pending`；Go 代理处理前再次跳过。实现：`src/lib/print-job-max-age.ts`、`src/lib/expire-stale-print-jobs.ts`、`apps/print-agent/job_max_age.go`。
- **Dashboard**：打印助手配对码、最近任务、`print-job-error-hints` 中文/英/葡 hint；`buildPrintAgentConfigureUrl` 深链本机 `http://127.0.0.1:17892/configure`。
- **配对码槽位与作废（Web，2026-05）**：单店最多 **3 个待使用** 码（`expires_at > now` 且 `consumed_at` / `revoked_at` 均为空）；**已核销不占槽**（重装、换机、重配后可立刻再生成）；列表对未使用码提供 **作废**（`POST /api/print-agent/pairings/[id]/revoke` → `revoked_at`），误生成可腾槽。迁移：`supabase/migrations/20260531140000_print_agent_pairing_revoked_at.sql`。
- **安装（§9）**：Inno `mesa-print-agent.iss` — 装前/装后说明（SmartScreen、zip 对比、USB 驱动链）、**登录自启**（开始菜单「启动」文件夹快捷方式，默认勾选）、开始菜单 **Printer settings**（`configure`）与 **UNYKA driver (web)**、完成页默认 **立即启动代理**；`WINDOWS-README.txt` 与之一致。
- **版本提示（§8，v0.2.66+）**：`runtime-config.recommended_agent_version`；旧版代理每日托盘提醒；Dashboard 设备列表与下载区升级说明。
- **API 试打任务**：`claim` 成功可插入 `connection_test` 的 `order_receipt`（服务端 P0-3）；与向导本地试打（P0-2）互补，非同一 UI。

---

## 目标体验（一句话）

店主只需理解：**装一次 → 托盘绿灯 → 试打有一张纸 → 营业日不用管**；异常在 **Mesa 打印助手** 或托盘里能看到 **人话原因 + 下一步**，而不是读黑窗口日志。

---

## 优先级路线图

```mermaid
flowchart LR
  A[P0 托盘 + 藏控制台] --> B[P0 试打 + 排障向导]
  B --> C[P1 心跳 / Dashboard 在线]
  C --> D[P1 configure 全页 i18n + 降术语]
  D --> E[P2 升级提示 + 安装收尾页]
```

（P0、**C**、**§8**、**§9** 已落地；**D**（configure 全页 i18n）与 **§10** 仍为 backlog。）

---

## P0 — 必须优先（对客户感受影响最大）

### 1. 系统托盘为主壳（扩展 P1-3）

**现状（2026-05）**：**P0-1 已落地**（v0.2.40–0.2.47+）：托盘为主、无默认黑窗、三色图标、中文菜单、日志目录、退出杀进程；**`configure` HTTP 已在托盘进程内**（`tray_local_http`，非独立子 exe）；凭证 **到期前 30 天** 双通道提醒（Dashboard + 托盘，v0.2.51–0.2.52）。**未做**：托盘根据 **打印机硬件离线** 变黄（仅 Mesa 连接态，见 backlog 讨论）。

**建议（剩余，非阻塞）**：

- 细化托盘 tooltip（如打印机队列脱机 vs Mesa 断连）。

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

**现状（v0.2.44+）**：**`agent.log`** 主行随 `ui_locale` 人话化（`log_strings.go`），技术摘要附在行尾；托盘 **tooltip / 菜单状态行** 已映射（`agent_status.go`）。**仍可能**出现未覆盖的英文 `log.Printf` 或极冷门错误码。

**可增强**（低优先级）：补全剩余日志键、统一中/英/葡表，例如：

| 内部/日志 | 用户文案方向 |
|-----------|----------------|
| `skipped expired job` | 超过 20 分钟的旧单已自动跳过，无需补打除非在 Mesa 点「重试」 |
| `outside schedule` | 非营业时间，暂停拉单（显示下一营业窗口） |
| `receipt job waiting for printer mapping` | 结账打印机未配置，请打开「打印设置」映射档口 |
| `print failed (winspool:…)` | 打印失败：请在 Windows 打开「{打印机名}」队列，检查暂停/脱机/缺纸 |

---

## P1 — 高价值（与 Mesa Web 一体）

### 4. Agent 心跳 + Dashboard「在线」展示

**现状（v0.2.56+，已落地）**：`POST /api/print-agent/heartbeat` 写入 `print_agent_devices`；打印助手 **已配对收银机** 表展示 `last_seen_at`、`agent_version`、`mapped_station_count`、`last_print_at` / `last_print_status`、`schedule_open` 等。与 **最近 `print_jobs` 排障列表** 互补（任务列表仍不能单独证明代理进程在跑，但设备行可以）。

**可增强**：版本落后与 GitHub Release 联动（§8）；离线阈值与提示文案产品化。

### 5. 本地设置页本地化与降术语（P1，**部分落地**）

**现状（与代码一致）**：

| 页面 | i18n | 说明 |
|------|------|------|
| 托盘 | ✅ `ui_locale` | `ui_i18n.go` |
| `configure_ui.html` | ⚠️ 部分 | 顶栏语言 + **`applyI18n()`** 覆盖页标题、③ 试打/排障、部分按钮；**① 重配说明、② 扫描摘要、档口下拉分组** 仍为 HTML/JS 硬编码英文 |
| `pair_ui.html` | ❌ | 全页静态英文；主流程常跳过（Dashboard 深链 `configure?code=`） |
| `setup_ui.html` | ❌ | 主体英文；保存后试打块为硬编码中文 |

下拉 **展示**已分组「Network / USB」，但 **option value** 仍为 `tcp:…` / `winspool:…`；缺设备时可能显示 `(saved — rescan…)` 含完整技术串。`buildPrintAgentConfigureUrl` **未**传 `lang=`（与 Dashboard 语言未自动对齐）。

**建议（剩余）**：

- **全页 i18n**：pair/setup 接入 `/api/ui-locale`；configure ①② 与 `scanSummaryText` / `fillStationSelect` 等补 `ui_i18n` 键。
- **语言联动（可选）**：深链 `?lang=` 或首次打开读 Dashboard/`ui_locale`；**不要**与 `restaurants.print_locale`（纸面语言）混为一谈。
- **降术语**：下拉仅显示 Windows 打印机友好名 /「网线打印机」；`tcp:`/`winspool:` 收进「高级」；未映射档口黄条：「这些菜下单后不会自动打出品联」。

### 6. 打印机发现与映射产品化

在现有 `discover` + configure **合并扫描（LAN + WinSpool）** 基础上（**已有**），可增强：

- **USB**：枚举结果标注推荐 80mm / UNYKA（型号提示）。
- **LAN**：扫描结果 **一键绑到某档口**（stations API 已有，缺快捷 UX）。
- **多档口同机**：黄条说明可共用同一队列、会排队。
- **保存前校验**：**已有**「须至少映射一个档口才能试打/保存」；可加强未映射档口 **列表警告**（与 §5 合并做）。

### 7. Mesa 打印助手闭环按钮

- **「在本机打开设置」**：探测 `127.0.0.1:17892`；不可达则提示先启动 Mesa Print Agent。
- 生成配对码：**大号 6 位 + 过期倒计时 + 复制**；生成后自动带 `code` 打开 configure（Dashboard `PrintAgentPairingPanel`）。
- **槽位规则**：仅 **待使用** 码计入上限 3；**已核销** 不占槽；**作废** 未使用码立即释放槽位（见「已落地」）。
- 任务 `failed`：展示 `print-job-error-hints` + **在本机打开打印机设置**（深链 configure）。

---

## P2 — 锦上添花

### 8. 版本升级提示（不依赖签名）

**现状（已落地，v0.2.66+）**：

- **Mesa**：`GET /api/print-agent/runtime-config` 返回 `recommended_agent_version`（与仓库 `apps/print-agent/VERSION` / `NEXT_PUBLIC_PRINT_AGENT_VERSION` 一致）。
- **代理**：启动拉 runtime-config 后，若本机版本 **低于** 推荐版，**每日最多一次** 托盘弹窗（`notify_version_windows.go`）；文案含退出托盘 → 安装新版本。
- **Dashboard**：**已配对收银机** 对比 `agent_version` 与推荐版（`PrintAgentDevicesPanel`）；下载区 **`downloadUpgradeSteps`** 说明升级步骤。

**可增强**：代理直连 GitHub 查最新 tag（不依赖 Mesa 部署版本）；heartbeat 响应带回推荐版以便长跑进程复检。

### 9. 安装包交付（非签名层面）

**现状（已落地）**：`installer/mesa-print-agent.iss` + `wizard-before.txt` / `wizard-after.txt`。

- **装前/装后页**：SmartScreen 说明、便携 zip **无**登录自启、USB 先装驱动（链到 unykach.com）。
- **任务**：登录 Windows 时启动代理（**Startup 文件夹**，默认勾选，卸载移除）。
- **开始菜单**：主程序、**Printer settings**（`MesaPrintAgent.exe configure`）、Setup guide、UNYKA 驱动网页快捷方式。
- **完成页**：默认勾选 **立即启动** 代理（托盘；浏览器配对/设置）；可选打开 `WINDOWS-README.txt`。

**可增强（非必须）**：安装向导内嵌 SmartScreen 截图；完成页一键 `configure`（与托盘同端口时不宜并行）；中/葡安装语言包。

### 10. 其它（规划内、优先级更低，**未做**）

- 滚动日志文件 + 托盘「打开日志目录」——**已有**固定 `agent.log` 与托盘「打开日志」菜单；**未做**按大小轮转。
- Windows **服务** 模式（多用户/无登录自启）：小馆单用户场景优先级低于托盘。
- Realtime 推任务替代纯轮询：降低延迟，对「包装」为加分项。
- configure 页 **QR** 将 `configure?api=&code=` 发给另一台设备（次要）。

---

## 与现有计划条目的对应

| 本文档项 | `print-agent-plan.md` |
|----------|------------------------|
| §1 托盘主壳 | 扩展 **P1-3**（托盘不应仅做到期提醒） |
| §2 试打确认 | **P0-2 向导已落地**；服务端 `claim` 试打任务仍对应 plan **P0-3** |
| §4 心跳 | **已落地**（v0.2.56+） |
| §5 本地化 | P1 **部分**（托盘 + configure ③；见 §5 表） |
| §8 升级提示 | **已落地**（runtime-config + 托盘 + Dashboard） |
| §9 安装收尾 | **已落地**（`mesa-print-agent.iss`） |
| 20 分钟过期 | **已落地**（本文档「已落地」） |

---

## 实施检查清单（排期用）

**安装包端（Go + Inno）**

- [x] 托盘（v0.2.35+）：状态 tooltip + 菜单 + 默认隐藏控制台（`-console` 调试）
- [x] 托盘先于配对阻塞（v0.2.37+）：`systray.Run` 不再等 `initAgentSession` 结束
- [x] 单实例 + 启动反馈（v0.2.38–0.2.39）：Mutex、`agent.log`、配对 URL 弹窗
- [x] 托盘：绿/黄/红多状态图标 + 中文菜单 + 打开日志（v0.2.40+）；试打仅在 **设置页**（v0.2.62+ 去掉托盘测试打印）
- [x] 托盘退出结束进程（v0.2.41+）：取消向导 HTTP + `os.Exit`
- [x] 向导：试打 + 用户确认出纸 + 排障分支（v0.2.42+，`/api/test-print`）
- [x] 日志文件人话（P0-3，v0.2.44+）：与 `ui_locale` 共用 `ui_i18n` / `log_strings.go`
- [x] 凭证半年 + 到期提醒（v0.2.51–0.2.52）：Dashboard 顶栏/打印助手 30 天横幅；托盘关于/状态/每日轻提示；`valid_until` 写入 config
- [x] `configure` 并入托盘进程（v0.2.47+）
- [x] 心跳上报 + 版本字段（v0.2.56+：`POST /api/print-agent/heartbeat`、Dashboard「已配对收银机」）
- [x] configure **③ 试打** + 顶栏 `ui_locale` / `/api/ui-locale`（v0.2.43+；≠ 全页完成）
- [ ] configure **① 重配、② 扫描映射** 全量 i18n（§5）
- [ ] `pair_ui` / `setup_ui` 接入 `ui_locale`（§5；主路径常不经 pair）
- [ ] 打印机下拉降术语（友好名、隐藏 `tcp:`/`winspool:` 前缀；§5）
- [ ] 深链 `buildPrintAgentConfigureUrl` 可选 `lang=`（与 Dashboard 对齐）
- [x] Inno 安装收尾（§9）：`wizard-before/after`、自启任务、快捷方式、完成页启动代理
- [x] 版本升级提示（§8）：`recommended_agent_version`、托盘每日弹窗、Dashboard 升级文案

**应用端（Next / Dashboard）**

- [x] `heartbeat` API + `print_agent_devices` 存储 `last_seen` 等字段
- [x] 打印助手：在线状态、版本落后提示（设备列表面板）
- [x] 「打开本机设置」可达性检测（`GET /api/health` + Dashboard 探测后再打开）
- [x] 配对码 UI 强化 + 深链 configure（大号码、倒计时、复制、生成后自动深链；失败任务链到本机设置）
- [x] 配对槽位仅计待使用 + 列表作废（`revoked_at`；`PrintAgentPairingPanel` + `POST .../pairings/[id]/revoke`）

**文档**

- [x] 本文档
- [x] `WINDOWS-README.txt` 托盘颜色与菜单说明（v0.2.40+）
- [x] 同步 `apps/print-agent/README.md`（托盘为主、勿保持黑窗、20 分钟过期）

---

## 现场排障速查（可摘入帮助页）

1. **代理是否在运行**：任务管理器是否有 `MesaPrintAgent`；Mesa **打印助手 → 已配对收银机** 看 `last_seen`（需心跳，v0.2.56+）；托盘 **^** 内是否有 **Mesa Print** 图标。
2. **USB 是否接在收银 PC 上**，Windows 是否识别打印机。
3. **`configure` 中档口映射的 Windows 名** 是否与 **设置 → 打印机** 中一致。
4. **Windows 打印队列** 是否暂停、脱机、积压历史任务（可全部取消）。
5. **Mesa 打印助手** 最近任务是否 `failed`，看 hint；超过 20 分钟需 **重试** 才会再入队。
6. **营业 schedule**：非时段内代理不拉单，属正常。

---

*维护：代理体验变更时请更新「已落地」、进度总览与检查清单。**本文件**为包装/体验进度的首选对照；[`print-agent-plan.md`](./print-agent-plan.md) 偏协议与 API 规格，其中偶见 **15 天**提醒、**90 天** JWT 等旧数——以代码为准（提醒 **`PRINT_AGENT_CREDENTIAL_REMINDER_BEFORE_DAYS = 30`**，凭证 **`180` 天**，见 `print-agent-credential.ts`）。*
