# 本次改动业务场景测试报告：开台小票只印人数

**日期：** 2026-10-21  
**分支：** `fix/open-table-receipt-headcount-only`  
**UAT base：** `http://localhost:3002`（功能分支，`MESA_NEXT_DIST_DIR=.next-uat`）  
**改动摘要：** 开台小票改为只印大人/小孩人数；不印份数、不印应付。档口出品联（`station_ticket`）分路不动。

## 1. 本次修改

| 项 | 内容 |
|---|---|
| 内容 | 冷开台自动小票：payload 带 `adult_count`/`child_count`；Agent `buildOpenTableReceipt` 只出人数 |
| 文件 | `open-table-receipt-enqueue.ts`、`escpos.go`、`escpos_encoding.go`、打印相关文案/文档 |
| 角色 | 服务员开台；打印助手出纸 |
| 页面/流程 | 楼面确认开台 → 入队 `order_receipt`/`open_table` → Agent 出纸 |
| 不动 | `station_ticket` / `buildStationTicket`；预结/收款小票的数量列与应付 |

## 2. 核心业务规则

1. 【本次新增】开台票人数唯一来源：会话有效 `buffet_base` 的大人/小孩（`aggregateBuffetHeadcountForOrders` → payload `adult_count`/`child_count`）。
2. 【本次新增】开台票不印份数（无数量列、无假 `qty:1`），不印应付/费用明细。
3. 【已实现】改人数不重打开台票（幂等 `session_open:{sessionId}`）。
4. 【已实现】档口出品联仍走 `station_ticket`，与开台票分路。

## 3. 详细测试场景

### 场景 1：冷开台 6 大 2 小，开台票人数正确

- **前置状态：** `open_table_receipt_print` 开启；A-04 空闲；Washoku `lucky-tea-mulcs62n`；owner `luckytea@gmail.com`。
- **操作过程：** `POST …/staff/waiter/buffet` `intent=open`，Rodizio `adult_count=6` `child_count=2`。
- **预期结果：** `print_jobs` 一条 `open_table`；`adult_count=6`、`child_count=2`；`lines=[]`；无 `amount_due`。
- **数据验证：** SQL 核对 payload；与订单 `buffet_base` 一致。
- **异常恢复：** 测后 `close-session`。
- **标签：** 【已验证】pass — job `ba252134-…`，idem `session_open:b0dc5d8a-…`

### 场景 2：开台 8 大人 0 小孩，不再出现「1 份」

- **前置状态：** 开关仍开；A-06 空闲。
- **操作过程：** 开台 8 大 0 小。
- **预期结果：** payload `adult_count=8`、`child_count=0`、`line_count=0`、无 `amount_due`（不再假 qty=1 行）。
- **标签：** 【已验证】pass — A-06 job `session_open:f42f1006-…`

### 场景 3：改人数不重打

- **前置状态：** A-04 已有开台票。
- **操作过程：** `intent=save` 改为 7 大 1 小。
- **预期结果：** 同 idem 仍只有 1 条任务。
- **标签：** 【已验证】pass — `count(*)=1` for `session_open:b0dc5d8a-…`

### 场景 4：开关关闭则不开台票

- **前置状态：** PATCH `open_table_receipt_print=false`；A-07 空闲。
- **操作过程：** 冷开台 2 大 0 小。
- **预期结果：** 近 10 分钟无 A-07 的 `open_table` 任务。
- **标签：** 【已验证】pass — count=0；开关测后保持关闭（与测前默认一致）

### 场景 5：档口出品联回归

- **前置状态：** Agent 单测。
- **操作过程：** `TestStationTicketUnchangedByOpenTablePath` + 既有 station 单测套件。
- **预期结果：** `station_ticket` 仍打菜名数量；不含开台「Adults:」专用版式。
- **标签：** 【已验证】pass — `go test` focused + full `./...` earlier pass

### 场景 6：预结/收款小票回归（份数与应付仍在）

- **前置状态：** Agent 既有 receipt 单测。
- **操作过程：** `TestBuildOrderReceiptEnglishLayout`（含 Amount Due / Qty）。
- **预期结果：** 收款小票仍有应付与数量列。
- **标签：** 【已验证】pass

### 场景 7：Agent 渲染开台票无应付/无 Qty

- **操作过程：** `TestBuildOpenTableReceiptHeadcountOnly`（Adults:6 Children:2；禁止 Amount Due / Items / Qty）。
- **标签：** 【已验证】pass

## 4. 实际测试结果

| 项 | 结果 |
|---|---|
| `mesa-local-uat` stack-health | pass（web :3002 + local supabase；ops softMissing） |
| login owner | pass |
| 场景 1–4 API+SQL | pass |
| 场景 5–7 Go 单测 | pass |
| 浏览器实打纸张 | 【未验证】本机未接打印机出纸；以 payload + Agent ESC/POS 单测为准 |
| 清理 | A-04 / A-06 / A-07 `close-session` |

## 5. 风险与待确认

- 店机 print-agent 需含本次 `buildOpenTableReceipt`；旧 Agent 对空 `lines` 的 `open_table` 可能几乎空白——上店前确认 Agent 版本。
