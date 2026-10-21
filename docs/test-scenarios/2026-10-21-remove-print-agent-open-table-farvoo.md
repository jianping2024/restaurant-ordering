# 本次改动业务场景测试报告 — 删除本仓 print-agent + 开台票改 Farvoo 人数版

## 1. 本次修改
- 从 restaurant-ordering **删除** `apps/print-agent` 及本仓 agent 发布 CI/脚本。
- 开台小票入队 payload：只带大人/小孩人数（`adult_count`/`child_count`），`lines` 为空；纸面由 farvoo-fatura Fiscal Agent `buildOpenTableSlip` 打印。
- 涉及：开台入队、文档/AGENTS、门禁说明；角色：店员开台；页面：楼面开台；流程：开台 → print_jobs → Farvoo 出纸。

## 2. 核心业务规则
1. 开台票只反映大人/小孩人数，不印「共 N 份」、不印应付金额。
2. 档口出品联仍走 Farvoo station ticket，与开台票分路。
3. 本仓不再含 Go agent 源码；claim/入队 API 仍在 web。

## 3. 详细测试场景
### 场景 1：开台入队 payload（API）
- **前置**：功能 `open_table_receipt_print` 开；本地库可用
- **操作**：店员开台（有大人/小孩）
- **预期**：`print_jobs.payload` 含 `receipt_variant=open_table`、`adult_count`/`child_count`、`lines=[]`，无应付金额字段依赖
- **数据验证**：job 可入队；幂等 key `session_open:<sessionId>`
- **异常恢复**：重复开台入队同 session → dedupe

### 场景 2：Farvoo 纸面（已在 farvoo 仓测）
- **前置**：fiscal-agent-v0.5.46
- **操作**：agent 拉到 open_table job
- **预期**：纸上只有桌号 + 大人/小孩；无「共 N 份」、无应付
- **验证**：farvoo `escpos_receipt_test` + check-fiscal-agent 已通过

### 场景 3：回归 — 本仓无 Go 树
- **操作**：确认 `apps/print-agent` 不存在；`npm run print*` 脚本已移除
- **预期**：仓库可 lint/typecheck；web 仍可登录楼面

## 4. 实际测试结果

- stack-health（MESA_UAT_BASE=:3002）：【已验证】pass（ops soft-missing）
- open-table enqueue 单测：【已验证】pass
- `apps/print-agent` 不存在：【已验证】pass
- 本机 owner 登录：【未验证】auth.users 无可用 seed 账号（未 db reset）
- Farvoo 纸面：【已验证】farvoo-fatura `fiscal-agent-v0.5.46` + check-fiscal-agent


## 5. 风险与待确认
- 仍依赖店机安装 Farvoo Fiscal Agent；旧 MesaPrintAgent 包不再从本仓发布。
