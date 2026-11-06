# 本次改动业务场景测试报告：清理无效角色权限勾选

日期：2026-11-06  
分支：`fix/prune-dead-permission-keys`

## 1. 本次修改

从角色权限注册表 / 勾选树 / 默认模板中删除从未独立接线的 4 个勾选：

- `checkout.request_whole_table`（整桌发起结账）
- `checkout.apply_discount`（折扣）
- `orders.print_receipt`（打订单小票）
- `print_agent.manage`（打印设备管理）

员工发起结账请求只认 `checkout.assist_bill`；折扣与员工侧小票打印仍跟 `checkout.confirm_payment`；打印助手设备管理仍跟 `settings.print_assistant.manage`。库内旧 JSON 由迁移 `20261106180000_drop_unused_permission_keys` 清理。

涉及：`registry.ts`、`permission-page-tree.ts`、`checkout-request-auth.ts`、`role-permission-templates.ts`、i18n、产品权限指南、上述迁移。

## 2. 核心业务规则

1. 权限树每一项必须能拦住真实 UI 或 API。  
2. 员工发起结账请求（ensure-entry / checkout/request）唯一员工权限：`checkout.assist_bill`。  
3. 楼面「呼叫结账」按钮显隐仍是 `tables.checkout_close`（本改不动）。  
4. 有确认收款即可打折与确认收款；不再存在单独折扣勾选。  
5. 打印助手页/设备 API 仍认 `settings.print_assistant.manage`。  
6. 角色数组里的未知 key 加载时丢弃；迁移后库内也不再保留这 4 个字符串。

## 3. 详细测试场景

### 场景 1：角色编辑页不再出现已删勾选

- **前置状态**：店主登录；打开餐厅设置 → 角色权限 → 编辑前台或收银。  
- **操作过程**：展开「结账请求」「打印设置」「楼面看板」相关树。  
- **预期结果**：看不到「整桌发起结账」「折扣」「打订单小票」「打印设备管理」。仍能看到「协助结账」「确认收款」「读取小票打印机」「呼叫结账」。  
- **数据验证**：无。  
- **异常恢复**：无。

### 场景 2：前台仍能协助/发起结账请求

- **前置状态**：前台角色仍有 `checkout.assist_bill` + `tables.checkout_close`；有一桌已开台有消费。  
- **操作过程**：楼面桌台详情点「呼叫结账」。  
- **预期结果**：进入结账台；请求成功（不因删掉 `request_whole_table` 而 403）。  
- **数据验证**：存在对应 bill_split / 队列项。  
- **异常恢复**：失败可重试。

### 场景 3：只有确认收款、没有协助结账时不能员工发起结账

- **前置状态**：（单测/API）能力集仅有 `checkout.confirm_payment`（或再加 `tables.checkout_close`）。  
- **操作过程**：调用 checkout request 鉴权纯函数 / ensure-entry。  
- **预期结果**：`forbidden_staff` / 403 `staff_checkout_request_forbidden`。  
- **数据验证**：无写入。  
- **异常恢复**：补勾「协助结账」后可通过。

### 场景 4：折扣仍可用（跟确认收款）

- **前置状态**：有确认收款权限的收银/前台；结账详情未收款。  
- **操作过程**：在结账详情改折扣并提交。  
- **预期结果**：折扣 API 仍按 `checkout.confirm_payment` 通过；不因删折扣勾选而失败。  
- **数据验证**：`bill_splits.discount_rate` 更新。  
- **异常恢复**：无。

### 场景 5：恢复默认权限不含已删 key

- **前置状态**：店主打开角色编辑 → 恢复预制默认。  
- **操作过程**：对收银/前台点恢复默认并保存。  
- **预期结果**：保存成功；权限数组不含上述 4 个 key；仍含 `checkout.assist_bill`（收银/前台）与 `checkout.confirm_payment`。  
- **数据验证**：`restaurant_roles.permissions`。  
- **异常恢复**：无。

### 场景 6：回归 — 打印助手入口

- **前置状态**：店主有打印设置权限。  
- **操作过程**：打开餐厅设置 → 打印设置。  
- **预期结果**：页面可进；不依赖已删的 `print_agent.manage`。  
- **数据验证**：无。  
- **异常恢复**：无。

## 4. 实际测试结果

| 场景 | 结果 | 说明 |
|---|---|---|
| 1 角色编辑无已删勾选 | 【已验证】pass | 编辑前台/服务员：有确认收款、协助结账、呼叫结账、Listar impressoras；无已删四项 |
| 2 前台仍能发起结账 | 【已验证】pass | API ensure-entry 200；UI A-03「Chamar conta」进入 `/dashboard/checkout`；已 resume 清理 |
| 3 无协助结账则 forbidden | 【已验证】pass | `checkout-request-auth.test.ts` |
| 4 折扣跟确认收款 | 【已验证】pass | API apply-discount 5%→0%；结账页有 Desconto 框、无单独折扣勾选 |
| 5 恢复默认不含死 key | 【已验证】pass | 服务员 Repor+Guardar 后仍 4 项，API 权限与新模板一致、无死 key |
| 6 打印助手页 | 【已验证】pass | 打印设置可开 |

基址 `http://localhost:3006`；账号前台 `qiantai1`、店主 `baiyun@gmail.com`。

## 5. 风险与待确认

- 若某自定义角色历史上只勾了「整桌发起结账」、没勾「协助结账」，删后将不能再员工发起结账请求；默认模板无此组合。  
- 历史设计文档 `docs/role-permissions-plan.zh.md` 表格仍可能列出旧 key，文首已标注过时。
