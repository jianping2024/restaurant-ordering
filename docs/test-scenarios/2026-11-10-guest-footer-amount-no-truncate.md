# 2026-11-10 顾客菜单底栏合计金额完整显示

## 本次修改

- 内容：底栏合计欧元永不省略号；横向优先级为图标 → 完整金额 → 右侧主操作/成功胶囊让宽
- 文件：`customer-menu-bottom-bar-layout.ts`、`CustomerMenuFooter.tsx`、`customer-menu-bottom-bar-layout.test.ts`、`docs/agent-sole-index.zh.md`
- 角色/页面：顾客扫码菜单底栏（经典 + 寿司共用 `CustomerMenuFooter`）

## 核心业务规则

1. 合计金额只有一种表现：完整 `€X.XX`（sole `FooterAmount`），不得出现 `€173…`
2. 窄屏时右侧「去下单 / 下单成功」文案可截断；金额不可截断
3. 角标仍在 44 图标盒内，不溢出

## 详细测试场景

### 场景 1：已点态窄屏完整金额

- **前置状态**：feature web `:3002`；桌 A-03 已有已点合计 €73.55；中文
- **操作过程**：打开 `/{slug}/menu?table_id=…`；看底栏「合计：€73.55」
- **预期结果**：金额全文可见；`.mesa-money` 无 `truncate`；`text-overflow` 非 ellipsis
- **数据验证**：金额节点 `scrollWidth <= clientWidth`
- **异常恢复**：不适用
- **结果**：【已验证】pass

### 场景 2：大额 + 成功胶囊挤占（应力）

- **前置状态**：场景 1 底栏
- **操作过程**：把金额节点改成 `€1734.50`，右侧注入「✓ 下单成功！」胶囊
- **预期结果**：仍显示完整 `€1734.50`，不出现省略号；金额 `hasTruncate=false`
- **结果**：【已验证】pass（截图可见全文）

### 场景 3：草稿态加菜金额

- **前置状态**：同桌；加入 115 Caipirinha €7.50
- **操作过程**：看底栏草稿合计
- **预期结果**：显示 `€7.50` 全文；无 truncate class
- **结果**：【已验证】pass

### 场景 4：布局契约单测

- **前置**：`customer-menu-bottom-bar-layout.test.ts`
- **预期**：summary 无 overflow-hidden；action 可 shrink；FooterAmount 无 money truncate
- **结果**：【已验证】pass（15/15）

### 不适用并说明

- 多用户并发 / 结账付款：本次只改底栏布局契约，无写路径规则变更
- 真实「下单成功」胶囊：本桌寿司/点单路径下单按钮未在本轮稳定触发成功态；成功态以场景 2 应力 + 代码契约覆盖；草稿/已点实点已覆盖

## 实际测试结果

| 项 | 结果 |
|---|---|
| stack-health `:3002` | pass |
| staff login | pass |
| 已点态金额 DOM | pass |
| 大额+成功应力 | pass |
| 草稿金额 | pass |
| unit layout | pass |

## 风险与待确认

- 极端超长金额（如万级欧元）+ 超长右按钮文案时，右文案可能只剩「✓…」；金额仍须完整——未用真实万级账单复测
