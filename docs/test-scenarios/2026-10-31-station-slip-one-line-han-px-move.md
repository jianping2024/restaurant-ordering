# 本次改动业务场景测试报告 — 档口强制一行 + 中文位图字号迁本机

日期：2026-10-31  
分支：`feat/move-han-bitmap-font-px-to-agent`（Mesa）+ `feat/station-slip-one-line-han-px`（farvoo-fatura / Agent 0.5.58）  
UAT base：`http://127.0.0.1:3002`（功能分支，`MESA_NEXT_DIST_DIR=.next-uat`）

## 1. 本次修改

1. **Agent**：本机勾选「菜名强制一行」「备注强制一行」；超出硬丢弃不加省略号；闸门仅 `stationSlipKeepLines`。
2. **Agent**：中文位图字号改本机配置（默认 22）；出纸只听 `hanBitmapFontPxFromConfig`，忽略云端 payload。
3. **Mesa**：打印设置去掉「中文位图字号」；入队不再写 `han_bitmap_font_px`；features PATCH 不再接受该字段。

涉及角色：店主（打印设置）。页面：打印设置。Agent：配置页 / 出品联出纸（单测）。

## 2. 核心业务不变量

1. Mesa 打印设置**不再**能改中文位图字号。【本次新增】
2. 保存打印设置其它项（分类分组 / 凭证天数 / 打印语言）仍成功。【回归】
3. Agent 默认字号 22；payload 有旧值也不覆盖本机。【本次新增】
4. 菜名/备注强制一行互不绑架；关则仍折行。【本次新增】
5. 截断不加 `…`。【本次新增】

## 3. 详细测试场景

### 场景 1：打印设置页不再出现中文位图字号

- **前置状态**：店主 `luckytea@gmail.com`；本机 web `:3002` 为本功能分支。
- **操作过程**：打开 `/dashboard/settings/print-assistant`，查看「纸面与代理」区块。
- **预期结果**：有分类分组、凭证天数；**无**「中文位图字号」输入框。
- **数据验证**：页面 DOM / 文案断言。
- **异常恢复**：不适用。
- **标签**：【已验证】（浏览器 DOM：`hasHanBitmap=false`，仍有分类/凭证）

### 场景 2：打印设置保存仍成功（回归）

- **前置状态**：同上。
- **操作过程**：`PATCH /api/restaurant/features` 带 `stationSlipShowCategoryGroup` / `credentialTtlDays` / `printLocale`，不带 `hanBitmapFontPx`。
- **预期结果**：成功提示；API `PATCH /api/restaurant/features` 200；body **不含** `hanBitmapFontPx`。
- **数据验证**：响应 JSON 无 `hanBitmapFontPx` 字段；GET features 亦无该字段。
- **异常恢复**：保存失败应有错误文案，不静默。
- **标签**：【已验证】（API 200，响应无 `hanBitmapFontPx`）

### 场景 3：Agent 字号默认 22 且忽略 payload（单测）

- **前置状态**：Agent Go 单测环境。
- **操作过程**：跑 `TestHanBitmapFontPxDefault22`、`TestHanBitmapFontPxFromConfigIgnoresPayload`。
- **预期结果**：pass。
- **数据验证**：writer.hanFontPx=本机值。
- **标签**：【已验证】（`go test` 已绿）

### 场景 4：菜名强制一行丢弃续行（单测）

- **前置状态**：config `station_name_one_line=true`。
- **操作过程**：超长葡语名出品联；对比开关关时含尾词、开时不含。
- **预期结果**：`TestStationTicketNameOneLineDiscardsWrap` pass；无省略号。
- **标签**：【已验证】

### 场景 5：备注强制一行丢弃续行（单测）

- **前置状态**：`station_note_one_line=true`。
- **操作过程**：超长备注；尾标 XYZZY 仅在关闭时出现。
- **预期结果**：`TestStationTicketNoteOneLineDiscardsWrap` pass。
- **标签**：【已验证】

### 场景 6：配置页 API 往返（单测）

- **前置状态**：wizard 临时 config。
- **操作过程**：POST `/api/ui-locale` 写字号与两开关；GET configure-state。
- **预期结果**：落盘与 state 一致。
- **标签**：【已验证】

### 场景 7：旧云端 print_agent_config 残留字号

- **前置状态**：店库 JSON 仍有 `han_bitmap_font_px: 28`。
- **操作过程**：入队新任务；Agent 本机未设或默认 22。
- **预期结果**：纸面用本机 22（忽略 28）。【设计】Mesa 不再 PATCH 该字段。
- **标签**：【未验证】（需联调真机；单测已覆盖忽略 payload）

### 场景 8：并发 / 多 Agent

- **前置状态**：同店两台 Agent。
- **操作过程**：各设不同字号。
- **预期结果**：各打各的（本机真源）。【本次产品意图】
- **标签**：【未验证】（不适用本机 UAT 环境）

## 4. 执行记录

| 项 | 结果 |
|----|------|
| Agent `go test ./...` | **pass**【已验证】 |
| Mesa `print-agent-config.test.ts` | **pass**【已验证】 |
| mesa-local-uat stack-health | **pass**（ready；home soft timeout，login API ok）【已验证】 |
| GET/PATCH features 无 hanBitmapFontPx | **pass**【已验证】 |
| 浏览器打印设置无中文位图字号 | **pass**【已验证】 |
| 总评 | **pass**（场景 7/8 真机多 Agent 标未验证，不挡交付） |
