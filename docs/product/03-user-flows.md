# 用户流程

> **状态**：阶段 3 已填充（2026-06-30）  
> **读者**：产品、开发、AI 代理

## 用途

描述核心业务流程的正常路径、异常路径、状态变化与验收标准。防止 AI 乱改状态机逻辑。

**状态图例**

- 会话：`table_sessions.status` → `open` | `billing` | `closed`
- 分单：`bill_splits.status` → `pending` | `confirmed` | `requested` | `paid` | `cancelled`
- 订单：`orders.status` → `pending` | `cooking` | `done`（由 items 推导）
- 订单行：`item_status` → `pending` | `cooking` | `done` | `voided`

---

## 1. 开台流程

### 使用角色

服务员（Waiter）、间接依赖自助餐配置的店主

### 正常流程

1. 服务员进入桌台详情 `/{slug}/waiter/[tableId]`
2. 选择自助餐类型（若餐厅有 active buffet）、录入**成人数**与**儿童数**
3. 点击「确认开台」→ `POST .../staff/waiter/buffet`（人数可为 0）
4. 服务端：`openTableSessionIfAbsent`（无会话则 `table_sessions.status=open`）→ 有人数变化时计价并写入/更新 `buffet_base`
5. 返回桌台详情；`guestOrderingEnabled` 变为 true（有 open session 即可加菜）

### 异常流程

| 情况 | 行为 |
|------|------|
| 人数与当前 active 自助餐完全一致 | no-op，不写库，返回 `unchanged: true` |
| 会话已 `billing` | 服务员自助餐变更被 `session_billing` 拦截 |
| 计价 RPC 失败 | 4xx/5xx，客户端回滚乐观 UI |
| 无自助餐配置 | 开台语义退化为仅创建 `open` 会话；**当前代码仍要求 buffet_base 才能点餐** |

### 状态变化

| 实体 | 变化 |
|------|------|
| `table_sessions` | 无会话 → 插入 `status=open` |
| `orders.items` | 新增或更新 `kind=buffet_base` 行 |
| 看板 | 桌位由空闲变为「用餐中」（有 buffet 或订单行） |

### 验收标准

- 开台前菜单页/加菜 API 返回不可点餐
- 开台后（有 open session）同桌可加菜；人数可后补
- 改人数仅动自助餐行，不动已有 menu 行厨房状态
- `A2C1` 与 `A3C0` 总人数相同但须重算（分项比较）

### 相关代码位置

`lib/buffet-open-table.ts`、`lib/buffet-order.ts`、`lib/table-session-open.ts`、`api/.../staff/waiter/buffet/route.ts`、`lib/guest-table-ordering.ts`

---

## 2. 点餐流程（首次进入菜单）

### 使用角色

顾客（扫码）、服务员（协助点餐 `from=waiter`）

### 正常流程

1. 打开 `/{slug}/menu?table_id=...`（服务员带 `from` / `return` 参数）
2. RSC 调用 `loadCustomerSessionContext` 注入首屏 session + 近期订单；客户端 `useCustomerSessionContext` 挂载后静默 reconcile
3. 条件满足（`open` 会话 + active `buffet_base`）→ 展示菜单、购物车
4. 顾客选菜、提交 → 进入「加菜流程」
5. 提交成功后底栏进入**已点态**；点「查看已点」→ `OrderedDrawer` 浏览已提交明细；「查看账单」→ 现有 `BillPage`

### 异常流程

| 情况 | 行为 |
|------|------|
| 未开台 | 门禁关闭，提示需开台（`buffetRequired`） |
| 会话 `billing` | 禁止点餐，提示去账单页 |
| 餐厅 `suspended_at` | 维护页 |
| 地理围栏超限 | append 拒绝（顾客路径） |
| Demo | `isDemo` 跳过门禁 |

### 状态变化

浏览菜单本身不改变 DB；首次加菜才写 `orders`。

### 验收标准

- 三语菜单可切换，仅展示 `available=true` 菜品
- 未开台时无法提交订单
- `billing` 时菜单不可加菜

### 相关代码位置

`app/[slug]/menu/page.tsx`、`components/menu/MenuPage.tsx`、`components/menu/OrderedDrawer.tsx`、`lib/menu-page-footer.ts`、`lib/customer-menu-order-gate.ts`、`api/.../customer/session/route.ts`

---

## 3. 加菜流程

### 使用角色

顾客、服务员（同一 append API）

### 正常流程

1. `POST .../orders/append` 携带 `table_id`、购物车 items
2. 校验：活跃会话 `open`、地理围栏、rate limit、`guestOrderingEnabled`
3. `resolveAppendCartItems` 服务端解析价格、校验 `available`
4. 合并入同会话已有订单或新建 `orders` 行；`deriveOrderStatusFromItems` 更新订单 status
5. 触发出品联入队 `station_ticket`（`station-ticket-enqueue`）

### 异常流程

| 情况 | HTTP / 错误码 |
|------|----------------|
| 菜品下架 | `menu_item_unavailable` |
| 会话非 open | 拒绝加菜 |
| 限流 | 429 `rate_limited` |
| 乐观锁冲突 | 409 `conflict`（更新已有订单时） |

### 状态变化

| 实体 | 变化 |
|------|------|
| `orders` | 新建或 items 合并；status 可能 `pending`→`cooking` |
| `orders.items[]` | 新增 menu 行，`item_status=pending` |
| `print_jobs` | 新增 `station_ticket`（pending） |

### 验收标准

- 价格以服务端为准
- 加菜后厨房看板可见新行
- 有打印代理时出品联入队

### 相关代码位置

`api/.../orders/append/route.ts`、`lib/resolve-append-cart-items.ts`、`lib/station-ticket-enqueue.ts`、`lib/order-status.ts`

---

## 4. 退菜流程

### 使用角色

后厨（Kitchen void）、前台（Dashboard 楼面看板菜单减菜）。**服务员不可菜单减菜**；自助餐改人数仍走 buffet API。

### 正常流程（后厨）

1. 厨房看板点击菜品 → 标为 `voided`
2. 弹出 `VoidItemReasonDialog` 必填原因
3. `patchStaffOrderItemsClient` 更新 items → `persistOrderItemsUpdate` 重算订单 status
4. 写审计 `ITEM_DELETED` / 异常操作记录（按原 `item_status` 定风险等级）

### 正常流程（前台减数量）

1. `/dashboard/waiter` 桌台详情对 `pending`/`cooking` 行点击减号
2. `POST .../decrement-item`；qty>1 减 1；qty=1 直接取消行（服务端默认 `qty_adjustment`）
3. `decrementOrderItemWithAudit` 持久化 + 审计（减至 0 写 `ITEM_VOIDED`，不进异常队列）

### 异常流程

| 情况 | 行为 |
|------|------|
| `done` 状态行（厨房） | 仍可 void，风险 HIGH |
| 自助餐基准行 | 不可 decrement（`buffet_line`）；改人数走 buffet API |
| 服务员菜单减菜 | API `403 menu_decrement_not_allowed`；UI 不显示减号 |
| `billing` 会话 | 前台/服务员菜单变更被拦截 |
| 缺少 void 原因（楼面减至 0） | 服务端默认 `qty_adjustment` |

### 状态变化

| 实体 | 变化 |
|------|------|
| `orders.items[].item_status` | → `voided` |
| `orders.status` | 由 `deriveOrderStatusFromItems` 重算 |
| `abnormal_operations` | 后厨 void 可能新增 `ITEM_DELETED`；前台减至 0 不写入 |
| `operation_logs` | 审计条目 |

### 验收标准

- void 行不再计入厨房 relevant 列（或显示 voided）
- 退菜须留原因；done 行退菜进异常队列
- 订单 total 随 void 更新

### 相关代码位置

`components/kitchen/KitchenDisplay.tsx`、`lib/order-item-void/*`、`api/.../decrement-item/route.ts`、`lib/audit/*`

---

## 5. 修改人数流程（自助餐）

> 指自助餐**成人/儿童数**调整，非分单消费者人数。

### 使用角色

服务员

### 正常流程

1. 已开台桌台，调整成人/儿童 Stepper
2. 客户端 `isBuffetGuestCountsUnchanged` → 有变则 `POST .../staff/waiter/buffet`
3. 服务端重算 `buffet_base` 金额；**不修改**已有 menu 行

### 异常流程

| 情况 | 行为 |
|------|------|
| 人数未变 | 客户端 toast，不发请求；服务端 no-op |
| `billing` | 409 `session_billing` |
| 冲突 | 409，客户端 refresh 详情 |

### 状态变化

仅 `orders` 中 `buffet_base` 行 qty/金额变化；会话保持 `open`。

### 验收标准

- 改人数后自助餐金额变、已点菜品归属与厨房状态不变
- 分项人数比较（非总人数）

### 相关代码位置

`lib/buffet-order.ts`（`isBuffetGuestCountsUnchanged`）、`lib/buffet-open-table.ts`、`WaiterTableDetail` 自助餐面板

---

## 6. 换桌流程（转台 / 并台）

### 使用角色

服务员

### 正常流程 — 转台（transfer）

1. 来源桌有活跃会话；目标桌**无**活跃会话
2. `POST .../staff/waiter/tables/action` `{ action: 'transfer', from_table_id, to_table_id }`
3. RPC `transfer_table_session`：会话、订单、`display_name` 快照迁至目标桌

### 正常流程 — 并台（merge）

1. 来源桌与目标桌**均有**活跃会话，且 `table_id` 不同
2. 来源桌与目标桌均**非**待结账（`billing` 或无 `bill_splits.requested`）
3. 同上 API，`action: 'merge'`
4. RPC `merge_table_sessions`：来源订单挂到目标 `session_id`；来源会话 `closed`，`closed_reason=merged`

### 异常流程

| 情况 | 行为 |
|------|------|
| 来源桌或目标桌待结账 | 409 `session_billing`；并台目标列表不含待结账桌 |
| 目标桌不符合前置条件 | RPC 失败 400 |
| 相同桌 | `invalid_tables` |

### 状态变化

| 操作 | 会话 | 订单 |
|------|------|------|
| 转台 | 同 session_id，换 `table_id` + `display_name` | 更新 table 快照 |
| 并台 | 来源 closed；目标保留 | 订单改挂目标 session |

### 验收标准

- 转台后看板来源空、目标显示原订单
- 并台后仅目标桌有活跃会话、账单流合并
- 小票/看板显示目标桌 `display_name`

### 相关代码位置

`api/.../staff/waiter/tables/action/route.ts`、`lib/waiter-table-occupancy.ts`（目标筛选）、`docs/table-transfer-merge-plan.zh.md`

---

## 7. 结账流程

### 使用角色

顾客（呼叫结账）、收银员/前台/店主（确认收款）、服务员（恢复点餐/关台）

### 正常流程

```text
顾客账单页配置分单
  → POST .../checkout/request（upsert_bill_split_request）
  → bill_splits.status = requested；table_sessions.status = billing
前台结账台队列展示
  → 可选：apply-discount（折扣+原因）
  → 逐人 POST .../checkout/confirm-payment（confirm_bill_split_payment RPC）
  → session_collected_payments 记账；result 行标 paid
全员付清 → RPC 关台：session closed；bill_splits.status = paid

前台桌台详情（`embeddedInDashboard`，会话 `open`、未呼叫结账）
  → 「去结账」：确认后打印会话总账（`checkout_bill`，合并同类菜品行）→ `checkout-close-table-session` 正常收台（operational，无未收款审计）
  → 「关台」：强制关台（manual + 原因 + 审计），不打印
```

### 异常流程

| 情况 | 行为 |
|------|------|
| 会话已 `billing` 再次 request | 409 `session_billing`（须先恢复或完成） |
| 空会话结账 | `empty_session` |
| 分单金额校验失败 | 400 `amount_mismatch` 等 |
| 已有收款后改分单 | `validateCheckoutContinuation` 409 |
| 整桌已付清 | 禁止 `resume-ordering`（`whole_table_paid`） |
| 强制关台 | 见关台流程：`bill_splits`→`cancelled`，订单 void，session `closed` |
| 并发双人收款 | RPC 原子 + 409 `already_paid` |

### 状态变化

| 阶段 | 会话 | 分单 | 收款 |
|------|------|------|------|
| 呼叫结账 | `open`→`billing` | →`requested` | — |
| 部分收款 | `billing` | `requested`，result 部分 `paid` | 写入 collected_payments |
| 恢复点餐 | `billing`→`open` | 按模式保留/撤销（见 resume 规则） | **不删除**已收台账 |
| 全部付清 | →`closed` | →`paid` | 完整 |
| 强制关台 | →`closed` | 未付→`cancelled` | 已收保留 |

### 验收标准

- 呼叫结账后菜单不可加菜
- 结账台「待收」= 折后应收 − 已收合计
- 部分收款后恢复点餐：已收款项不丢失
- 全员付清后会话关闭、桌位可接新客

### 相关代码位置

`components/menu/BillPage.tsx`、`CheckoutRequestsManager.tsx`、`lib/checkout-request-server.ts`、`lib/checkout-confirm-payment.ts`、`api/.../checkout/*`、`lib/resume-table-session-ordering.ts`、`docs/checkout-dashboard-ui.zh.md`、`docs/checkout-resume-ordering.zh.md`

---

## 8. 打印流程

### 使用角色

系统（自动）、前台（手动打印账单）、打印代理（执行）

### 正常流程

```text
触发源：
  加菜 → station_ticket 自动入队
  呼叫结账 → pre_bill 自动（受 bill_receipt_print 开关）
  确认某人收款 → split_payment 自动；全员付清 → final 自动（同上开关）
  手动「打印账单」/ 去结账 → checkout_bill（不受开关限制）
  （业务三类 vs 四种 receipt_variant：见 docs/technical/04-printing.md §3.1）
代理：
  配对 claim JWT → GET pending-jobs → 打印 → PATCH done/failed
```

### 异常流程

| 情况 | 行为 |
|------|------|
| 无配对代理 | 跳过或仅 HTML `window.print` 兜底 |
| 打印失败 | `print_jobs.status=failed`，Dashboard 可 retry |
| 任务过期 | ~20 分钟过期清理 |
| 设备吊销 | JWT/RLS 拒绝（须 P0 验收） |
| `bill_receipt_print=false` | 跳过 pre_bill/split_payment/final 自动入队 |

### 状态变化

`print_jobs`：`pending`→`processing`→`done`|`failed`。**不改变**订单/会话状态。

### 验收标准

- 加菜后厨房联入队（有代理且路由配置正确）
- 打印成功不推动订单 status
- 纸面桌名为 `display_name`，无 UUID

### 相关代码位置

`lib/station-ticket-enqueue.ts`、`lib/order-receipt-enqueue.ts`、`api/print-agent/*`、`apps/print-agent/`、`docs/print-agent-flow.zh.md`

---

## 9. 按人分单流程（均摊 even）

### 使用角色

顾客（主）、服务员协助

### 正常流程

1. 账单页 `/{slug}/bill` 选择「均摊」
2. 录入消费者姓名列表（人数 N）
3. 系统按总额均分（向下取整到分，余数按规则分配）生成 `result[]`
4. `validateBillSplit` 校验总额匹配
5. 确认 → `checkout/request` → 进入结账流程

### 异常流程

| 情况 | 行为 |
|------|------|
| 人数为 0 | 校验失败 |
| 金额合计≠消费总额 | `amount_mismatch` |
| 已有部分收款后改人数 | 分单模式锁定 |

### 状态变化

`bill_splits.split_mode=even`；`persons` 含姓名；`result` 各行 amount。

### 验收标准

- 各人应付之和 = 会话消费总额（±0.01€）
- 结账台按人展示「本次应收」

### 相关代码位置

`components/menu/BillPage.tsx`、`lib/bill-split-validate.ts`、`lib/checkout-split-math.ts`

---

## 10. 按菜分单流程（by_item）

### 使用角色

顾客（主）

### 正常流程

1. 账单页选择「按菜分单」
2. 分单列表与账单明细一致：**同类菜合并为一行**（与 receipt 同口径）
3. 为每道菜分配至消费者（`item_shares`：每人每菜一行、qty 分数；自助餐含成人/儿童）
4. `bill-split-by-item.ts` 计算各人金额
5. 校验：每行菜品分配完整、份额合计 = 行 qty
6. 确认 → `checkout/request`；`persons` 含 `item_shares`（key 为 catalog key）

### 异常流程

| 情况 | 行为 |
|------|------|
| 未分配菜品 | `unassigned_items` |
| 份额不足/超额 | `incomplete_qty` |
| 恢复点单后 | 零收款可改分配；有收款则已付 **份额 qty 不可减少**（可调高、新菜可继续分给已付的人） |
| 新加菜 / 同款加量 | 纳入 catalog；不得减少已锁定份额 |

### 状态变化

`split_mode=by_item`；`confirmed` 状态在恢复点单时保留快照。

### 验收标准

- 每个 menu 行分配份额之和等于行数量
- 各人金额之和 = 消费总额
- 续结规则与 `checkout-split-continuation.ts` 一致

### 相关代码位置

`lib/bill-split-by-item.ts`、`lib/bill-split-by-item-lines.ts`、`components/menu/ByItemSplitSection.tsx`、`lib/checkout-split-continuation.ts`

---

## 11. 经营分析查看流程

### 使用角色

店主（Owner only）

### 正常流程

1. 打开 `/dashboard/value-analytics`
2. 选择 7 天 / 30 天
3. `GET /api/analytics/value-overview?range=7d|30d`
4. 展示：营业额趋势、客单趋势、热销菜、备货参考（固定近 7 天）

### 异常流程

| 情况 | 行为 |
|------|------|
| 非 owner | 403 / 重定向 |
| 查询超限 | `query_limit_exceeded` |
| 无符合条件会话 | 空图表 |

### 状态变化

只读，无 DB 写入。

### 验收标准

- 仅统计 `closed` 且符合条件的 session（有 paid split 或 order total>0）
- 归属日 = Lisbon 时区 `closed_at` 自然日
- 备货参考始终 7 天，与页面 range 无关

### 相关代码位置

`components/dashboard/ValueAnalyticsPageClient.tsx`、`lib/analytics/analytics.service.ts`、`api/analytics/value-overview/route.ts`、`docs/value-analytics-design.zh.md`

---

## 流程总览

```text
开台(open) → 点餐/加菜 → [可选: 转台/并台]
                ↓
         配置分单 → 呼叫结账(billing, requested)
                ↓
    确认收款(部分/全部) ←→ 恢复点餐(open)
                ↓
         全员付清 → 关台(closed, paid)
```

## 相关文档

- 业务规则：[`04-business-rules.md`](./04-business-rules.md)
- 关台：[`../table-session-close.zh.md`](../table-session-close.zh.md)
- 结账并发：[`../checkout-confirm-payment-race.zh.md`](../checkout-confirm-payment-race.zh.md)
