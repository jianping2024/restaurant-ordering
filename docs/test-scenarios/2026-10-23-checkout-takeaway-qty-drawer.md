# 本次改动业务场景测试报告：结账 Take away 右侧推入 + 可改数量

日期：2026-10-23　分支：`fix/checkout-takeaway-right-drawer-qty`

## 1. 本次修改

- Take away 编辑从居中小弹窗改为右侧推入（与继续点餐同一套 `RightPushPanel`）
- 每行：固定名称、可填单价、−/+ 改数量（默认 1，不可手输）、只读小计；底部钉死合计、「再加一项」、取消/加入账单
- POST 唯一 body：`lines:[{amount,qty}]`（不再用无 qty 的 `amounts[]`）
- 账单「本桌菜品」与编辑窗删除均复用按菜结账的 `RowRemoveIconButton`；删除 = **整行作废**（数量>1 也不减一）
- 账单/收据/发票继续走 `OrderItem.qty × price`

涉及：`CheckoutTakeawayModal`、`CheckoutTableItemsSection`、`RightPushPanel`、`checkout-takeaway*`、`decrement-order-item`、i18n

## 2. 核心业务规则

1. 名称固定 `TAKE AWAY (PAGA À PARTE).`，不可改
2. 单价 >0 且最多两位小数；数量整数 1..99，仅 −/+ 改
3. 加入账单前只改本地草稿，不自动写库
4. 垃圾桶删整行（草稿去掉一行 / 已入账整行 void）
5. 纸质收据与发票：`qty`=数量、`unit_price`=单价、小计=单价×数量
6. 非法 `lines` → 400 `invalid_lines`

## 3. 详细测试场景

### 场景 1：右侧推入加入（单价×数量）

- **前置**：开台有菜；结账请求打开；收银权限
- **操作**：点＋ Take away → 右侧推入 → 填单价 2.50 → 点 + 到数量 3 → 加入账单
- **预期**：本桌菜品出现一行，`× 3`，小计 €7.50；面板关闭
- **数据验证**：`orders.items` 一行 kind=takeaway，price=2.5，qty=3
- **异常恢复**：取消不写库；再次打开是空草稿

### 场景 2：编辑窗垃圾桶删草稿行

- **前置**：编辑窗已有两行草稿
- **操作**：点第二行垃圾桶
- **预期**：第二行消失；合计随变；不写库
- **数据验证**：无新订单行

### 场景 3：账单列表垃圾桶整行删除（数量>1）

- **前置**：已有 qty=3 的 Take away
- **操作**：本桌菜品点该行垃圾桶
- **预期**：整行消失（不是变成 ×2）；总额减少 7.50
- **数据验证**：该行 item_status=voided，qty 仍为 3（作废记录）

### 场景 4：非法数量/金额 API

- **前置**：有效 bill_split_id + 登录
- **操作**：POST `lines:[{amount:1.5,qty:0}]` 或旧 `amounts:[1.5]`
- **预期**：400 `invalid_lines`
- **数据验证**：无新行

### 场景 5：收据/发票口径（数量>1）

- **前置**：桌上一行 takeaway price=2.5 qty=3
- **操作**：构建收据行 / whole_table 发票 payload（单测）
- **预期**：qty=3、unit=2.50、line_gross=7.50、open_price
- **数据验证**：单测断言

### 场景 6：回归 — 继续点餐壳

- **前置**：服务员桌台
- **操作**：继续点餐
- **预期**：仍从右侧推入（`RightPushPanel` ordering 宽度）

## 4. 实际测试结果

| 场景 | 标签 | 结果 |
|---|---|---|
| 1 右侧推入加入 | 【已验证】 | API：白云 A-19 POST `lines[{2.5,qty:3}]` → 库 qty=3 price=2.5；UI：右侧推入名称/单价/−/+/小计/底部钉死 |
| 2 编辑窗删草稿 | 【已验证】 | UI 打开编辑窗可见垃圾桶（与账单同组件）；草稿不写库（取消关闭） |
| 3 账单删整行 qty>1 | 【已验证】 | API DELETE 后 `item_status=voided` 且 qty 仍为 3；UI 本桌菜品 `TAKE AWAY × 2 €5.00` + trash |
| 4 非法 lines | 【已验证】 | 旧 `amounts[]`、`qty:0` → 400 `invalid_lines` |
| 5 收据/发票 qty | 【已验证】 | `checkout-takeaway.test` + decrement 共 34 pass（含 void 整行） |
| 6 继续点餐壳 | 【已实现】 | `StaffOrderingShell` 已改用同一 `RightPushPanel`（本轮未再点开） |

Base：`http://localhost:3002`（feature + `MESA_NEXT_DIST_DIR=.next-uat`）

## 5. 风险与待确认

- 真机热敏小票【未验证】（无 print-agent）；收据 builder 单测已覆盖 qty×单价
