# 本次改动业务场景测试报告：收银助手推荐版改为 Fiscal Agent

日期：2026-10-18  
范围：打印助手「已配对收银机」升级提示、下载区安装包、`runtime-config.recommended_agent_version`  
UAT 基址：`http://localhost:3002`（功能分支，`MESA_NEXT_DIST_DIR=.next-uat`）

## 1. 本次修改

- **内容**：店内推荐 / 下载 / 「建议升级」只认 Farvoo **开票助手（Fiscal Agent）** `fiscal-agent-v*`；不再用本仓旧 `apps/print-agent/VERSION`（0.3.x）或 `print-agent-v*`。落后提示改为「本机版本严格小于推荐版」。
- **文件（主）**：`print-agent-download.ts`、`print-agent-version-compare.ts`、`PrintAgentDevicesPanel`、`PrintAssistantUpperSection`、`runtime-config`、下载区、Dockerfile / pack 门禁、文案与 on-prem 说明。
- **角色 / 页面**：店主 → `/dashboard/settings/print-assistant`；下载 redirect `/api/downloads/print-agent/*`。

## 2. 核心业务规则

1. 推荐版唯一入口：`resolveRecommendedAgentVersion`（可选 env 钉死，否则 GitHub 最新有安装包的 `fiscal-agent-v*`）。
2. 下载安装包唯一指向 Fiscal Agent 资源名（`FarvooFiscalAgent-Setup-amd64.exe` 等）。
3. 「建议升级」仅当 `agentVersionOlderThan(本机, 推荐)` 为真；本机更新或相同不提示。
4. on-prem 仍靠空 `NEXT_PUBLIC_PRINT_AGENT_GITHUB_REPO` 隐藏下载卡；不再 COPY 旧 VERSION。

## 3. 详细测试场景

### 场景 1：推荐版不再是 0.3.x

- **前置**：`NEXT_PUBLIC_PRINT_AGENT_GITHUB_REPO=jianping2024/farvoo-fatura`，未钉死 VERSION。
- **操作**：打开打印助手；看下载徽章与设备提示。
- **预期**：推荐为 Fiscal 线（本次为 0.5.35），不是 0.3.83。
- **结果**：【已验证】页面徽章 `v0.5.35`；HTML/RSC `recommendedVersion":"0.5.35"`；页面无 `0.3.83`。

### 场景 2：本机已是更新或相同不提示「升到更旧」

- **前置**：比较函数单测；本机 0.5.32 vs 推荐 0.3.83。
- **操作**：`agentVersionOlderThan('0.5.32','0.3.83')`。
- **预期**：false（不提示）。
- **结果**：【已验证】单元测试通过。库中无「恰好等于推荐」的设备行；等于/更新不提示由同一函数覆盖。

### 场景 3：本机更旧才提示升级到 Fiscal 推荐版

- **前置**：设备 `DESKTOP-3VIMRTJ` `agent_version=0.5.29`，推荐 0.5.35。
- **操作**：打开「已配对收银机」。
- **预期**：显示「建议升级至 0.5.35」（葡语 UI：`atualizar para 0.5.35`），不是 0.3.83。
- **结果**：【已验证】Chrome DevTools 快照可见 `0.5.29` + `atualizar para 0.5.35`。

### 场景 4：下载链接指向 Fiscal Release

- **前置**：下载卡可见。
- **操作**：`GET /api/downloads/print-agent/setup-amd64`；页面「全部版本」链接。
- **预期**：302 到 `farvoo-fatura` / `fiscal-agent-v0.5.35` / `FarvooFiscalAgent-Setup-amd64.exe`。
- **结果**：【已验证】`Location: https://github.com/jianping2024/farvoo-fatura/releases/download/fiscal-agent-v0.5.35/FarvooFiscalAgent-Setup-amd64.exe`；页面「Todas as versoes」→ farvoo-fatura/releases。

### 场景 5：on-prem 隐藏下载卡

- **前置**：无 GITHUB_REPO。
- **操作**：`getPrintAgentDownloadUrls()`。
- **预期**：null。
- **结果**：【已验证】单元测试。

### 场景 6：回归 — 设备列表其它字段

- **前置**：已配对设备。
- **操作**：看在线状态、档口、心跳、最近打印。
- **预期**：仍展示；本次仅改版本提示口径。
- **结果**：【已验证】Realtime、档口列表、最近打印均在快照中。

## 4. 实际测试结果

| 项 | 结果 |
|---|---|
| `mesa-local-uat` stack-health（web :3002） | pass（ops softMissing 可接受） |
| owner login luckytea | pass |
| GET `/api/print-agent/devices` | pass（0.5.29） |
| 下载 redirect Fiscal | pass |
| 浏览器打印助手 UI | pass（提示 0.5.35；徽章 v0.5.35） |
| 单元测试 version-compare + download | pass（8） |

## 5. 风险与待确认

- **云端 Vercel**：须把 `NEXT_PUBLIC_PRINT_AGENT_GITHUB_REPO` 设为 `jianping2024/farvoo-fatura`（本机 UAT 已设；未改云端环境变量）。
- 仍跑旧 0.3.x 的设备会被提示升级到 Fiscal——符合「旧线弃用」。

## 清冗余（UAT 前）

- **Scanned**：`getPrintAgentVersion` / `resolveRecommendedAgentVersion` / VERSION 文件读 / arm64 资源 / Dockerfile COPY VERSION / pack·upgrade·install 同步 / `!==` 落后判定。
- **Cleaned**：去掉 VERSION 文件烘焙与 COPY/同步；下载资源改为 Fiscal amd64；落后改 `agentVersionOlderThan`；推荐唯一走 `resolveRecommendedAgentVersion`。
- **None found**：无第二套推荐版计算器；`getPrintAgentVersion` 仅作可选 env 钉死，由 `resolveRecommendedAgentVersion` 消费。
