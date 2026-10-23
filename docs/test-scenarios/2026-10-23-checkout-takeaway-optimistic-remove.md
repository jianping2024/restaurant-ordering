# 本次改动业务场景测试报告：Take away 删除即时反馈 + 删期间锁收款

日期：2026-10-23　分支：`fix/checkout-takeaway-optimistic-remove`

## 1. 本次修改

- 点本桌菜品 Take away 垃圾桶：列表立刻去掉该行（本地按同一套整行作废规则）
- 删除进行中（含加入 Take away 写库期间）：锁收款、恢复点单、改折扣（`detailLocked`）
- 删除失败：行加回 + 提示

涉及：`CheckoutRequestDetailHost`、`voidTakeawayChargeInOrders`、sole index

## 2. 核心业务规则

1. 本地摘行与服务端作废同一规则（`applyOrderItemDecrement` 整行 void）
2. 删/加 Take away 未完成前，不能收款、恢复点单、改折扣
3. DELETE 失败必须还原列表
4. DELETE 成功后仍重算结账单，金额与服务端对齐

## 3. 详细测试场景

### 场景 1：点删立刻从本桌菜品消失

- **前置**：结账页有至少一行 Take away；有收银权限
- **操作**：点该行垃圾桶
- **预期**：行马上消失，不必等网络转完；随后账单金额更新
- **数据验证**：服务端该行 `voided`
- **异常恢复**：—

### 场景 2：删期间不能点收款 / 恢复点单

- **前置**：有 Take away；网络稍慢或观察按钮态
- **操作**：一点删后立刻看「收款」「恢复点单」是否可用
- **预期**：删除未完成前按钮不可用（`detailLocked`）
- **数据验证**：—
- **异常恢复**：完成后恢复可点

### 场景 3：删除失败行加回

- **前置**：能模拟 DELETE 失败（或断网）
- **操作**：点删
- **预期**：短暂消失后加回 + 失败提示；可再删
- **数据验证**：库中行仍在（未 void）
- **异常恢复**：提示后可重试

### 场景 4：回归 — 加入 Take away

- **前置**：结账打开
- **操作**：加入一行 Take away
- **预期**：加入写库期间详情锁定；成功后列表出现新行
- **数据验证**：库中有新行

### 场景 5：单元 — voidTakeawayChargeInOrders

- **操作**：跑 `checkout-takeaway.test`
- **预期**：摘行后 billable 合计与展示 id 正确；未知 id → null

## 4. 实际测试结果

| 场景 | 标签 | 结果 |
|---|---|---|
| 1 点删立刻消失 | 【已验证】 | 浏览器：垃圾桶数 2→1，行消失约 **28ms**（非等网络） |
| 2 删期间锁收款 | 【已验证】 | 同次点击后约 28ms 观察到「Receber」`disabled`；网络快时采样中段已解锁属预期 |
| 3 删除失败加回 | 【未验证】 | 未故意断网/造 DELETE 失败；代码路径有 `setSessionOrders(priorOrders)` |
| 4 加入回归 | 【已验证】 | API POST `lines[{7.5,qty:1}]` → 200 |
| 5 单元 | 【已验证】 | `checkout-takeaway.test` 29 pass |

Base：`http://localhost:3002`（feature + `.next-uat`）

## 5. 风险与待确认

- 摘行后、账单重算完成前，上方待收可能仍含该笔 — 此期间收款已锁
- 场景 3 失败还原仅代码审查 + 未跑失败注入
