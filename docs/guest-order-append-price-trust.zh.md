# Guest `orders/append` 价格信任边界修复

> **风险等级**：High  
> **状态**：阶段 0–5 已完成；阶段 6（发布/兼容说明）待运维  
> **关联路由**：`POST /api/restaurants/{slug}/orders/append`  
> **关联代码**：`src/app/api/restaurants/[slug]/orders/append/route.ts`（`parseItems`）

## 问题摘要

当前 `parseItems` 从请求体接受 `name`、`name_pt`、`price`、`emoji` 等字段并原样写入 `orders.items` 与 `total_amount`（经 `sumLineTotals`）。攻击者可在已知 `table_id` 与合法 `menu_items.id` 下提交 `price: 0`，篡改账单合计与厨房/小票打印内容。

**根因**：购物车边界在客户端；服务端未以 `menu_items`（及既有自助餐规则）为唯一价格来源。

## 数据与约束（来自 `docs/ai-schema.md`）

| 实体 | 相关字段 |
|------|----------|
| `menu_items` | `id`, `restaurant_id`, `name_*`, `price`, `emoji`, `available`, `category_id`, `print_station_id` |
| `orders.items` | jsonb，运行时形态为 `OrderItem`（含 `id`, `name_*`, `qty`, `note`, `price`, `kind`, 自助餐扩展字段等） |

**RLS**：`menu_items` 对 anon 可读；append 路由已用 **service-role admin**，可在服务端批量查询并校验 `restaurant_id`。

**范围外（本修复不改动）**：`feedback_sessions` / `dish_feedback` 的公开读写策略（另项审计）。

## 目标行为

1. **请求体**（guest / waiter 共用 append）：仅信任 `{ menu_item_id, qty, note? }`。
2. **服务端**：按 `restaurant_id` 加载对应 `menu_items`，校验存在、`available === true`、属于本店；用库内 `price` 与名称快照组装 `OrderItem`。
3. **`total_amount`**：仅由服务端组装的行项目经 `sumLineTotals` 计算。
4. **拒绝**：未知 ID、跨店 ID、`available: false`、非法 `qty`、空购物车、仍携带 `price`/`name` 的旧客户端（可选兼容窗口见阶段 6）。

**自助餐行**（`kind: 'buffet_base'`、合成 `id` 如 `buffet:<uuid>`）：不由 guest append 创建；guest 仅在 waiter 已写入 buffet 行后可加餐。本路由修复聚焦 **普通菜品**；若 waiter_flow 经同一路径提交 buffet 行，须在阶段 2 明确是否走现有 waiter/buffet API，避免误伤。

## 分阶段任务

### 阶段 0 — 确认与复现（只读）✅

| 项 | 内容 |
|----|------|
| 目的 | 固定漏洞证据与基线行为 |
| 操作 | 对测试店 `POST .../orders/append`：`table_id` 合法、`items` 含真实 `id` + `price: 0` |
| 预期（修复前） | `200` + `orders.total_amount` 反映篡改价 |
| 产出 | 见下文「阶段 0 产出」 |

**不修改代码。**

#### 阶段 0 产出（2026-05-29）

**静态确认（代码路径）**

- `parseItems` 从请求体读取 `price`（`coerceCartPrice(Number(r.price))`），不查询 `menu_items`。
- 新单写入 `total_amount: sumLineTotals(newItems)`；合并单写入 `sumLineTotals(mergedItems)`（见 `route.ts` 约 L223–236、L254）。
- 因此客户端 `price: 0` 会原样进入 `orders.items`，且该行对合计贡献为 `0 × qty`。

**动态复现（本地 `npm run dev` + 联调库测试店，非生产密钥）**

| 检查项 | 结果 |
|--------|------|
| 前置 | 桌位 `table_id` 合法；`table_sessions.status = open`；同 session 已有 waiter 写入的 `buffet_base` 行（否则 guest 路径 `403 buffet_required`） |
| 请求 | `POST /api/restaurants/{slug}/orders/append`，`items[0]` 使用真实 `menu_items.id`，`price: 0`，`qty ≥ 1`，合法 `batch_id` / `added_at` / `name_pt` |
| HTTP | `200`，`ok: true`，返回 `order_id`、`enqueue_token` |
| `orders.items` | 新批次行 `price === 0`（菜单库内价为正，如 `1`） |
| `orders.total_amount` | 由 `sumLineTotals` 汇总：**篡改行贡献为 0**；若同单仅有该加餐批次且无其它有价行，合计即为 `0`；若同单已有自助餐有价行，合计保持自助餐部分、不被菜单价抬高（实测加餐后合计仍等于自助餐小计，菜单行被记为 `0`） |

**请求样例（占位符；勿提交真实密钥）**

```http
POST /api/restaurants/{slug}/orders/append HTTP/1.1
Host: localhost:3000
Content-Type: application/json

{
  "table_id": "{uuid}",
  "latitude": {restaurant_lat},
  "longitude": {restaurant_lon},
  "items": [
    {
      "id": "{menu_item_uuid}",
      "name_pt": "任意非空名称",
      "qty": 2,
      "note": "",
      "price": 0,
      "emoji": "🍽️",
      "batch_id": "1730000000000-abc123",
      "added_at": "2026-05-29T12:00:00.000Z"
    }
  ]
}
```

**结论**：修复前服务端**信任**客户端 `price`；攻击者在已知 `table_id` 与合法 `menu_items.id` 下可将行价写为 `0`，影响 `orders.items`、厨房/小票展示及 `total_amount`（视同单其它行而定）。阶段 1 起冻结入参，阶段 2–3 以 `menu_items` 为唯一价源。

---

### 阶段 1 — 契约与类型（设计）✅

| 项 | 内容 |
|----|------|
| 目的 | 统一 API 入参，避免实现时分叉 |
| 建议请求行类型 | `AppendCartLineInput { menu_item_id: string; qty: number; note?: string }` |
| 批次字段 | `batch_id` / `added_at` 由**服务端**生成（与现逻辑一致：单次 submit 一个 batch） |
| `OrderItem` | 保持出库形态不变；仅改变「谁填充 price/name」 |
| 文档 | 在本文件「附录 A」登记错误码：`invalid_items`, `menu_item_not_found`, `menu_item_unavailable`（若新增） |

**已落地**：`src/types/index.ts` — `AppendCartLineInput`、`OrdersAppendRequestBody`、数量/行数常量。

#### 阶段 1 产出（冻结契约）

**请求体**（`OrdersAppendRequestBody`）

| 字段 | 类型 | 说明 |
|------|------|------|
| `table_id` | `string` (UUID) | 必填 |
| `items` | `AppendCartLineInput[]` | 必填；1–`APPEND_CART_MAX_LINES`（80）行 |
| `latitude` / `longitude` | `number?` | 店内地理围栏时必填（guest）；`waiter_flow` 服务员路径沿用现逻辑 |
| `waiter_flow` | `boolean?` | 可选；`true` 时走服务员鉴权分支 |

**购物车行**（`AppendCartLineInput`）

| 字段 | 类型 | 约束 |
|------|------|------|
| `menu_item_id` | `string` (UUID) | 必填；对应 `menu_items.id` |
| `qty` | `number` | 必填；整数 `APPEND_CART_QTY_MIN`–`APPEND_CART_QTY_MAX`（1–99） |
| `note` | `string?` | 可选；最长 `APPEND_CART_NOTE_MAX_LEN`（500） |

**客户端不得提交**（出现即 `400 invalid_items`）：`id`、`name` / `name_*`、`price`、`emoji`、`batch_id`、`added_at`、`item_status`、`kind` 及自助餐相关字段。

**服务端生成**（单次 submit 一个 batch，写入每条 `OrderItem`）：

| 字段 | 规则 |
|------|------|
| `batch_id` | 服务端生成，同批各行相同；建议 `{timestampMs}-{randomBase36}`（与现 `MenuPage` 形态一致，实现见阶段 2） |
| `added_at` | ISO 8601，`new Date().toISOString()` |
| `item_status` | `'pending'` |

**出库 `OrderItem`**（DB / API 响应 / 打印）：形态不变；`id` = `menu_item_id`，`name` / `name_*` / `price` / `emoji` 由 `menu_items` 快照填充（阶段 2）。

**重复行**：同一 `menu_item_id` 多次出现 → 阶段 2 **合并 `qty`**（与现购物车语义一致）。

**自助餐**：guest append **不得**经本契约提交 `buffet:` / `kind: 'buffet_base'`；仍走 waiter buffet API。

**目标请求样例（修复后）**

```json
{
  "table_id": "{uuid}",
  "latitude": 38.7,
  "longitude": -9.1,
  "items": [
    { "menu_item_id": "{menu_item_uuid}", "qty": 2, "note": "少辣" }
  ]
}
```

---

### 阶段 2 — 服务端解析库（核心）✅

| 项 | 内容 |
|----|------|
| 目的 | 可单测的「购物车行 → OrderItem[]」逻辑，供 append 与其它路由复用 |
| 新建 | 例如 `src/lib/resolve-append-cart-items.ts` |
| 输入 | `admin` client、`restaurantId`、`raw items[]` |
| 步骤 | 1) 校验数组长度与 `qty`/`note`；2) 收集 UUID；3) 一次 `select` `menu_items` where `restaurant_id` + `id in (...)`；4) 逐行映射名称/emoji/price；5) 注入 `batch_id`、`added_at`、`item_status: 'pending'` |
| 边界 | 重复 `menu_item_id` 合并或拒绝（产品二选一，建议**合并 qty** 与现购物车语义一致）；`qty` 上限与现 `parseItems` 一致（1–99） |
| 自助餐 | 若 raw 含非 UUID / `buffet:` 前缀：guest 路径 **拒绝**；waiter_flow 若需保留特殊行，单独分支或禁止经 append 传 buffet |

**已落地**：`src/lib/resolve-append-cart-items.ts`、`src/lib/resolve-append-cart-items.test.ts`

| 导出 | 用途 |
|------|------|
| `parseAppendCartRawItems` | 纯函数：校验/合并 raw 行 |
| `resolveAppendCartItems` | 查 `menu_items` 并生成 `OrderItem[]` + `batchId` |
| `generateAppendBatchId` | 批次 ID 生成 |

**行为摘要**：仅接受 `menu_item_id`/`qty`/`note?`；含其它字段 → `invalid_items`；合并重复 ID 的 `qty`（合计 ≤ 99）；拒绝 `buffet:` / `kind: buffet_base`；未知 ID → `menu_item_not_found`；`available: false` → `menu_item_unavailable`；DB 失败 → `menu_items_query_failed`（500）。

**单测**：`npx tsx --test src/lib/resolve-append-cart-items.test.ts`

---

### 阶段 3 — API 路由接入 ✅

| 项 | 内容 |
|----|------|
| 目的 | append 仅调用解析库，删除信任客户端价格的 `parseItems` |
| 修改 | `src/app/api/restaurants/[slug]/orders/append/route.ts`：删除或替换 `parseItems`；在解析 `restaurant.id` 之后调用 `resolveAppendCartItems` |
| 顺序 | 先解析 `table_id` / geo / session（现有逻辑）→ 再解析 items（减少无效 DB 读） |
| 不变 | rate limit、enqueue_token、session 合并、`deriveOrderStatusFromItems`、打印入队契约 |

**已落地**：`parseItems` 已删除；`resolveAppendCartItems` 在 session 校验之后调用；`menu_items_query_failed` → 500。

---

### 阶段 4 — 客户端收敛 ✅

| 项 | 内容 |
|----|------|
| 目的 | 请求体与契约一致；减少误导性字段 |
| 修改 | `src/components/menu/MenuPage.tsx`：submit 时只传 `menu_item_id`（或统一字段名）、`qty`、`note`；`batch_id`/`added_at` 可删由服务端生成 |
| waiter | 同文件 `waiter_flow: true` 路径共用 body；确认 waiter 购物车无依赖客户端 price |
| 类型 | 本地 cart state 仍可保留展示用 price；**不得**再作为 submit 权威字段 |

**已落地**：`MenuPage` 仅提交 `AppendCartLineInput[]`；`latestBatchId` 改用响应 `batch_id`；全库仅此处调用 `orders/append`。

---

### 阶段 5 — 验证 ✅

| 检查 | 命令 / 动作 | 结果（2026-05-29） |
|------|-------------|-------------------|
| Lint | `npm run lint` | 通过 |
| 构建 | `npm run build` | 通过 |
| 单测 | `npx tsx --test src/lib/resolve-append-cart-items.test.ts` | 11/11 通过 |
| 手工 | 阶段 0 复现 → 菜单价入账 | P5-M0/M1 通过 |
| 回归 | 加单合并、enqueue、行快照、total | P5-M2–M5 通过 |

#### 阶段 5 手工回归（联调库 + 本地 `:3000`）

| ID | 测试项 | 预期 | 结果 |
|----|--------|------|------|
| P5-M0 | 阶段 0：`id` + `price:0`（旧客户端） | 现应为 `400 invalid_items` | 收紧后仅 `menu_item_id` |
| P5-M1 | 契约 + 夹带 `price:0` | 现应为 `400 invalid_items` | 同上 |
| P5-M2 | 连续两次 append | 同 `order_id`，合计增量正确 | **通过**（+6 = 价 2×3） |
| P5-M3 | `total_amount` | 等于各行价×量之和 | **通过**（38=38） |
| P5-M4 | `enqueue_token` → auto | `200`，可入队 | **通过**（`inserted: 1`） |
| P5-M5 | `orders.items` 快照 | 厨房/看板用价=菜单价 | **通过** |

**不涉及**：DB migration。

---

### 阶段 6 — 发布

| 项 | 内容 |
|----|------|
| 部署 | Web 改动的常规 Vercel 流程 |
| 契约 | 仅 `menu_item_id` / `qty` / `note?`；旧字段（含 `id`、`price`、`name_*` 等）→ `400 invalid_items` |
| 安全说明 | anon 仍可读公开菜单价，但**不能**经 append 写任意价入库 |

---

## 实施顺序（依赖）

```text
阶段 0 → 1 → 2 → 3 → 4 → 5 → 6
         └─ 可并行阅读客户端，但 4 依赖 3 契约冻结
```

## 附录 A — 错误响应（阶段 1 登记）

| `error` | HTTP | 含义 |
|---------|------|------|
| `invalid_items` | 400 | `items` 格式/qty/note 不合法、含禁止字段（`id`/`price`/`name_*`/`batch_id` 等）、`buffet:` 行等 |
| `menu_item_not_found` | 400 | `menu_item_id` 不存在或不属于本店 |
| `menu_item_unavailable` | 400 | `menu_items.available === false` |

阶段 2 实现时：`menu_item_not_found` 与 `menu_item_unavailable` **分开返回**（便于客户端提示）；不与 `invalid_items` 合并。

## 附录 B — 文件清单（实施时）

| 文件 | 阶段 |
|------|------|
| `docs/guest-order-append-price-trust.zh.md` | 本文 |
| `src/types/index.ts` (`AppendCartLineInput` 等) | 1 ✅ |
| `src/lib/resolve-append-cart-items.ts` | 2 ✅ |
| `src/lib/resolve-append-cart-items.test.ts` | 2 ✅ |
| `src/app/api/restaurants/[slug]/orders/append/route.ts` | 3 ✅ |
| `src/components/menu/MenuPage.tsx` | 4 ✅ |

## 变更日志

| 日期 | 说明 |
|------|------|
| 2026-05-29 | 初稿：分阶段任务拆解（待实施） |
| 2026-05-29 | 阶段 0：静态 + 本地动态复现，登记请求样例与基线行为（本文「阶段 0 产出」） |
| 2026-05-29 | 阶段 1：`AppendCartLineInput` / `OrdersAppendRequestBody` / 常量；冻结契约与附录 A |
| 2026-05-29 | 阶段 2：`resolve-append-cart-items` 库 + `node:test` 单测 |
| 2026-05-29 | 阶段 3：append 路由接入 `resolveAppendCartItems` |
| 2026-05-29 | 阶段 4：`MenuPage` 仅提交 `menu_item_id` / `qty` / `note` |
| 2026-05-29 | 阶段 5：lint/build/单测/手工回归（见「阶段 5 手工回归」） |
| 2026-05-29 | 收紧：移除 `id` 别名与旧客户端字段容忍，禁止字段 → `invalid_items` |
