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
6. **服务员代点须鉴权**：`waiter_flow: true` 时须通过 `openTableAuthFromRequest`（owner / waiter / frontdesk）；否则 `unauthorized`（401）。
7. **出品联自动入队**：append 成功后返回短期 `enqueue_token`；客户端再调 `station-tickets/auto` 按档口分组入队（无手动「打印」按钮）。

---

## 唯一管道（服务端）

`POST /api/restaurants/[slug]/orders/append` 必须按序执行，**不得**为 guest / waiter 分叉写库。

```
① 限流   orderAppendRateLimitCheck(clientIp)  → 429 rate_limited

② 解析   table_id（UUID）、items[]、waiter_flow?、latitude/longitude?

③ 租户   loadCustomerRestaurantForApi
         → restaurant_tables 校验 table_id 属于该店且未删除

④ 鉴权   staffOrderFlow = waiter_flow ? openTableAuthFromRequest(slug) : null
         waiter_flow 且 !staffOrderFlow → 401 unauthorized

⑤ 围栏   餐厅有 geo 且 !staffOrderFlow
         → 校验坐标；缺失 location_required，超距 location_too_far

⑥ 会话   findActiveTableSession(restaurant_id, table_id)
         无 session → 403 buffet_required
         status = billing → 409 session_billing

⑦ 开台   拉 session 内 orders（pending/cooking/done）
         → guestOrderingEnabled(session, orders)
         false → 403 buffet_required

⑧ 定价   resolveAppendCartItems(admin, restaurant_id, raw items)
         仅信任 menu_item_id/qty/note；DB 查 menu_items 填价
         失败 → 400 invalid_items | menu_item_not_found | menu_item_unavailable

⑨ 写单   查 session 最新 order
         有 → update 合并 items、total_amount、deriveOrderStatusFromItems
         无 → insert 新 order（table_id + display_name + session_id）

⑩ 签名   signOrderEnqueueToken({ restaurant_id, order_id, batch_id })

⑪ 返回   { ok, order_id, batch_id, session_id, enqueue_token,
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

### 会话轮询（加菜门禁 UI）

```
挂载 MenuPage
  → requestCustomerSessionContext(slug, table_id)   GET .../customer/session
  → useCustomerContextPoll
       无 session：30s 轮询（等开台）
       有 session：20s 轮询（订单状态）
  → guestOrderingEnabled(activeSession, recentOrders)
       false → 禁用加购 / 提交，展示「等待开台」或「结账中」
```

与开台管道对齐：开台成功后轮询拉到 `buffet_base`，`canPlaceMenuOrders` 变为 true。

### 提交流程（`submitOrder`）

**顾客流**（`!returnToWaiterHref`）：

```
① 门禁   canPlaceMenuOrders（demo 跳过）
② 定位   餐厅有 geo → getBrowserLocation + 距离校验
③ 请求   POST append { table_id, items, latitude, longitude }
         （无 waiter_flow）
④ 入队   await autoEnqueueStationTicketsAfterSubmit
⑤ 刷新   await loadSessionAndOrders
⑥ UI     成功 toast ~3s
```

**服务员代点**（`returnToWaiterHref` 有值）：

```
① 门禁   同顾客
② 定位   跳过 geo
③ 请求   POST append { ..., waiter_flow: true }
④ 入队   await autoEnqueueStationTicketsAfterSubmit(waiterFlow: true)
⑤ 刷新   await loadSessionAndOrders
⑥ 跳转   setSubmitted → 1200ms 后 router.push(returnToWaiterHref)
```

**Demo**：不发真实 append；清空购物车后同样延迟跳回看板或 toast。

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
| 顾客菜单路由 | `app/[slug]/menu/page.tsx` |
| 加菜门禁（开台） | `lib/guest-table-ordering.ts` → `guestOrderingEnabled` |
| 购物车解析 + 服务端定价 | `lib/resolve-append-cart-items.ts` |
| append API | `app/api/restaurants/[slug]/orders/append/route.ts` |
| 服务员代点鉴权 | `lib/staff-api-auth.ts` → `openTableAuthFromRequest` |
| 活跃 session | `lib/table-session-open.ts` → `findActiveTableSession` |
| 入队 token | `lib/order-enqueue-token.ts` |
| 提交后入队（客户端） | `lib/auto-enqueue-station-tickets.ts` |
| 入队 API | `app/api/restaurants/[slug]/station-tickets/auto/route.ts` |
| 档口分组入队 | `lib/station-ticket-enqueue.ts` |
| 会话轮询上下文 | `lib/request-customer-context.ts`、`lib/use-customer-context-poll.ts` |
| 看板 → 菜单链接 | `lib/staff-routes.ts` → `waiterMenuHref` |
| 看板回跳路径（契约） | `lib/staff-routes.ts` → `waiterTableHref`、`resolveWaiterMenuReturnHref` |
| 开台前置（另一管道） | [`buffet-open-table.zh.md`](buffet-open-table.zh.md) |

---

## 扩展新规则时

- **新的加菜前置条件**：只改 ⑥⑦（例如时段菜单），或 `guestOrderingEnabled`；**不要**新开第二条写单 API。
- **新的鉴权角色**：只改 `openTableAuthFromRequest` / `OPEN_TABLE_AUTHORIZED_STAFF_ROLES`。
- **新的回跳来源**：在 `resolveWaiterMenuReturnHref` 增加允许前缀；**不要**在 `MenuPage` 硬编码路径。
- **合并语义变化**（例如按批次拆单）：只改 ⑨ 写单策略，保持 append 单出口。
