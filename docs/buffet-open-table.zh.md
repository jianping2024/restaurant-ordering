# 自助餐开台：实现契约（单管道）

## 目的

开台（服务员录入 `buffet_base` 人头费）是**加菜前置步骤**。实现须 **简洁、安全、高效**：一条管道、一个出口，禁止按「修 bug 顺序」叠分支。

产品规则见 [`buffet-pricing-design.zh.md`](buffet-pricing-design.zh.md) §2；计价 RPC 见同文档 §4。加菜管道见 [`menu-order-append.zh.md`](menu-order-append.zh.md)。

---

## 业务规则（锁定）

1. **开台优先**：未开台（无 active `buffet_base`）时，客人与服务员均不可加菜（`guestOrderingEnabled` / `orders/append`）。加菜管道见 [`menu-order-append.zh.md`](menu-order-append.zh.md)。
2. **改人数**：仅更新自助餐行与金额；**不得**改动已有 `menu` 行或厨房状态（`planBuffetOpenWrites`）。
3. **多套餐**：一桌可同时存在多个 `buffet_id` 的 active `buffet_base` 行；每次提交为 **整桌套餐快照**（`buffets[]`）。
4. **全 0 忽略**：某套餐成人/儿童均为 0 → 不写该行（有则 void）。
5. **无变化 = no-op**：当前快照与请求快照一致 → **不计价、不写库**；返回当前桌台详情即可。

示例：`简单套餐 A2 C1` + `豪华套餐 A1 C0` 与只改其中一行，都必须按套餐分别比较与写入。

---

## 唯一管道（服务端）

`POST /api/restaurants/[slug]/staff/waiter/buffet` 请求体：

```json
{
  "table_id": "...",
  "buffets": [
    { "buffet_id": "...", "adult_count": 2, "child_count": 1 }
  ]
}
```

```
① 读   并行：桌台、自助餐定义、已有 session
         → ensure session（open）
         → 拉 session 内 orders 一次
         → mapToBuffetSessionOrders（只映射一次，全程复用）

② 判   isBuffetSnapshotUnchanged(sessionOrders, targetSnapshot)
         true  → 跳到 ④（unchanged: true）
         false → 继续 ③

③ 写   diffBuffetSnapshots → 对每个 upsert 的 buffet_id：
         resolve_buffet_prices → buildBuffetBaseLine
         → planBuffetOpenWrites（lines + voidBuffetIds）→ applyBuffetOpenToSession

④ 返   buildActiveWaiterTablePageModel
         → { ok: true, model, unchanged?: true }
```

**禁止**

- 在 ② 为 true 时调用 `resolve_buffet_prices` 或 `applyBuffetOpenToSession`
- 在 ④ 再次全量 `loadWaiterTablePageModel`（重复读 table/session/orders/价格）
- 对同一批 session orders 多次 `mapToBuffetSessionOrders`

---

## 客户端（服务员桌台）

### 开台条 UI（禁止在布局组件写死）

| 元素 | 判定 | 未开台 | 已开台 |
|------|------|--------|--------|
| 主按钮文案 | `aggregateBuffetForOrders(sessionOrders)` 是否为 null | `buffetConfirm`（**确认开台**） | `buffetSaveGuestCounts`（**保存人数**） |
| 预计合计 | `resolveBuffetOpenPricePreview(resolved, adults, children)` | 有有效单价时显示 `buffetEstimatedTotal` | 同上（随计数实时重算） |

**已开台** = session 内存在 active `buffet_base`（与 `aggregateBuffetForOrders` 一致）。布局重构（如 `WaiterTableBuffetPanel`）须通过 **`buffetActionLabel` prop** 传入文案，**不得**在 `WaiterTableDetailLayout` 内写死「确认开台」或「保存人数」。

1. 点击主按钮前：`isBuffetGuestCountsUnchanged(tableOrders, …)` → 未变则 toast，**不发请求**。
2. 有变化：`applyBuffetOpenOptimisticToOrders` 乐观更新 → `postWaiterBuffetOpenClient` → `applyModel` + `commitAuthoritativeWaiterTablePageModel`；详情 reconcile 会再次 commit；看板 `reconcileWaiterBoardWithPublished` 在 API 确认 session 后才按桌 clear。
3. 失败：回滚乐观状态；409 冲突时 `refresh()`。

判定函数与服务器共用：`isBuffetGuestCountsUnchanged`（`apps/web/src/lib/buffet-order.ts`）。

---

## 代码地图

| 职责 | 模块 |
|------|------|
| 套餐快照 / diff / 汇总 | `buffetSnapshotFromOrders`, `diffBuffetSnapshots`, `aggregateBuffetHeadcountForOrders` |
| 是否已开台 | `hasActiveBuffetForOrders` |
| 预计合计预览 | `resolveBuffetPackagesPricePreview` |
| 写计划（纯函数） | `planBuffetOpenWrites` |
| DB 持久化 | `applyBuffetOpenToSession` |
| 乐观 UI | `applyBuffetOpenOptimisticToOrders` |
| 写后内存投影 | `applyBuffetOpenWritePlanToOrders` |
| 响应组装 | `buildActiveWaiterTablePageModel` |
| 服务端单管道（开台 + 保存人数） | `runBuffetWaiterOpenPipeline` |
| 跨页新鲜度 | `commitAuthoritativeWaiterTablePageModel` / `reconcileWaiterBoardWithPublished` |
| API 路由 | `staff/waiter/buffet/route.ts`（`buffets[]`） |
| Session 创建 | `openTableSessionIfAbsent` |
| 加菜门禁 | `guestOrderingEnabled` + [`menu-order-append.zh.md`](menu-order-append.zh.md) |
| 并台按套餐合并 | `merge_table_sessions`（migration `20260706123000_*`） |

---

## 扩展新规则时

只改 **② 判定**（例如：时段变价是否强制重算），或 `planBuffetOpenWrites` 的写入语义。**不要**新开 API 分支或第二条 detail 拉取路径。
