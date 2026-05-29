# 餐厅桌位模型设计（定稿）

> 状态：**已定稿，待实施**  
> 环境：开发阶段，**不兼容**旧 `table_number` / `restaurants.table_numbers` 数据；实施前可清空订单相关业务数据。  
> **实施进度：** [`restaurant-tables-implementation-progress.md`](./restaurant-tables-implementation-progress.md)

---

## 1. 要解决的问题

当前实现把 **一串文本标签**（`restaurants.table_numbers` + 各表的 `table_number` 字段）同时当作：

- 稳定身份（QR 参数、session/order 关联）
- 界面与小票上的「桌号」显示

因此 **改显示名 = 改 ID**，必须全库 `rename_restaurant_table_number`，QR 失效，且易出现结账请求、打印队列等不同步。

**目标原则：**

- **桌位身份**（`table_id`）与 **显示名**（`display_name`）分离。
- 改显示名 **只改一行配置**，不迁移历史订单、不重打 QR（QR 绑 `table_id`）。

---

## 2. 定稿数据模型

### 2.1 新表 `restaurant_tables`

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | `uuid` PK | **永久稳定**；QR、API、所有 FK 均指向此字段 |
| `restaurant_id` | `uuid` FK | 所属餐厅 |
| `display_name` | `text` | 展示用名称（默认 `A-01`、`A-02`…），**可随时修改** |
| `sort_order` | `int` | 设置页列表顺序、批量打印 QR 顺序 |
| `deleted_at` | `timestamptz` | 可空；**软删**标记，非空表示已停用 |
| `created_at` | `timestamptz` | 创建时间 |

**约束：**

- `(restaurant_id, display_name)` **UNIQUE**，且仅对 **`deleted_at IS NULL`** 的行生效（部分唯一索引）。已软删桌位释放名称，可复用同一 display_name 给新桌（新 UUID）。
- 单店 **活跃** 桌位数上限：**200**（与现 `RESTAURANT_TABLE_LIST_MAX` 一致；含 `deleted_at IS NULL` 的行）。
- `display_name` 校验：1–16 位，字母/数字开头，可含 `-`、`_`（沿用现有标签规则）。

**默认命名规则（新店与加桌）：**

- 新店种子、以及「增加桌位」时，默认 `display_name` 为 **`A-01`、`A-02`、…** 按 `sort_order` 递增。
- 追加新桌时：取当前活跃桌中符合 `A-\d+` 的最大序号 +1；若无匹配则从新序号 `A-01` 起（实施时在 helper 中统一实现，避免 UI 与 seed 各写一套）。

### 2.2  deliberately 不引入的字段

| 不采用 | 原因 |
|--------|------|
| 单独的 `code` | 与 `id` 职责重复；UUID 已足够作稳定身份 |
| `restaurants.table_numbers` 数组 | 由 `restaurant_tables` 行集合替代 |

### 2.3 业务表关联方式

| 表 / 载荷 | 改造 |
|-----------|------|
| `table_sessions` | `table_id` FK → `restaurant_tables`；去掉 `table_number` |
| `orders` | `table_id` FK；**`display_name` 快照**（下单时写入，历史订单/小票不随改名变化） |
| `bill_splits` | `table_id` FK；**`display_name` 快照** |
| `print_jobs.payload` | 入队时写入 **`table_id` + `display_name`（快照）**；热敏纸只打显示名 |
| 删除 RPC | **`rename_restaurant_table_number` 整段移除** |

**展示规则：**

- 看板、后台、小票、顾客端 UI：**优先用快照或 join 后的 `display_name`**。
- 路由、鉴权、转台/并台/关台、session 查询：**只用 `table_id`**。

### 2.4 数据库约束与索引（补充）

| 项 | 定稿 |
|----|------|
| 活跃餐次唯一 | 将现有 `uniq_active_table_session ON (restaurant_id, table_number) WHERE status IN ('open','billing')` **改为** `(restaurant_id, table_id)` |
| `table_sessions.table_id` | 新餐次 **NOT NULL**（开发期 truncate 后无历史负担） |
| 历史 FK | `orders.table_id`、`table_sessions.table_id` → `restaurant_tables.id` 使用 **RESTRICT**（禁止硬删有历史的桌位；配合软删） |
| 订单查询索引 | 评估保留 `(restaurant_id, table_id)` 或 `(session_id)` 为主路径；账单页以 `session_id` 为准 |

### 2.5 新店种子（Trigger）

与 `print_stations` 类似，在 **`restaurants` INSERT 后** 自动插入默认桌位行：

- 默认 **10** 行，`display_name` 为 `A-01` … `A-10`，`sort_order` 1…10。
- **`admin/create-restaurant` API** 与 **`supabase/seed.sql`** 须与 trigger 行为一致（避免双插或漏插）。
- 若 trigger 已负责 seed，API 侧仅依赖 DB，不再写 `table_numbers` 数组。

---

## 3. URL 与 QR

- 顾客点餐：`/{slug}/menu?table_id={uuid}`
- 账单页等同理，参数名为 **`table_id`**（不再使用 `table=字符串`）。
- 服务员桌位详情：`/{slug}/waiter/[tableId]`（路径段为 UUID）。
- QR 内容：**仅含 `table_id`**；打印卡片标题与副文案使用 **`display_name`**（客人不看到 UUID）。
- QR 失效场景：**软删桌**（`deleted_at` 非空）、换 slug 等；**改 display_name 不影响 QR**。
- 扫已软删桌的 QR：API 返回明确错误（如 `table_not_available`），引导联系服务员。

---

## 4. 桌位管理（设置页）行为

### 4.1 增加桌位

- 支持 **动态增加**（「添加一桌」或数量控件 **仅允许增大**）。
- 调高时在列表 **末尾追加** 新行，默认 `display_name` 按 **2.1 节 A-xx 规则** 生成。
- **禁止**通过把总数量从 20 调为 15 一次删掉末尾多桌（取消现有 `resizeTableNumbersList` 的缩小逻辑）。

### 4.2 删除（停用）桌位

- **不硬删** `restaurant_tables` 行；采用 **软删**（设置 `deleted_at = now()`）。
- **只能逐桌操作**（每行独立「删除/停用」按钮）。
- 仅当该桌 **无 `open` / `billing` 餐次** 时可停用；否则提示先转台、结账或关台。
- **必须经用户确认** 后才执行停用，交互与项目内其它删除一致：
  - 使用 **`Modal`**（与 `PrintStationsManager`、`BuffetSettingsManager` 相同模式）；
  - 标题：`confirmDeleteTitle`（i18n）；
  - 正文：说明将停用桌位 `{display_name}`、QR 将失效、**操作不可撤销**（软删后该 UUID 永久不可用，仅名称可给新桌复用）；
  - 按钮：取消（outline）+ 确认（`variant="danger"`）。
- 停用后：设置页列表 **不再展示**（或收入「已停用」折叠区，本阶段可只做隐藏）；历史 `orders` / `table_sessions` 仍通过 FK 关联原行。

### 4.3 修改显示名

- 只更新 `restaurant_tables.display_name`（须满足 **店内唯一**）。
- **不**更新已有 `orders` / `bill_splits` 上的快照。
- **不**触发全库 rename。

### 4.4 排序

- `sort_order` 可随列表拖拽或索引调整；与「身份」无关。

### 4.5 设置页内的转台 / 并台

- 老板端 `TablesManager` 内转台、并台 UI 现用字符串桌号选来源/目标；改为 **`table_id` 提交**，界面展示 **`display_name`**。
- RPC 签名见第 6 节与 [转台与并台](./table-transfer-merge-plan.zh.md)。

---

## 5. 数据迁移策略

**保留历史数据。** Migration 从 `restaurants.table_numbers` 与各业务表的 `table_number` backfill 到 `restaurant_tables` 及 `table_id` / `display_name` 快照列；若 backfill 后仍有无法映射的桌号，migration 会 **失败** 而非静默丢数。

**开发环境可选清空：** 手动运行 `scripts/dev-wipe-order-data.sql`（**禁止** 写入 migration 或在生产执行），会 truncate：

- `print_jobs`
- `dish_feedback` / `feedback_sessions`（若存在）
- `bill_splits`
- `orders`
- `table_sessions`

**保留：** `restaurants`、`menu_*`、`print_stations`、`restaurant_staff`、`print_agent_*` 等配置。

**种子 / 迁移：**

- 为每家已有餐厅插入默认 N 行 `restaurant_tables`（如 10 行，`A-01`…`A-10`）。
- Drop `restaurants.table_numbers` 列及 **`rename_restaurant_table_number` RPC**。

---

## 6. 必须联动改造的功能清单

实施时需全链路替换，避免残留读 `table_number` 字符串：

| 域 | 要点 |
|----|------|
| 顾客扫码点餐 | 解析 `table_id`；校验属于当前餐厅、行存在且 **`deleted_at IS NULL`** |
| 开台 / 加单 `orders/append` | session 按 `table_id` 创建与查询；地理围栏逻辑不变 |
| 厨房 / 服务员看板 | **聚合键改为 `table_id`**，展示 `display_name`；空桌列表来自活跃 `restaurant_tables` ∪ 有活跃 session 的桌 |
| 转台 / 并台 RPC | 参数 `from_table_id` / `to_table_id`；更新 `orders`/`bill_splits`/`sessions` 的 `table_id`；并台时刷新相关 **display 快照**（可选：仅新单快照，并台迁移单写目标桌当时 display_name） |
| 关台 | 服务员 / 老板后台均按 `table_id`；夜间 `closeAllOpenBillingSessions` 不受影响 |
| 账单 / 分单 / 确认收款 | `bill_splits.table_id`；打印与 UI 用快照显示名 |
| 并台后顾客 URL | `bill/page.tsx` 等在 merge 后 redirect 改为 `table_id=` 目标桌，不再改字符串桌号 |
| 账单查单 | 有 `session_id` 时 **以 session 为准**，可去掉对 table 字符串的冗余 filter |
| 打印 agent | payload **`table_id` + `display_name`**；纸面 **只印 display_name** |
| 出品联 `station_ticket` | payload 同上；厨房联只印 display_name |
| 后台活跃订单、结账请求 | 显示名 + 内部 `table_id`；`fetchCheckoutRequestedTables` 用 `table_id` 匹配看板卡片 |
| `TablesManager` UI | CRUD + 软删确认 Modal；规则见第 4 节 |
| 自助餐 API | `staff/waiter/buffet` 按 `table_id` 找 session |
| Demo / 测试 / i18n | `?table_id=`、`/demo/waiter/[tableId]`；去掉字符串桌号心智 |
| TypeScript 类型 | 移除 `Restaurant.table_numbers`、`Order.table_number` 等，新增 `RestaurantTable` |
| `restaurant-table-numbers.ts` | **整模块替换** 为 `restaurant-tables.ts`（`parseTableId`、`listActiveTables` 等），避免半改半留 |

**Go print-agent：** JSON 同时接受 `table_id`（日志/排障）与 `display_name`（打印）；**禁止**把 UUID 印到顾客小票或出品联。

---

## 7. 公开读模型与 RLS

### 7.1 移除 `restaurants_public.table_numbers`

现 view 暴露 `table_numbers` 数组，服务员/厨房页依赖它列桌（如 `waiter/page.tsx` `select('table_numbers')`）。

**改造：**

- 从 `restaurants_public` **去掉** `table_numbers` 列。
- 前端改为查询 **`restaurant_tables`**（或封装 API）获取 `id, display_name, sort_order`。

### 7.2 `restaurant_tables` RLS

| 角色 | 权限 |
|------|------|
| 店主 / staff | 本店 select；insert/update（含软删写 `deleted_at`） |
| `anon` / 顾客 | 仅 **SELECT** 本店 **`deleted_at IS NULL`** 行的 `id, display_name, sort_order`（用于 QR 校验、看板空桌列） |
| 写 | 顾客 **不可** insert/update/delete 桌位 |

### 7.3 鉴权要点

凡顾客 API（`orders/append`、menu、bill、预结单 `order-receipt/print` 等）必须验证：

1. `table_id` 格式合法；
2. 该行 `restaurant_id` 与 URL `slug` 解析出的餐厅一致；
3. **`deleted_at IS NULL`**。

预结单 guest 鉴权：由 **`session_id + table_id`** 对齐（session 已含 `table_id`），替代现 `session_id + table_number`。

---

## 8. 打印载荷：`table_id` + `display_name`（已定稿）

**采用方案：** 入队时 **必须成对写入** `table_id` 与 `display_name` 快照。

| 用途 | 字段 |
|------|------|
| 热敏纸、顾客/厨房可见 | **`display_name`  only** |
| 日志、Sentry、队列后台筛选、历史重打关联 | **`table_id`** |
| 业务身份对齐 | 与 `orders.table_id` 同一套 UUID |

**规则：**

- **禁止** agent 或 Web 模板把 UUID 印到小票 / 出品联 / 预结单。
- **禁止** 仅写 `table_id` 不写 `display_name`；重打不得 live join 补名。
- **不**兼容旧 `payload.table_number`；与桌位 migration、print-agent **同步发版**。
- `print_jobs` 列表展示列取自 **`display_name`**；可选 **`table_id`** 列便于排障。

### 8.1 收益 / 代价 / 风险（摘要）

| 点 | 说明 |
|----|------|
| 排障 | 日志、Sentry、队列后台可按稳定 id 关联，不受改名影响 |
| 重打 | 历史 `print_jobs` 可区分「哪一桌的任务」，即使 display 已改 |
| 多店 / 多 agent | 未来按 id 过滤、对账更清晰 |
| 与业务一致 | 与 `orders.table_id` 同一套身份 |

### 8.2 代价

| 点 | 说明 |
|----|------|
| 载荷体积 | 每 job 多 ~36 字节 UUID，可忽略 |
| Agent 改动 | Go struct 增加 `TableID` 字段；**打印路径仍只读 `display_name`** |
| `print_jobs` 表 | 生成列现从 `payload.table_number` 提取；需改为从 **`display_name`** 生成展示列（或列名改为 `table_display`），另可选加 **`table_id`** 列便于后台筛选 |
| 双字段维护 | 入队逻辑须保证 **成对写入**，单测覆盖 |

### 8.3 风险与缓解

| 风险 | 缓解 |
|------|------|
| 小票误印 UUID | Agent 与 Web 约定：**纸面字段仅 `display_name`**；代码 review + 打印单测 |
| 仅有 `table_id` 无快照时重打名称错误 | **强制**入队时写 display 快照；不以 live join 补打历史任务 |
| 旧 agent 不识别新字段 | 本阶段不兼容旧 payload；agent 与 Web 同步发版 |
| 日志泄露 UUID | 可接受；非 PII，且仅运维可见 |

**结论（已定）：** 成对写入；纸面永不印 UUID。详见 [`print-agent-plan.md`](./print-agent-plan.md) **已确认 · 桌位字段**。

---

## 9. 历史订单上的显示名

- **新订单 / 新账单 / 新打印任务**：写入当时 `display_name` **快照**。
- **已存在数据**：开发阶段清空，无迁移负担。
- 改显示名后：**新单**用新名；**旧单**仍显示快照（与纸质小票一致）。

---

## 10. 完整影响面补充（实施对照）

以下为上轮评审条目，全部纳入本设计。

### 10.1 数据与约束

- [x] 删桌：**软删 + 确认 Modal**（§4.2），FK RESTRICT 保留历史（§2.4）
- [x] 活跃 session 唯一索引换 **`(restaurant_id, table_id)`**（§2.4）
- [x] 新店 **`restaurants` INSERT trigger** seed 桌位（§2.5）
- [x] **`display_name` 店内唯一**；默认 **A-01 递增**（§2.1）

### 10.2 公开读与 RLS

- [x] `restaurants_public` 去 `table_numbers`（§7.1）
- [x] `restaurant_tables` anon 只读活跃行（§7.2）
- [x] slug + `table_id` 归属校验（§7.3）

### 10.3 并台 / 账单

- [x] merge 后 redirect **`table_id=`**（§6）
- [x] `bill_splits` 更新 **`table_id`** + 快照策略（§6）
- [x] 查单优先 **`session_id`**（§6）

### 10.4 看板聚合

- [x] 厨房 `KitchenDisplay`：`byTable` key 改为 **`table_id`**
- [x] 服务员 `WaiterDisplay`：`buildWaiterTableCard` 按 **`table_id`** filter
- [x] 空桌：`restaurant_tables` 活跃行 ∪ session 桌
- [x] 结账请求高亮：`bill_splits.table_id`（§6）

### 10.5 打印

- [x] `station_ticket` + 结账单 payload（§6、§8）
- [x] `print_jobs` 生成列 / 队列 UI（§8.2）
- [x] print-agent 字段与测试（§6）

### 10.6 路由与 Demo

- [x] `/menu?table_id=`、`/bill?table_id=`、`/waiter/[tableId]`
- [x] `/demo/menu`、`/demo/waiter/[tableId]`
- [x] 服务员代点 `from=waiter&return=` 链路

### 10.7 模块与类型

- [x] 替换 `restaurant-table-numbers.ts`（§6）
- [x] `types/index.ts` 等（§6）
- [x] Dashboard 各页 `select('table_numbers')` → `restaurant_tables`

### 10.8 其它 API

- [x] 自助餐 `staff/waiter/buffet`（§6）
- [x] 预结单 guest 鉴权（§7.3）
- [x] 夜间自动关台：无变更（§6）

### 10.9 文档与测试

- [x] 转并台方案三文档已修订（`table-transfer-merge-plan.zh.md` / `.md`、`table-transfer-merge-acceptance.md`）
- [x] `README.md`、`research.md`、打印方案（`print-agent-plan.md`、`receipt-printing-research.md`、`apps/print-agent/README.md`）已对齐 **`table_id` + `display_name` payload**
- [x] print-agent `escpos_*_test.go` payload 字段
- [x] 验收：改 display 不重打 QR、软删后 QR 失效、并台 redirect、店内重名拒绝、删桌确认 Modal

### 10.10 设置页 UX

- [x] 数量控件仅增大；删桌独立按钮 + **统一确认 Modal**（§4.1、§4.2）
- [x] QR 打印页标题用 **display_name**（§3）
- [x] 老板端转并台用 **table_id**（§4.5）

---

## 11. 明确不做的事（本阶段）

- 不兼容旧 QR（`?table=1`）与旧 `table_numbers` 数组。
- 不保留 `rename_restaurant_table_number`。
- 不引入与 UUID 并行的 `code` 字段。
- 不做「通过减少总数量批量删桌」。
- **不硬删** 有历史关联的桌位行（仅软删）。

---

## 12. 与现有文档的关系

- 转台 / 并台 / 关台 **业务流程不变**，标识从 `table_number` 改为 `table_id`；已同步修订：
  - [table-transfer-merge-plan.zh.md](./table-transfer-merge-plan.zh.md)（RPC 签名、`display_name` 快照、顾客 redirect）
  - [table-transfer-merge-plan.md](./table-transfer-merge-plan.md)（英文版）
  - [table-transfer-merge-acceptance.md](./table-transfer-merge-acceptance.md)（验收用例）
- 本文取代此前关于「文本桌号即身份」的任何口头约定。

---

## 13. 实施顺序建议（供开发参考）

1. **Migration**：`restaurant_tables`（含 `deleted_at`、部分唯一索引）+ 业务表 `table_id` / 快照列；truncate 业务数据；drop 旧列与 rename RPC；**`uniq_active_table_session` 换键**；**新店 seed trigger**。
2. **RLS** + **`restaurants_public` 去 `table_numbers`**。
3. **后端 RPC**（转台 / 并台 / 关台）与 **`restaurant-tables` 工具库**。
4. **API**（append、menu、bill、receipt、buffet、预结单鉴权）。
5. **前端**：TablesManager（含软删确认 Modal）、看板聚合 refactor、BillPage merge redirect、Dashboard 筛选。
6. **打印**：Web 入队双字段 + `print_jobs` 列 + **print-agent** 同步发版。
7. **Demo / seed / admin create-restaurant** 对齐 **A-01** 规则。
8. **文档与验收清单**（§10.9）。

---

**版本：** 2026-05-26 定稿 v3（§8 打印双字段 **已定稿采用**；全项目文档已对齐）
