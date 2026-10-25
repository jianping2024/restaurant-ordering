# 本次改动业务场景测试报告：寿司送厨多机不双打出品联

## 本次修改

- **内容**：寿司轮次到点 finalize 时，多台手机 / GET 过期收口共用一个 `append_client_request_id`（条件领取）；出品联 replay 入队时，同 `order_id+batch_id+档口` 已有任意状态 job 则不再插入。
- **文件**：`round-append-intent.ts`、`station-ticket-enqueue-dedupe.ts`、`table-order-round/service.ts`、`station-ticket-enqueue.ts`；契约与 sole 索引同步。
- **角色 / 页面**：顾客寿司菜单送厨；档口出品联（未开后厨自动打 / 开后厨备餐前的订单行）。
- **不动**：备餐入队本身、收费菜即时下单、经典加菜入队。

## 核心业务规则

1. 【本次新增】一轮送厨只有一个 append 意图 id；并发 finalize 不得各造各的 id。
2. 【本次新增】同一 `order_id+batch_id+档口` 最多一张自动出品联（含已 done）；replay 不得因首张已打完再插第二张。
3. 【已实现】开了后厨的档口送厨仍不自动打，备餐才出票。

## 详细测试场景

### 场景 1：两台手机同时到点 finalize — 订单不翻倍

- **前置状态**：同桌 2 台手机都在 pending_confirm，篮内免费菜合计 N 份。
- **操作过程**：倒计时结束，两机几乎同时调 finalize（或一机 timer + 一机 GET settle）。
- **预期结果**：只成功 append 一次；订单该批行份数合计 = N，不出现两套相同行。
- **数据验证**：`table_order_rounds.append_client_request_id` 唯一；`order_append_idempotency` 仅一条 completed。
- **标签**：【已验证】单元（意图 id 领取）+ 【未验证】真机双浏览器并发（云环境无店机打印机）

### 场景 2：首张票已 done 后 replay — 不再打第二张

- **前置状态**：finalize 已写入并入队，job 状态已是 done；另一机仍走 replay 入队。
- **操作过程**：第二机 finalize 命中 idempotent replay → 再调 enqueue。
- **预期结果**：`skipped_duplicates`；不新增同 batch 同档口 job。
- **标签**：【已验证】`stationTicketAlreadyEnqueuedForBatch` 单测（done 也挡）

### 场景 3：开后厨档口 — 送厨不自动打

- **前置状态**：档口 `kitchen_enabled=true`。
- **操作过程**：送厨 finalize 成功。
- **预期结果**：自动入队 inserted=0；备餐后才有一张 prep 票。
- **标签**：【未验证】本环境无后厨大屏实打（行为未改厨房开关分支）

### 场景 4：回归 — 收费菜即时下单仍一单一票

- **前置**：寿司页点收费菜下单。
- **预期**：仍走 client `scheduleMenuOrderPostSubmitEffects`；本改不动该路径。
- **标签**：【未验证】代码路径未改

## 实际测试结果

| 项 | 结果 |
|---|---|
| `round-append-intent.test.ts` | 【已验证】pass（3） |
| `station-ticket-enqueue-dedupe.test.ts` | 【已验证】pass（3） |
| 真机多机并发 + 实打 | 【未验证】云 Agent 无店内代理 |

## 风险与待确认

- 若历史上用「故意再 enqueue 一张」修首张 failed，现改为任意状态都跳过；失败票请走厨显补打 / 重做，不再靠 finalize replay 补第二张自动票。
