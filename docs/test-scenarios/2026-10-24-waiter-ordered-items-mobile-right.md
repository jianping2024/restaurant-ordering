# 本次改动业务场景测试报告：已点菜品窄屏贴右

日期：2026-10-24  
分支：`fix/waiter-ordered-items-mobile-right`  
UAT 基址：`http://localhost:3002`（`MESA_NEXT_DIST_DIR=.next-uat`）

## 1. 本次修改

- **内容**：服务员桌台详情「已点菜品」行：视口宽度低于 `sm`（640px）时，价格 / 数量 / 减号贴右（去掉右侧空白列）；`sm` 及以上保持原先居中。
- **文件**：`waiter-table-detail-ui.tsx`、`waiter-table-detail-ui.test.ts`、`docs/agent-sole-index.zh.md`
- **角色 / 页面**：服务员 / 桌台详情已点列表
- **不动**：顾客已点抽屉、点减 API、金额权限门禁

## 2. 核心业务规则

1. 【本次新增】窄屏三列：`5ch | 1fr | auto`，mid 贴右；宽屏四列加 balance，mid 居中。同一套 `waiterDetailLayout` token。
2. 【已实现】单价仍只来自 `line.unitPrice`；减号 / 上菜仍在 mid 簇内。
3. 【已实现】切换只看视口宽度（`sm`），不按设备型号。

## 3. 详细测试场景

### 场景 1：窄屏 — mid 贴右

- **前置**：白云 A-03 开台已点；`qiantai1` 登录；视口约 390–500px
- **操作**：打开桌台详情「Itens pedidos」；量第一行 Lemon Spritz 的 mid 相对行右缘
- **预期**：右侧无大块空白；`balance` 不显示；grid 为三列
- **数据验证**：DOM `gapRight=0`，`balanceDisplay=none`，`midCenterRatio≈0.784`
- **结果**：【已验证】pass

### 场景 2：宽屏 — mid 仍居中

- **前置**：同桌；视口 1024px
- **操作**：再量同一行
- **预期**：mid 约在行中；`balance` 显示；两侧 `1fr`
- **数据验证**：`midCenterRatio≈0.529`，`midNearCenter=true`，`balanceDisplay=block`，`gapRight≈349`
- **结果**：【已验证】pass

### 场景 3：单元断言双形态

- **操作**：`apps/web` 下跑 `waiter-table-detail-ui.test.ts`
- **预期**：默认三列 + `sm:` 四列 + balance `hidden`/`sm:block`；10/10
- **结果**：【已验证】pass

### 场景 4：窄屏减号仍可点

- **前置**：A-03「Chá Jasmin」× 2；窄屏；关掉「Continuar pedido」遮罩
- **操作**：点该行减号
- **预期**：变为 × 1；饮食金额下降
- **数据验证**：UI × 2→× 1；Alimentação €40.15→€37.65
- **结果**：【已验证】pass

### 场景 5：顾客已点抽屉

- **说明**：未改顾客路径
- **结果**：【不适用】未测

## 4. 实际测试结果

| 项 | 结果 |
|---|---|
| 清冗余 | pass（scan.md；无死导出/平行形态） |
| stack-health :3002 | pass |
| staff login qiantai1 | pass |
| 窄屏 mid 贴右 | 【已验证】pass |
| 宽屏 mid 居中 | 【已验证】pass |
| 单元 | 【已验证】pass |
| 减号点击 | 【已验证】pass |

## 5. 清冗余

- **Scanned:** `orderedItemRow` / `orderedItemBalance` + `WaiterTableOrderedItemsPanel`；`rg` 无 `orderedItemIdentity` / 平行 far-right 列
- **None found:** 唯一写法仍是一套 receipt grid token（响应式 class）
- **Cleaned:** 无

## 6. 风险与待确认

- `sm`（640px）与个别真机长菜名「刚好裁切」宽度可能不完全重合；店内若反馈偏早/偏晚贴右，可再调断点。
