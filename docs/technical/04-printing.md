# 打印

> **状态**：阶段 5 已填充（2026-06-30）  
> **读者**：开发、AI 代理

## 用途

后厨联、账单/小票、失败处理、重打策略，以及与订单/会话状态的关系。

**策略决策**：[`../decisions/ADR-003-printing-strategy.md`](../decisions/ADR-003-printing-strategy.md)  
**全链路细节**：[`../print-agent-flow.zh.md`](../print-agent-flow.zh.md)

---

## 1. 架构概览

```text
Web 入队（service role）
  → print_jobs (pending)
  → print-agent 轮询 GET /api/print-agent/pending-jobs
  → claim / processing
  → ESC/POS（TCP LAN 或 Windows WinSpool）
  → PATCH /api/print-agent/jobs/[id] → done | failed
```

- **主路径**：`print_jobs` + 本地代理  
- **兜底**：无代理时 Dashboard `TablesManager` 等 `window.print()` HTML  
- **三处实现**：`apps/web` 入队、`packages/shared` JWT/吊销、`apps/print-agent` 出纸

---

## 2. 后厨打印（出品联）

| 项 | 值 |
|----|-----|
| `print_jobs.type` | `station_ticket` |
| 入队 | `lib/station-ticket-enqueue.ts` |
| 触发 | `orders/append` 成功后 `autoEnqueueStationTicketsAfterSubmit` |
| 路由 | 菜品/分类 `print_station_id` → `print_stations` → 代理 `routing_snapshot` |
| payload | 桌 `display_name`、档口名、`item_code` + `item_name`（`{编号}-{菜名}`）、数量、备注；可选 `station_slip_options.show_category_group` + `category_group_header` |
| 配置 | `restaurants.print_agent_config.station_slip_show_category_group`（默认关；功能管理 UI） |

**不受** `bill_receipt_print` 功能开关影响。

---

## 3. 账单 / 订单小票

### 3.1 任务类型

| `print_jobs.type` | `receipt_variant`（payload） | 场景 |
|-------------------|------------------------------|------|
| `pre_bill` | `pre_bill` | 自动预结单 |
| `order_receipt` | `split_payment` | 单人收款小票 |
| `order_receipt` | `final` | 整桌收讫小票 |
| `order_receipt` | `checkout_bill` | **手动**「打印账单」 |
| `order_receipt` | （连接测试） | 向导/试打 |

入队逻辑：`lib/order-receipt-enqueue.ts`；确认收款后由 `checkout-confirm-payment.ts` 触发 `split_payment` / `final`。

- 菜品行标签与出品联一致：`{item_code}-{菜名}`（**不含** `category_code_path`）；同类菜合并后数量累加，**不印备注**。
- 纸面菜品行字体与出品联菜单区同为 1×2；表头/费用/时间戳保持 1×1。

### 3.2 功能开关

`restaurants.feature_flags.bill_receipt_print`（默认 **关**）：

- **关闭**：跳过 `pre_bill`、`split_payment`、`final` 自动入队  
- **不跳过**：`checkout_bill` 手动打印、`station_ticket`

### 3.3 纸面语言

`restaurants.print_locale`（默认 `pt`）；编码见 `apps/print-agent/escpos*.go`。

---

## 4. 打印代理生命周期

| 步骤 | API / 行为 |
|------|------------|
| 1. 配对 | Dashboard `POST /api/print-agent/pairing` → 六位码 |
| 2. Claim | 代理 `POST /api/print-agent/claim` → `print_agent_devices` + JWT；**换店**时同一 `device_id` **转移**到新 `restaurant_id`（旧 JWT 失效），Agent 清空本地档口映射 |
| 3. 轮询 | `GET /api/print-agent/pending-jobs`（scoped `restaurant_id`） |
| 4. 执行 | 本地 `preparePrint` → Write → `PATCH jobs/[id]` |
| 5. 心跳 | `POST /api/print-agent/heartbeat`（版本、映射档口数、最近打印） |
| 6. 吊销 | `revoked_at` 写入 → JWT/RLS 应拒绝（**P0 端到端验收**） |
| 7. 到期 | `valid_until`（默认 30 天 TTL，可配置） |

凭证 TTL：`packages/shared/print-agent-credential-ttl.ts`。

---

## 5. 失败处理与重试

| 机制 | 说明 |
|------|------|
| 状态 | `pending` → `processing` → `done` \| `failed` |
| 错误信息 | `print_jobs.error_message` |
| Dashboard 重试 | `POST /api/print-agent/print-jobs/[id]/retry` |
| 任务过期 | `lib/expire-stale-print-jobs.ts`（约 20 分钟） |
| WinSpool 误报 | **禁止**用 `PRINTER_STATUS_OFFLINE` 预检挡打（见 print-agent-flow §1） |
| IO 失败 | 记 `failed`；代理侧重试策略见 Go `printer_io_errors.go` |

---

## 6. 重打支持现状

| 能力 | 状态 |
|------|------|
| 失败任务 Dashboard 重试 | ✅ |
| 结账页手动「打印账单」 | ✅ `checkout_bill` |
| 全单/按档口 selective 重打 UI | ❌ P2（`development-backlog`） |
| 加菜后自动重打已 void 厨房联 | ❌ 未实现 |

---

## 7. 打印状态与订单状态的关系

| 规则 | 说明 |
|------|------|
| **打印不驱动订单** | `done`/`failed` 不改 `orders.status` 或 `item_status` |
| **订单驱动打印** | 加菜 → 出品联；收款 → 小票（若开关开） |
| **void 不退打** | 退菜不自动作废已打厨房联（现场以纸为准） |
| **会话无关** | `print_jobs` 不绑定 `table_sessions.status` 流转 |

---

## 8. 租户隔离与安全

| 项 | 要求 |
|----|------|
| `print_jobs` 列表 | 必须 `restaurant_id` 过滤（`print-jobs-scope.ts`） |
| Agent JWT | 仅本店任务；`claimed_by` 标识设备 |
| 配对 | 限流；claim 只信服务端 `restaurant_id` |
| 吊销 | `revoked_at` 后 REST + Realtime 均拒绝 |
| payload | 大小限制；不含 service key |

---

## 9. 当前风险点

| 优先级 | 风险 |
|--------|------|
| P0 | 吊销后 JWT/RLS 端到端未验收 |
| P0 | 实机 ESC/POS 编码（zh/pt/en）未定稿 |
| P1 | `order_receipt`/`pre_bill` 模板与生产路径对齐 |
| P1 | 无代理时 HTML 与 `print_jobs` 双路径运维混淆 |
| P2 | Web/shared/Go 路由变更不同步 |
| P2 | USB WinSpool「假在线」导致误标 done（见 flow 文档案例） |

---

## 10. 关键代码索引

| 职责 | 路径 |
|------|------|
| 出品联入队 | `apps/web/src/lib/station-ticket-enqueue.ts` |
| 账单入队 | `apps/web/src/lib/order-receipt-enqueue.ts` |
| 功能门控 | `apps/web/src/lib/restaurant-features.ts` |
| Web API | `apps/web/src/app/api/print-agent/*` |
| JWT | `packages/shared/src/print-agent-jwt.ts` |
| 代理轮询 | `apps/print-agent/agent_poll.go` |
| ESC/POS | `apps/print-agent/escpos.go`、`escpos_encoding.go` |
| 发布 | `docs/ci-and-release.zh.md`、`apps/print-agent/VERSION` |

---

## 相关文档

- [`03-api-contracts.md`](./03-api-contracts.md)
- [`../print-agent-plan.md`](../print-agent-plan.md)
- [`../print-agent-flow.zh.md`](../print-agent-flow.zh.md)
