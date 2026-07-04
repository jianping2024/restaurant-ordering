# 菜单加单（顾客 / 服务员代点）：实现契约（单管道）

## 目的

顾客扫码点菜与服务员代点，**共用同一条服务端写单管道**（`orders/append`），仅在入口鉴权、地理围栏与提交后 UI 分流。实现须 **简洁、安全、高效**：一条写单出口、一条出品入队出口，禁止为 guest / waiter 各写一套 insert 逻辑。

**前置依赖**：须先完成自助餐开台（`buffet_base` 行存在），见 [`buffet-open-table.zh.md`](buffet-open-table.zh.md)。  
**价格信任**：客户端仅提交 `menu_item_id + qty + note?`，服务端查价，见 [`menu-order-append-price-trust.zh.md`](menu-order-append-price-trust.zh.md)。

---

## 业务规则（锁定）

1. **开台优先**：`table_sessions.status = open` 且 session 内存在未作废的 `buffet_base` 行，才允许加菜（`guestOrderingEnabled`）。否则客户端禁用购物车、服务端返回 `buffet_required`。
2. **结账中不可加单**：`session.status = billing` → `session_billing`（409）。
3. **自助餐行不可经 append 创建**：请求体不得含 `kind: buffet_base`、`buffet:` 前缀或客户端价格字段；自助餐仅走 `POST .../staff/waiter/buffet`。
4. **同餐次合并写单**：session 内若已有「最新一条」order，新批次 **merge 进该 order**（追加 `items`、重算 `total_amount` 与 `status`）；否则 **insert** 新 order。首单与加单由响应 `is_first_order` / `had_done_before` 区分。
5. **地理围栏仅顾客流**：餐厅配置了 `geo_latitude/longitude` 时，**非** `waiter_flow` 须带合法 `latitude/longitude` 且在 `order_radius_meters` 内（本地 dev host 可 bypass）。
6. **服务员代点须鉴权**：`waiter_flow: true` 时须通过 `verifyOpenTableStaffAuth`（owner / waiter / frontdesk）；否则 `unauthorized`（401）。
7. **出品联自动入队**：append 成功后返回短期 `enqueue_token`；客户端再调 `station-tickets/auto` 按档口分组入队（无手动「打印」按钮）。

---

## 唯一管道（服务端）

`POST /api/restaurants/[slug]/orders/append` 必须按序执行，**不得**为 guest / waiter 分叉写库。

```
① 限流   orderAppendRateLimitCheck(clientIp)  → 429 rate_limited

② 解析   table_id（UUID）、items[]、waiter_flow?、latitude/longitude?

③ 租户   resolveOrderRestaurant(slug, guest|staff)
         verifyOrderAppendGate（waiter 鉴权 / 顾客 geo）
         → restaurant_tables 校验 table_id 属于该店且未删除

④ 上下文 loadAppendWriteContext（合并原 ⑥⑦⑨ 读路径）
         session + session orders（pending/cooking/done）
         → guestOrderingEnabled 扫全 session orders
         写单 merge 目标 = created_at 最新一条

⑤ 定价   resolveAppendCartItems
         menu_items + 仅 cart 所需 category 祖先链（非全树）

⑥ 写单   writeAppendBatch（update 合并 | insert 新单）

⑦ 签名   signOrderEnqueueToken({ restaurant_id, order_id, batch_id })

⑧ 返回   { ok, order_id, batch_id, session_id, enqueue_token,
            is_first_order, had_done_before }
```

**禁止**

- guest / waiter 各写一套 insert/update 分支
- 信任客户端 `price`、`name_*`、`batch_id`（`batch_id` 由 `generateAppendBatchId` 在服务端生成）
- 未经 `guestOrderingEnabled` 写 menu 行
- 在 append 内创建或修改 `buffet_base`

---

## 提交后管道（出品入队）

append 与入队 **解耦**：入队凭 token，不重复走 staff 密码。

```
客户端收到 enqueue_token
    → POST /api/restaurants/[slug]/station-tickets/auto
       body: { order_id, batch_id, enqueue_token }

服务端
    ① verifyOrderEnqueueToken（10 分钟 TTL）
    ② autoEnqueueRateLimitCheck
    ③ enqueueStationTicketsForOrder（按 effective_station_id 分组 insert station_ticket）
    ④ 返回 ok 或 nothing_enqueued / no_station_bound_lines 等
```

**客户端策略**（`autoEnqueueStationTicketsAfterSubmit`）

- 顾客流：await 入队；非静默错误可 toast
- 服务员流（`waiterFlow`）：同上；`nothing_enqueued` 静默

---

## 客户端：共用 `MenuPage`

**唯一 UI 组件**：`apps/web/src/components/menu/MenuPage.tsx`  
**唯一 submit 出口**：`submitOrder()` → `fetch(.../orders/append)`（全库仅此一处调用 append）。

### 进入菜单

| 来源 | URL 形态 | `returnToWaiterHref` |
|------|----------|----------------------|
| 顾客扫码 | `/{slug}/menu?table_id={uuid}` | `null` |
| 服务员（slug 看板） | `.../menu?table_id=...&from=waiter&return=/{slug}/waiter/...` | 见下节 |
| 服务员（dashboard 看板） | `...&return=/dashboard/waiter/...` | 见下节 |
| Demo | `/demo/menu?...` | `/demo/waiter/...` |

`returnToWaiterHref` 由服务端页面解析（`[slug]/menu/page.tsx`、`demo/menu/page.tsx`）：

- `from !== waiter` → `null`（顾客流）
- `from === waiter` 且 `return` 以 **允许前缀** 开头 → 使用 `return`
- 否则回退默认看板：`/{slug}/waiter`（demo 为 `/demo/waiter`）

**允许的回跳前缀（契约，须防开放重定向）**

| 前缀 | 场景 |
|------|------|
| `/{slug}/waiter` | 服务员 slug 看板 |
| `/dashboard/waiter` | 业主 / 前台 dashboard 楼台看板 |
| `/demo/waiter` | Demo |

**实现状态**：契约函数为 `resolveWaiterMenuReturnHref`（`staff-routes.ts`）。若菜单页仍仅用 `returnPath.startsWith('/{slug}/waiter')`，则 dashboard 的 `return=/dashboard/waiter/...` 会被丢弃并回退到 `/{slug}/waiter`，导致代点完成后误进服务员鉴权页——属已知缺口，修复时只改解析函数与菜单/账单入口，**不要**改 append 写单管道。

### 会话同步（加菜门禁 UI，无轮询）

顾客菜单**不**后台定时刷新；状态在**用户操作时**与服务器对齐。

```
RSC menu/page.tsx
  → loadCustomerSessionContext（与 GET .../customer/session 同形）
  → MenuPage initialSessionContext + useCustomerSessionContext
  → guestOrderingEnabled(activeSession, recentOrders)
       本地已可点 → 直接加菜
       本地不可点 → 加菜 / 提交前 refresh，重算门禁
  → append 返回 session_billing → refresh，再提示
```

与开台管道对齐：服务员开台后，顾客**第一次点加菜**会拉到 `buffet_base`，门禁放开。  
恢复点单后同理：本地仍显示「结账中」时，点「+ 加入」会先刷新 session，`billing → open` 后即可加菜。

**不自动更新**：已下单区菜品状态、顶部横幅，在用户不操作时不刷新；刷新页面或再次加菜/提交时会更新。

### 提交流程（`submitOrder`）

**列表步进器**：`MenuItemCard` 在 `qty > 0` 时显示 `CartQtyStepper`（`− / n / +`），仅改本地 `cart`；`qty = 0` 时显示「+ 加入」。与 `CartDrawer` 共用 `CartQtyStepper` + `bumpCartItem` / `updateQty`。**已下单**区为服务端 `recent_orders`，不可在菜单页删减。

**顾客流**（`!returnToWaiterHref`）：

```
① 门禁   ensureGuestCanPlaceOrder（demo 跳过；不可点时先刷新 session）
② 定位   餐厅有 geo → getBrowserLocation + 距离校验
③ 请求   POST append { table_id, items, latitude, longitude }
         （无 waiter_flow）
④ 入队   await autoEnqueueStationTicketsAfterSubmit
⑤ 刷新   await loadSessionAndOrders
⑥ 反馈   见下节「提交后反馈」
```

**服务员代点**（`returnToWaiterHref` 有值）：

```
① 门禁   同顾客
② 定位   跳过 geo
③ 请求   POST append { ..., waiter_flow: true }
④ 入队   void autoEnqueueStationTicketsAfterSubmit（不阻塞）
⑤ 反馈   清购物车，无 success toast
⑥ 跳转   router.push(returnHref?from=menu_submit)
         桌台页进入：router.refresh()（当前桌台 RSC）+ 一次 fetchWaiterTableDetailClient
         完成后 router.replace 去掉 query（`staff-assisted-return-sync.ts`）
         进入菜单时 router.prefetch(returnHref)；路由 loading.tsx 占位
```

**Demo**：不发真实 append；清空购物车。服务员 demo 走 `completeStaffAssistedOrderSubmit`（无 toast、立即跳回看板）；顾客 demo 展示专用 demo Banner，不发 `orderSuccess`。

### 提交后反馈（锁定）

加单成功后须 **轻量、非阻断**，便于顾客连续点菜；**禁止**全屏遮罩阻断菜单。

| 反馈 | 行为 |
|------|------|
| 成功 Toast | **仅顾客流**：`showToast(t.orderSuccess, 'success')`；右下角，约 3s |
| 购物车 | 清空并关闭抽屉 |
| 已下单列表 | **仅顾客流**：`refreshSessionContext` 后更新；`batch_id` 对应行 **NEW** 约 15s |
| 服务员代点 | **无** success toast；跳回桌台后由桌台页完成 SSR+client 一次 reconcile（`?from=menu_submit`） |

**禁止**：全屏 modal / 模糊遮罩阻断点菜；成功态不得占用 3s 不可交互时间。

### 服务员看板 → 菜单链接

`WaiterTableDetail` / `WaiterDisplay` 使用 `waiterMenuHref(slug, tableId, options)`（内部设置 `from=waiter` 与 `return=waiterTableHref(...)`）。

`waiterTableHref` 映射：

| 场景 | 看板 / 桌台路径 |
|------|----------------|
| 默认服务员 | `/{slug}/waiter`、`/{slug}/waiter/{tableId}` |
| Dashboard 楼台 | `/dashboard/waiter`、`/dashboard/waiter/{tableId}` |
| Demo | `/demo/waiter/...` |

代点完成后应回到 **发起代点的同一路径**（dashboard 须回 `/dashboard/waiter/...`，不得落到 `/{slug}/waiter` 触发服务员页鉴权）。

---

## 错误码（append）

| HTTP | `error` | 含义 | 客户端处理 |
|------|---------|------|------------|
| 400 | `invalid_table_id` / `invalid_items` / `location_required` | 参数或购物车非法 | toast 提交失败 / 定位 |
| 401 | `unauthorized` | waiter_flow 无 staff 会话 | toast 提交失败 |
| 403 | `buffet_required` / `location_too_far` | 未开台 / 超距 | 等待开台 / 距离提示 |
| 409 | `session_billing` | 结账中 | 账单提示 |
| 429 | `rate_limited` | IP 限流 | 限流提示 |
| 5xx | `order_*_failed` 等 | 写库失败 | 提交失败 |

---

## 代码地图

| 职责 | 模块 |
|------|------|
| 菜单 UI + 唯一 submit | `components/menu/MenuPage.tsx` |
| 列表 / 抽屉数量步进器 | `components/menu/CartQtyStepper.tsx` |
| 顾客菜单路由 | `app/[slug]/menu/page.tsx` |
| 加菜门禁（开台） | `lib/guest-table-ordering.ts` → `guestOrderingEnabled` |
| 购物车解析 + 服务端定价 | `lib/resolve-append-cart-items.ts` |
| append API（薄编排） | `app/api/restaurants/[slug]/orders/append/route.ts` |
| 租户解析 | `lib/order-restaurant-context.ts` → `resolveOrderRestaurant` |
| 鉴权 / geo 门禁 | `lib/order-submit-gate.ts` → `verifyOrderAppendGate` |
| 合并读上下文 | `lib/append-write-context.ts` → `loadAppendWriteContext` |
| 写单 | `lib/append-write-batch.ts` → `writeAppendBatch` |
| 服务员代点鉴权 | `lib/staff-api-auth.ts` → `verifyOpenTableStaffAuth` |
| 活跃 session | `lib/table-session-open.ts` → `findActiveTableSession` |
| 入队 token | `lib/order-enqueue-token.ts` |
| 提交后入队（客户端） | `lib/auto-enqueue-station-tickets.ts` |
| 提交后反馈（顾客 vs 代点） | `lib/menu-order-submit-outcome.ts` |
| 入队 API | `app/api/restaurants/[slug]/station-tickets/auto/route.ts` |
| 档口分组入队 | `lib/station-ticket-enqueue.ts` |
| 会话上下文（SSR + 操作时 refresh） | `lib/customer-session-context.ts` → `loadCustomerSessionContext`、`lib/use-customer-session-context.ts`、`lib/customer-menu-order-gate.ts` |
| 看板 → 菜单链接 | `lib/staff-routes.ts` → `waiterMenuHref` |
| 看板回跳路径（契约） | `lib/staff-routes.ts` → `waiterTableHref`、`resolveWaiterMenuReturnHref` |
| 代点回桌台新鲜度契约 | `lib/staff-assisted-return-sync.ts` |
| 桌台详情 client | `components/waiter/useWaiterTableDetail.ts` |
| 开台前置（另一管道） | [`buffet-open-table.zh.md`](buffet-open-table.zh.md) |

---

## 扩展新规则时

- **新的加菜前置条件**：只改 ⑥⑦（例如时段菜单），或 `guestOrderingEnabled`；**不要**新开第二条写单 API。
- **新的鉴权角色**：只改 `openTableAuthFromRequest` / `OPEN_TABLE_AUTHORIZED_STAFF_ROLES`。
- **新的回跳来源**：在 `resolveWaiterMenuReturnHref` 增加允许前缀；**不要**在 `MenuPage` 硬编码路径。
- **合并语义变化**（例如按批次拆单）：只改 ⑨ 写单策略，保持 append 单出口。
