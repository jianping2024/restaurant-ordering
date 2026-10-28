# 本次改动业务场景测试报告：删除死权限 `orders.edit`

日期：2026-10-28  
分支：`chore/remove-dead-orders-edit`

## 1. 本次修改

- **内容**：确认 `orders.edit`（界面曾称「改单」）从未在运行时用 `can`/`requirePermission` 校验；从权限注册表、页面树、默认角色模板、文案、以及库里已存的角色权限数组中删干净。
- **文件**：`packages/shared` 默认矩阵、`apps/web` 权限 registry / page-tree / i18n / 单测；迁移 `20261028210000_drop_unused_orders_edit_permission.sql`；相关产品文档。
- **角色 / 页面**：店主「角色权限」编辑页不再出现「改单」勾选项；服务员/收银/前台默认权限集合不再含该 key。
- **流程**：改已点菜数量等仍走楼面看板能力（`dashboard.waiter_board.view`）或既有专用 key（如 `orders.menu_decrement`），与删除前实际行为一致。

## 2. 核心业务规则

1. 产品权限目录与默认矩阵中不得再出现 `orders.edit`。【本次新增】
2. 库里 `restaurant_roles.permissions` 若仍含该字符串，迁移后必须去掉；读入时未知 key 本就会被丢掉。【本次新增】+【已实现】
3. 改已点行 / 服务员订单 PATCH 仍只认楼面看板等既有能力，不因删 key 变严或变松。【已实现】
4. 历史迁移文件保留旧数组（不可改已应用历史）；活矩阵 = 对齐迁移去掉 `orders.edit` 之后 = `ROLE_TEMPLATES`。【本次新增】

## 3. 详细测试场景

### 场景 1：店主打开角色权限页，看不到「改单」

- **前置状态**：店主登录；本机库已打上 drop 迁移。
- **操作过程**：打开某店「餐厅设置 → 角色权限」，展开服务员/收银/前台相关订单能力。
- **预期结果**：勾选列表无「改单」/`orders.edit`；仍有加菜、打小票、减菜（若模板有）等。
- **数据验证**：`ROLE_PERMISSION_PAGE_TREE` 与 registry 无该 key。
- **异常恢复**：刷新页面后仍无该项。

### 场景 2：库内角色数组已无 `orders.edit`

- **前置状态**：迁移 `20261028210000` 已应用到本机 Docker。
- **操作过程**：查 `restaurant_roles` 中是否还有 `@> '["orders.edit"]'`。
- **预期结果**：0 行。
- **数据验证**：服务员/收银/前台 preset 数组与 `ROLE_TEMPLATES` 一致（无该 key）。
- **异常恢复**：不适用。

### 场景 3：恢复默认不会写回死 key

- **前置状态**：店主可编辑角色；模板已删 `orders.edit`。
- **操作过程**：对服务员角色点「恢复默认」（或等价 API）。
- **预期结果**：写回的权限列表不含 `orders.edit`。
- **数据验证**：该行 `permissions` 与 `ROLE_TEMPLATES.waiter` 集合相等。
- **异常恢复**：失败重试后仍不含死 key。

### 场景 4：旧 JSON 里残留 key 时读权限不报错、也不生效

- **前置状态**：【设计上】若某行仍带未知 key（迁移前或未推迁移的环境）。
- **操作过程**：登录带该角色的员工；打开楼面。
- **预期结果**：`normalizeStoredPermissions` 丢掉未知 key；界面不出现「改单」；既有看板能力照常。
- **数据验证**：capabilities 集合不含 `orders.edit`。
- **异常恢复**：不适用。本机已迁移干净时以场景 2 为准。【待核实】仅在未打迁移环境复现。

### 场景 5：回归 — 服务员仍能按原能力改已点行（若有看板权）

- **前置状态**：服务员账号有 `dashboard.waiter_board.view`；有一桌已点菜。
- **操作过程**：在楼面桌详改数量或走既有 PATCH 路径。
- **预期结果**：与删 key 前相同：有看板权则可操作；无该权则拒绝。不出现「缺 orders.edit」类错误。
- **数据验证**：API 仍只校验看板（或既有专用 key），不校验 `orders.edit`。
- **异常恢复**：拒绝后权限不变即可重试。

### 场景 6：权限与跨角色 — 厨房模板不受影响

- **前置状态**：厨房默认只有后厨看板 + 厨更。
- **操作过程**：对比删除前后厨房模板。
- **预期结果**：集合不变；无 `orders.edit`。
- **数据验证**：`ROLE_TEMPLATES.kitchen` 仍为两项。
- **异常恢复**：不适用。

## 4. 实际测试结果

| 场景 | 结果 | 说明 |
|---|---|---|
| 1 角色页无「改单」 | 【已验证】pass | `MESA_UAT_BASE=http://localhost:3007`；编辑服务员：有 Adicionar / Reduzir item / Servir / Imprimir；无 `orders.edit` / 改单 / Editar pedido |
| 2 库内无该 key | 【已验证】pass | `rows_with_orders_edit=0`；waiter/cashier/frontdesk 数组无该 key |
| 3 恢复默认不写回 | 【已验证】pass | `PATCH …/roles/<waiter> {"reset_to_template":true}` → 5 项模板，无 `orders.edit` |
| 4 旧 JSON 残留 | 【未验证】 | 本机已迁移干净；逻辑上靠 `normalizeStoredPermissions`（单测覆盖未知 key） |
| 5 改已点行回归 | 【未验证】 | 删 key 不改 PATCH 门闸（仍看板能力）；本次未重走开台改菜全链路 |
| 6 厨房模板 | 【已验证】pass | kitchen 仍 2 项；API 列表无 `orders.edit` |

自动化：`permissions.test.ts` 等 30+47 项 pass；`gate.sh scan` 指纹已记。

## 5. 风险与待确认

- 云端 / 店机需打同一 drop 迁移后，库内数组才物理干净；未打前靠 `normalizeStoredPermissions` 丢掉未知 key，界面已无勾选项。
- 勿改已应用的历史迁移文件中的旧数组。
- 场景 5 未做完整楼面改菜 UAT（代码路径未改门闸）；若需可补。
