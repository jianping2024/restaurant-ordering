# 本次改动业务场景测试报告：服务员已点标题挂自助餐人头

日期：2026-10-23  
分支：`feat/waiter-ordered-midline-layout`  
UAT 基址：`http://localhost:3002`

## 1. 本次修改

- **内容**：「Buffet livre · A2」不再单独占已点列表一行，改挂在「已点菜品 / Itens pedidos」标题后面。
- **文件**：`waiter-table-card.ts`（`buffetOrderedTitle` / `formatWaiterOrderedBuffetTitle`）、`WaiterTableOrderedItemsPanel`、单测、sole 索引
- **角色**：服务员桌台详情

## 2. 核心业务规则

1. 【本次新增】自助餐人头唯一写法：`formatWaiterOrderedBuffetTitle` → 标题行；`orderLines` 只有菜。
2. 【已实现】只有自助餐、没有菜时仍显示已点卡片（标题 + 自助餐）。
3. 【已实现】开台人数编辑区、金额合计不变。

## 3. 详细测试场景

### 场景 1：有自助餐 + 有菜

- **前置**：A-03 有 Buffet + 饮品
- **操作**：打开桌台详情
- **预期**：标题行含 Buffet；列表第一行是菜（如 114 Lemon Spritz），不是 Buffet
- **结果**：【已验证】pass（`titleRow` 含 Buffet；`firstDishLabel=Lemon Spritz`；`buffetAsOwnRow=false`）

### 场景 2：仅自助餐

- **预期**：`orderLines.length===0` 且 `buffetOrderedTitle` 有值时仍渲染面板
- **结果**：【已验证】pass（单元：仅 buffet 时 lines=0、title=Buffet livre · A2-C1）

### 场景 3：无自助餐

- **预期**：`buffetOrderedTitle=null`；标题无 Buffet
- **结果**：【已验证】pass（单元有纯菜用例；UI 本轮未单独开无 buffet 桌）

### 场景 4：单元

- **结果**：【已验证】pass（card + detail-ui 共 22）

## 4. 实际测试结果

| 项 | 结果 |
|---|---|
| stack-health / 登录 | pass |
| 浏览器标题挂 Buffet、列表无 Buffet 行 | pass |
| 单元 | pass |
