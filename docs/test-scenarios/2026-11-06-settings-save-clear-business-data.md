# 2026-11-06 餐厅设置：保存下移 + 清理业务数据

分支：`feat/settings-save-clear-business-data`  
UAT base：`http://localhost:3005`（feature；曾用 `:3002` API）

## 本次修改

- 基本资料「保存设置」移到表单底部（不再顶部吸顶）
- 底部「清理业务数据」：仅管理员（owner）；slug + 二次确认
- 有配对开票助手时先挂队清本机票，再 RPC 清 Mesa 运行数据
- 跨仓 farvoo-fatura：Agent 认领 `fiscal_clear_jobs` 并 `ClearTestFiscalSalesData`

## 核心业务规则

1. 仅 `principal.kind === 'owner'` 可清理  
2. `confirmSlug` 与 `confirmPhrase` 均须等于本店 slug  
3. 有未吊销 print-agent 设备时：税控 ack 成功前**不**清 Mesa  
4. 清：会话/订单/结账/打印队列/统计/日志/同行组等；留：菜单/桌台/员工/打印机配置/店资料  

## 详细测试场景

### 场景 1：slug 错误不删

- **前置：** owner 已登录 lucky-tea  
- **操作：** `POST /api/restaurant/clear-business-data` body 错误 slug  
- **预期：** 409 `slug_mismatch`  
- **结果：** 【已验证】pass  

### 场景 2：非管理员不可清

- **前置：** staff `qiantai1`（白云）  
- **操作：** 同 API  
- **预期：** 403 `owner_only`  
- **结果：** 【已验证】pass  

### 场景 3：管理员清理成功

- **前置：** lucky-tea 有 6 张 open/billing 桌、207 道菜、1 台未吊销 Agent 设备；本地用 DB 模拟 Agent ack（新 Agent 二进制未装）  
- **操作：** owner 正确 slug 双确认清理  
- **预期：** 200；`fiscal: cleared`；开台/订单清零；菜单/桌台/员工/设备保留  
- **数据验证：** open_sessions=0, orders=0, menu_items=207, tables=22, staff=7, devices=1  
- **结果：** 【已验证】pass（税控 ack 为本地模拟；Agent 清票代码已在 farvoo-fatura，【未验证】真机 Agent）  

### 场景 4：保存按钮在下方

- **前置：** 打开 `/dashboard/settings`  
- **操作：** 看表单 DOM：submit 在字段后；危险区在表单下  
- **预期：** 无顶部 sticky 保存条；有清理区  
- **结果：** 【未验证】浏览器 Next `MESA_NEXT_DIST_DIR` 下 chunk/`_next/undefined` 不稳定；源码与编译产物含 `ClearBusinessDataSection`，以 API 回归为准  

## 实际测试结果

| 项 | 结果 |
|---|---|
| stack-health | pass |
| owner login | pass |
| slug mismatch 409 | pass |
| staff owner_only 403 | pass |
| clear + DB 断言 | pass |
| UI 实点布局 | 未验证（浏览器 chunk 阻塞） |
| 真机 Agent 清票 | 未验证 |

## 风险与待确认

- 交付前需发布支持 `fiscal_clear_jobs` 的 Fiscal Agent；旧 Agent 在线会导致清理超时（Mesa 故意不清）  
- lucky-tea 本地测试数据已被清光（菜单保留）  
