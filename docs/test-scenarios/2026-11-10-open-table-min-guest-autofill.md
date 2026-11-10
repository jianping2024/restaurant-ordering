# 开台最少人数自动补齐 · 业务场景测试

分支：`fix/open-table-min-guest-autofill`  
UAT 基址：`http://localhost:3002`

## 1. 本次修改

选套餐（含默认套餐）时，人数不够最少人数就自动补够，优先加成人。  
文件：`buffet-order.ts`、`useWaiterTableBuffetForm.ts`、`CheckoutHeadcountAdjustModal.tsx`、sole 索引、单测。

## 2. 核心业务规则

1. 合计 < 最少人数 → 补到刚好够；优先成人，成人侧关则儿童
2. 已够或超过 → 不动
3. 已开台桌对齐服务端人数，不自动抬
4. 提交仍用原有最少人数校验

## 3. 详细测试场景

### 场景 1：点选有最少人数的套餐

- **前置**：空桌 A-06；「E2E 仅成人」最少 2
- **操作**：开台弹窗 → 点该套餐
- **预期**：成人 = 2；提示最少 2
- **结果**：【已验证】pass

### 场景 2：换回无最少人数套餐

- **前置**：场景 1 后成人 2
- **操作**：点 Buffet livre（最少 0）
- **预期**：成人仍 2
- **结果**：【已验证】pass

### 场景 3：默认套餐带最少人数

- **前置**：临时把 Buffet livre 最少人数改为 10 并 bump 配置版本
- **操作**：打开 A-06 开台弹窗
- **预期**：默认选中后成人 = 10
- **结果**：【已验证】pass（测后已改回 0）

## 4. 实际测试结果

- 单测 `buffet-order.test.ts` 41 pass
- Chrome 实点 pass
- mesa-local-uat stack-health / login pass

## 5. 风险与待确认

无产品歧义。服务员若想少成人多儿童，自动补成人后仍可手改。
EOF