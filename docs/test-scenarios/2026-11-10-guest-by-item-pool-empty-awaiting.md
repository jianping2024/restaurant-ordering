# 2026-11-10 按菜领完 · 同桌进现有待结账页

## 本次修改

- 内容：按菜「待认领」为 0 且仍有已呼叫未收时，同桌每台手机进**现有**待结账页（`BillCheckoutSubmittedScreen`）；共用闸口 `guestSharedPlanHoldsAwaiting`；认领草稿超领统一 `clampGuestClaimRows`
- 文件：`guest-bill-split-mode.ts`、`guest-bill-surface-phase.ts`、`customer-bill-split-display.ts`、`use-customer-bill-read-model.ts`、`guest-claim.ts`、`use-guest-claim.ts`、文档与静态说明稿
- 角色/页面：顾客账单（按菜认票 / 待结账）
- UAT 基座：`http://localhost:3002`

## 核心业务规则

1. 【本次新增】整桌是否让**每台手机**进待结账：唯一 `guestSharedPlanHoldsAwaiting`（整桌/均摊 = 已申请；按菜 = `guestByItemPoolFullyCalled`：待认领 €=0 且已呼叫未收 >0）
2. 【已实现】进的是现有 `BillCheckoutSubmittedScreen`；本机没有未结清票 → 无「我的菜品清单」、无「你已呼叫结账」提示
3. 【已实现】门铃仍 `table_checkout_signals` → 弹框 + 刷新；不新开页面、不轮询
4. 【本次新增】服务端 persons 更新后，本机菜单/自助超领统一压到剩余（`clampGuestClaimRows`）
5. 【已实现】店员解锁使菜回池 → 相位回 editing

## 详细测试场景

### 场景 1：A 领完并呼叫 → B 直接进待结账 【已验证】

- **前置状态**：A-07 开台「UAT 第二套餐」成人 2；feature web `:3002`
- **操作过程**：手机 A `POST …/checkout/request` 按菜认领 2 成人并呼叫；手机 B（新浏览器上下文）打开 `/restaurant-mohnrib5/bill?table_id=…`
- **预期结果**：B 看到待结账提示与整桌 Total €45、Pediu a conta €45、分单「张三」；**没有**认菜面板；**没有**「暂时不能点单」类 held 提示
- **数据验证**：B 的 bill：`existing_split.status=requested`，`individual_tickets` 有张三 `called` 且 `mine=false`；待认领口径 unclaimed=0
- **异常恢复**：关台 `confirm_close` + `left_unpaid` 清理
- **结果**：【已验证】pass（API + Chrome 实开页面）

### 场景 2：池子未领完 → B 仍可认菜 【设计契约】

- **前置**：按菜有人呼叫但待认领 >0
- **预期**：`guestSharedPlanHoldsAwaiting` false；未呼叫手机停在认菜编辑
- **结果**：【已实现】公式单测覆盖；本轮未另开半领桌实点——标【未验证】页面

### 场景 3：解锁回池 → 回认菜 【设计契约】

- **预期**：解锁后 unclaimed>0 → editing
- **结果**：【已实现】相位单测「unlock frees shared awaiting」；本轮未实点解锁——【未验证】页面

### 场景 4：回归 · 自己呼叫仍进待结账 【已验证】

- A 呼叫成功 API 200；与既有 `phoneHoldsOrdering` 路径并存于同一相位解析
- **结果**：【已验证】API；UI 以 B 的共享闸口为主验

## 实际测试结果

| 项 | 结果 |
|---|---|
| 清冗余 `gate.sh scan` | pass |
| 单测 phase / shared awaiting / clamp | pass |
| typecheck web | pass |
| UI 手机 B 待结账壳 | pass |
| 关台清理 | pass |

## 风险与待确认

- 待认领用金额口径（与三笔汇总同一公式）；份数与金额若极端不一致需另查——本次自助整数人未触及
- 场景 2/3 页面实点未跑：解锁与「半桌未领完」建议下次补点
