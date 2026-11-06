# 购物袋 / 已点 / 桌台详情 · 口味与浇头展示

## 本次修改

- 购物袋：行下只读展示口味摘要 + 已选浇头（名/份/价）
- 顾客「已点」：行下展示订单说明（口味文案 + 备注）
- 店员桌台详情「已点」：行下展示说明；不同说明分行，相同说明才叠份
- 角色/页面：顾客菜单购物袋与已点；店员桌台详情已点列表

## 核心业务规则

1. 口味/浇头仍在详情里选；购物袋只读展示，不在袋里改配置
2. 下单后浇头仍是独立行；主菜说明里带口味文案
3. 桌台详情列表按「菜 + 价/限量 + 说明」分行；收钱合计仍按原计价（说明不参与合并）
4. 无配置菜：购物袋/已点不出现多余空块

## 详细测试场景

### 场景 1：购物袋展示浇头与口味【已验证】

- **前置**：Washoku 桌 90；1402 Takoyaki 挂浇头
- **操作**：详情浇头 Harumaki +1 → 加入 → 打开购物袋
- **预期**：行下可见「Harumaki / 3 un ×1」
- **结果**：【已验证】pass（`http://localhost:3005`）

### 场景 2：顾客已点展示说明【部分验证】

- **Demo**：【已验证】行下有少冰 / 辣度说明
- **真机带 note 的已提交单**：【未验证】本桌已提交行无 note；未另造单

### 场景 3：桌台详情分行与说明【部分验证】

- **Demo**：【已验证】行下说明可见
- **单测**：不同 note 分行、同 note 叠份【已验证】（`waiter-table-card.test`）
- **真机店员详情页点击**：【未验证】

### 场景 4：回归无配置菜【未验证】

- 本轮未单独点无配置菜入袋

## 清冗余

- **Scanned:** `CartDrawer` / `CustomerCartLineConfigSummary` / `CustomerOrderedItemsList` / `customer-submitted-order-display` / `waiter-table-card` / `WaiterTableDetailLayout`
- **None found:** 只读摘要 sole 组件；已点 note 单一字段；桌台详情 sole `waiterOrderedDisplayMergeKey`（计价仍走 `buildBillableSessionItems`）

## 实际测试结果

| 项 | 结果 |
|---|---|
| Base | `http://localhost:3005`（worktree `feat/cart-ordered-config-demo-ui`） |
| gate scan / uat / check | pass |
| 真机购物袋浇头 | pass |
| 真机已点 note / 桌台详情页 | 未验证（见上） |
