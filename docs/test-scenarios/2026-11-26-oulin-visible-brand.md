# 可见商标 FARVOO → OULIN

日期：2026-11-26　分支：`feat/oulin-visible-brand`（本仓 worktree）+ `feat/oulin-visible-brand`（farvoo-fatura）

## 本次修改

- 产品对外字标改为 **OULIN**（`PRODUCT_NAME` 及登录/落地/报价/营销可见文案）
- 开票助手界面字标改为 **OULIN 开票** / **OULIN Fiscal Agent**（托盘名、安装向导显示名、快捷方式名）
- **未改**：`source_system='farvoo'`、安装包/exe 文件名、`farvoo-fatura` 仓名、AppData 目录名、`software.ProductName`（SAF-T/AT 软件身份仍为 Farvoo）

## 核心业务规则

1. 界面给人看的产品名只有一套：`PRODUCT_NAME = 'OULIN'`（及 Agent `productName`）
2. 开票同步协议字段仍写 `farvoo`，与字标无关
3. 已装店升级：AppId 不变；卸载名认 `OULIN Fiscal Agent`，并兼容旧 `Farvoo Fiscal Agent` / `Mesa Print Agent`

## 详细测试场景

### 场景 1：职员登录页字标

- **前置状态**：本机 feature web 已起；未登录
- **操作过程**：打开登录页
- **预期结果**：标题/字标为 OULIN，无 FARVOO
- **数据验证**：无写库
- **异常恢复**：刷新仍为 OULIN

### 场景 2：职员顶栏字标

- **前置状态**：员工已登录看板
- **操作过程**：看顶栏左侧产品名
- **预期结果**：显示 OULIN
- **数据验证**：无写库

### 场景 3：开票助手显示名（Agent 仓）

- **前置状态**：Agent 源码已改；本机可跑 `go test` 品牌用例
- **操作过程**：跑品牌常量与卸载名前缀测试
- **预期结果**：`productName=OULIN`；卸载匹配含 OULIN 与旧 Farvoo
- **数据验证**：无改 `software.ProductName`

### 场景 4：协议未误伤

- **前置状态**：代码 diff
- **操作过程**：核对 `source_system` / 下载资产名
- **预期结果**：仍为 `farvoo` / `FarvooFiscalAgent-*.exe`
- **数据验证**：grep 无改动协议值

## 实际测试结果

| 场景 | 结果 | 说明 |
|---|---|---|
| 1 登录页字标 | 【已验证】pass | `http://localhost:3002/auth/login` 标题/字标 OULIN |
| 2 职员顶栏 | 【已验证】pass | 登录后 waiter 顶栏 link「OULIN」 |
| 3 Agent 品牌测试 | 【已验证】pass | farvoo-fatura `go test` brand/uninstall/iss |
| 4 协议未误伤 | 【已验证】pass | `source_system` / `FarvooFiscalAgent-*` 仍在 |

机器证据：`MESA_UAT_BASE=http://localhost:3002` → stack-health、staff login、`PRODUCT_NAME`、HTML 含 OULIN。
