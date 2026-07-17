# 桌位分组（定稿需求与实施方案）

> **状态：已定稿，待实施**  
> 关联文档：[餐厅桌位模型设计](./restaurant-tables-design.zh.md)  
> 页面入口：`/dashboard/tables`（`TablesManager`）  
> 消费端：桌位管理 QR 卡片 / 打印、楼面看板（`WaiterDisplay`）

---

## 1. 背景与目标

店主需要把桌位按区域组织（如「大厅」「包间」「露台」），便于：

1. **后台**：在桌位管理页维护分组，并把桌位分配到组；
2. **纸质 QR**：打印/预览时，除桌号外展示所属分组名（未分组则不展示）；
3. **楼面看板**：服务员看板按分组分区展示桌位卡片，而不是单一平铺网格。

**原则（与现有桌位模型一致）：**

- 分组是 **配置层** 组织维度，**不改变** `table_id`、QR URL、session/order 关联。
- QR 内容仍为 `/{slug}/menu?table_id={uuid}`；分组名仅出现在 **展示/打印** 层。
- 分组名 **不做** 订单/小票/历史快照（改名即时生效，与 `display_name` 改桌号展示类似，但分组不参与结账链路）。

---

## 2. 已确认产品规则

| 规则 | 定稿 |
|------|------|
| 一桌一组 | **是**。一张活跃桌位同一时间最多属于一个分组。 |
| 未分组桌位 | **允许**。分组为可选。 |
| 分组名称 | 同店 **不可重名**（`restaurant_id + name` 唯一）。 |
| 排序号 | 仅在分组 **列表** 内通过 ↑↓ 调整 `sort_order`；新增/编辑 Modal **不** 单独填排序字段（与 `PrintStationsManager` 一致）。 |
| 员工登录 QR | 留在 Tab「桌位管理」底部；Tab「分组管理」 **不展示**。 |
| QR 展示分组名 | 桌位加入分组后，管理页 QR **卡片** 与 **打印/下载排版** 须显示分组名；未分组则不显示该行。 |
| 楼面看板 | **按分组分区** 展示桌位；组内桌位仍按 `sort_order` 排序；**顶部待结账快捷区**跨组汇总全部待结账桌（§6.0.1） |

**本期不做：**

- QR 编码 URL 携带分组信息；
- 厨房看板按分组展示（仅楼面看板）；
- 订单/小票/打印任务 payload 写入分组快照。

---

## 3. 数据模型

### 3.1 表 `restaurant_table_groups`

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | `uuid` PK | 分组稳定 ID |
| `restaurant_id` | `uuid` FK → `restaurants.id` | 租户隔离 |
| `name` | `text` NOT NULL | 分组名称（同店唯一） |
| `remarks` | `text` NULL | 备注 |
| `sort_order` | `integer` NOT NULL | 列表与楼面看板分区顺序 |
| `created_at` | `timestamptz` NOT NULL | 创建时间 |

**约束：**

- `UNIQUE (restaurant_id, name)`
- `name` 校验：去首尾空格后 1–32 字符（实施时在应用层 + 可选 DB `check` 约束）

### 3.2 表 `restaurant_table_group_members`

| 字段 | 类型 | 说明 |
|------|------|------|
| `group_id` | `uuid` FK → `restaurant_table_groups.id` ON DELETE CASCADE | 所属分组 |
| `table_id` | `uuid` FK → `restaurant_tables.id` ON DELETE CASCADE | 桌位（仅活跃桌可分配） |
| `restaurant_id` | `uuid` FK → `restaurants.id` | 冗余，便于 RLS 与跨表校验 |

**约束：**

- `PRIMARY KEY (group_id, table_id)`
- **`UNIQUE (restaurant_id, table_id)`** — 保证一桌一组
- 触发器或写入 RPC：`table_id` 须属于同一 `restaurant_id` 且 `restaurant_tables.deleted_at IS NULL`

### 3.3 与 `restaurant_tables` 的关系

```
restaurants
  └── restaurant_table_groups (1:N)
        └── restaurant_table_group_members (N:M 经关联表，每桌最多一行)
  └── restaurant_tables (1:N，可 0 行 member)
```

删除分组：CASCADE 删除 `members`，**不** 软删桌位。  
软删桌位：应从 `members` 移除（触发器 `ON DELETE` 或应用层在停用桌时清理）。

### 3.4 RLS（概要）

| 角色 | `restaurant_table_groups` | `restaurant_table_group_members` |
|------|---------------------------|----------------------------------|
| 店主 `authenticated`（`restaurants.owner_id`） | SELECT / INSERT / UPDATE / DELETE 本店 | 同上 |
| 员工 `authenticated`（`restaurant_staff`） | SELECT 本店（楼面看板只读） | SELECT 本店 |
| `anon` | 无 | 无 |

楼面看板 API 当前走 `createAdminClient()` + `staffAuthFromRequest`，与桌位列表一致；RLS 仍须正确，以防未来直查路径。

### 3.5 索引（建议）

- `restaurant_table_groups`: `(restaurant_id, sort_order)`
- `restaurant_table_group_members`: `(restaurant_id, table_id)`（唯一索引已覆盖）
- `restaurant_table_group_members`: `(group_id)`

实施时同步更新 [`docs/ai-schema.md`](./ai-schema.md)。

---

## 4. 后台 UI：`/dashboard/tables`

### 4.1 页面结构

```
┌─ 标题：桌位管理 + 副标题 ─────────────────────────┐
│  [ 桌位管理 ]  [ 分组管理 ]   ← segmented tabs      │
│  （样式：`BuffetSettingsTabs` / `MenuManager`）    │
├────────────────────────────────────────────────────┤
│ Tab「桌位管理」：现有 TablesManager 内容（行为不变） │
│   · 桌号编辑 / 增删 / QR 网格 / 打印全部            │
│   · 员工登录 QR 区块（仅本 Tab）                    │
│ Tab「分组管理」：TableGroupsManager（新）           │
└────────────────────────────────────────────────────┘
```

- URL：`/dashboard/tables?tab=groups` 可选，刷新保持 Tab（与菜单设置 `?tab=` 同模式）。
- Tab1 逻辑 **原样保留**；仅 QR 卡片与打印模板 **增加分组名展示**（见 §5）。

### 4.2 Tab「分组管理」— 列表

| 列 | 内容 |
|----|------|
| 排序 | ↑ / ↓ 交换相邻行 `sort_order`（同档口管理） |
| 名称 | `name` |
| 备注 | `remarks` 截断预览 |
| 桌位 | 已分配数量 + `display_name` 标签（如 `A-01, A-02`） |
| 操作 | 编辑、删除 |

顶部：**「+ 新增分组」**。

删除：使用 `Modal` 确认（与 `PrintStationsManager` 一致）；仅删分组与关联，桌位保留。

### 4.3 Tab「分组管理」— 新增 / 编辑 Modal

| 字段 | 控件 | 规则 |
|------|------|------|
| 名称 | `Input` 必填 | 同店不可重名 |
| 备注 | `Textarea` 可选 | 最长建议 200 字 |
| 分配桌位 | 多选 checkbox 列表 | 列出全部活跃桌（`deleted_at IS NULL`），按 `sort_order` 排序 |

**分配交互：**

- 保存时对该组 **全量替换** `members`（先删该组旧 members，再 insert 新勾选）。
- 若某桌已在 **其他组**，保存时将其从旧组移出并加入当前组（依赖 `UNIQUE (restaurant_id, table_id)`，应用层先删冲突行再插入）。
- 未勾选任何桌位：允许保存空组。

写入路径：优先 **Supabase client 直写**（与 `PrintStationsManager`），RLS 兜底。

---

## 5. QR 展示与打印（Tab「桌位管理」）

### 5.1 展示规则

| 场景 | 有分组 | 无分组 |
|------|--------|--------|
| 管理页 QR 网格卡片 | 桌号下方（或上方副标题）显示 **分组名** | 不显示分组行 |
| 单张/批量打印 HTML | 大字号桌号 **下方** 增加一行分组名（字号小于桌号） | 不增加该行 |
| 下载 PNG / 预览 PNG | 生成完整贴纸：桌号、分组名、餐厅名、**扫码引导文案**；QR 码本体仍由 `qrcode` 生成，URL 不变 | 同左 |

**样式参考（打印模板，在现有 `printTables` 上扩展）：**

```
┌─────────────────┐
│     A-01        │  ← display_name（现有大号）
│     大厅        │  ← group.name（有组显示；无组可落未分组标签）
│   [ QR 图 ]     │
│  餐厅名称        │
│ 扫码开始点餐 ›   │  ← 纸面语言跟 `restaurants.print_locale`
└─────────────────┘
```

分组名来源：服务端加载 `table_id → group_name` 映射（join `members` + `groups`），前端 state 随分组保存后刷新。

### 5.2 不变项

- QR 编码 URL 仍为 `table_id`；
- 改分组名或移动桌位所属组：**不需** 重生成 QR 图数据 URL；
- 贴纸底部引导文案跟随 `restaurants.print_locale`，与 Dashboard 当前界面语言解耦；
- 软删桌位后：从分组移除，QR 失效逻辑不变（现有 `table_not_available`）。

---

## 6. 楼面看板（`WaiterDisplay`）

### 6.0 统计（**保持现逻辑，不变**）

顶栏统计徽章（总桌数 / 空闲 / 用餐中 / 待结账）**不因分组改造而改变**：

- 仍调用 `computeWaiterBoardStats(tables.map(t => t.id), sessionMetaByTableId, checkoutRequestedTableIds)`；
- 口径为 **全店所有活跃桌位** 汇总，**不按组分别统计**，不新增「每组一个小计」；
- 结账待处理摘要文案（`checkoutPendingBoardSummary`）逻辑不变。

分组仅影响 **下方桌位卡片的布局分区**；统计与分组配置无关。

### 6.0.1 待结账桌一眼可见（**已定稿**）

分区后待结账桌不再天然出现在全页最上方，因此 **在统计徽章下方增加「待结账快捷区」**：

- **范围**：跨所有分组汇总，列出当前全部待结账桌（`checkoutRequestedTableIds` + `billing` session 与现 `computeWaiterBoardStats` / 卡片高亮口径一致）；
- **展示**：统计区下方、分组区块 **之上**；横向可换行的一排 **紧凑卡片/芯片**（桌号为主，可选副文案显示所属分组名；未分组不显示组名）；
- **交互**：点击跳转对应桌位详情（与现网格卡片相同 `detailHref`）；
- **样式**：沿用现琥珀色待结账强调（与网格内待结账卡片一致）；
- **与分区关系**：待结账桌 **同时** 出现在本快捷区 **与** 所属分组区内（区内仍置顶 + 高亮）。快捷区解决「一眼扫全店待结账」；分区保留 spatial 上下文。**不在** 分区列表中隐藏这些桌，避免服务员找不到位置。

无待结账桌时，快捷区 **不渲染**（不占位）。

### 6.1 布局

由当前 **单一平铺网格** 改为：**待结账快捷区（§6.0.1）+ 横滑 lane tab（楼面分组 + 同行组）+ 单选内容区**：

```
[ 分组 A ] [ 分组 B ] [ 未分组 ] [ 同行组… ] [+ 创建同行组]  ← 横滑 tab；同行组与楼面同 chrome（选中 brand-gold）；创建在条尾
  ┌──┐ ┌──┐ ┌──┐
  │桌│ │桌│ │桌│   ← 仅展示当前选中 lane 的桌卡
  └──┘ └──┘ └──┘
```

选中 lane 按餐厅持久化（离开桌详情再返回可恢复）；首次默认第一个可见楼面分组。

- 分组区块顺序：`restaurant_table_groups.sort_order` ASC，同序按 `created_at`。
- **空分组**（无成员）：列表仍展示，楼面看板 **不渲染** 该分区（避免空白标题）。
- 组内桌位：`restaurant_tables.sort_order`（沿用 `compareRestaurantTables`）。

### 6.2 卡片排序（组内）

在 **每个分区内部** 保持现有优先级（与当前 `allTableCards` 一致）：

1. 有结账请求的桌置顶；
2. 有订单/自助餐活跃的桌次之；
3. 其余按桌位 `sort_order`。

即：**先按分组分区，再在区内按业务优先级排序**。

### 6.3 数据加载

扩展 `fetchWaiterBoard`（`src/lib/staff-board.ts`）：

- 并行查询 `restaurant_table_groups`（`id, name, sort_order`）与 `restaurant_table_group_members`（`group_id, table_id`）；
- 响应增加：
  - `groups: { id, name, sort_order }[]`
  - `tableGroupByTableId: Record<table_id, { groupId, groupName }>`（或 `table_id → group_id` + groups map）

`useWaiterOrders` / `WaiterDisplay` 消费上述字段渲染分区。  
Realtime：分组变更频率低；首期随现有 board refresh（订单/session 触发）一并拉取即可，无需单独订阅分组表。

### 6.4 Demo 页

`/demo/waiter` 可选传入 mock 分组数据，便于演示分区 UI（非阻塞）。

---

## 7. 类型与模块（实施清单）

| 模块 | 变更 |
|------|------|
| `supabase/migrations/*_restaurant_table_groups.sql` | 建表、约束、RLS、触发器 |
| `docs/ai-schema.md` | 登记新表 |
| `src/lib/restaurant-table-groups.ts` | 类型、`sortTableGroups`、join 辅助 |
| `src/lib/dashboard-tables.ts` | 加载 groups + members |
| `src/app/dashboard/tables/page.tsx` | 传入 `initialGroups` |
| `src/components/dashboard/TablesManager.tsx` | Tab 壳；QR/打印显示组名 |
| `src/components/dashboard/TableGroupsManager.tsx` | 分组 CRUD（新） |
| `src/lib/staff-board.ts` | `fetchWaiterBoard` 返回分组 |
| `src/lib/staff-board-client.ts` | 类型同步 |
| `src/components/waiter/WaiterDisplay.tsx` | 待结账快捷区 + 按组分区渲染 |
| `src/lib/i18n/messages.ts` | `tableGroups` 文案（zh / en / pt） |

**参考实现：** `PrintStationsManager`（列表、Modal、排序、删除确认）。

---

## 8. 边界与错误处理

| 场景 | 行为 |
|------|------|
| 重命名分组 | 立即反映到 QR 卡片与楼面看板标题 |
| 删除分组 | 桌位变为未分组；QR 不再显示组名 |
| 桌位从 A 组改到 B 组 | 保存 B 组时自动从 A 移除 |
| 停用桌位（软删） | 从所有 `members` 移除；分组列表中不再可选 |
| 同店重名分组 | 保存失败，提示「分组名称已存在」 |
| 分组数上限 | 首期不设硬上限；若需可与桌位一样设合理上限（如 50） |

---

## 9. 测试要点

1. **Migration + RLS**：店主可 CRUD 本店分组；他店不可见；`UNIQUE (restaurant_id, table_id)` 一桌一组。
2. **分组管理**：新增 / 编辑 / 删除 / 排序；跨组移动桌位。
3. **QR**：有组显示组名，无组不显示；打印 HTML 含组名行。
4. **楼面看板**：待结账快捷区（跨组）+ 多分区 + 未分组区；区内卡片优先级不变；空组不显示分区；**顶栏统计与现网一致**（全店汇总，不按组）。

---

## 13. 收银员账户（**不受影响**）

对照现网 `dashboard-access.ts`、`middleware.ts`、`staff-routes.ts`、`DashboardNav`：

| 能力 | 收银员 | 说明 |
|------|--------|------|
| 登录后入口 | `/dashboard/checkout` | 仅结账请求页 |
| `/dashboard/tables` 桌位/分组管理 | **不可访问** | middleware 将非 checkout 的 dashboard 路径重定向到 checkout |
| 楼面看板 `/{slug}/waiter` | **不可访问** | 员工路由按角色：`cashier` → `/dashboard/checkout`；`staff/waiter/board` API 要求 `waiter` 角色（店主除外） |
| 结账页数据 | `bill_splits` + `display_name` 快照 | 不读 `restaurant_tables` 分组；分组改名 **不影响** 已产生的结账请求展示 |
| 分组 RLS `staff_select` | 可读但 **无 UI 消费** | 与现 `restaurant_tables_staff_select` 含 cashier 一致；首期无收银员界面读分组，保留 SELECT 无害，亦可仅 waiter/kitchen 以最小权限实施 |

**结论：** 桌位分组功能 **不改变** 收银员账户权限、导航与结账流程；收银员 **无需** 培训或适配。若未来要让收银员看楼面看板，属独立产品决策，不在本期范围。
5. **回归**：Tab1 桌位增删改、QR 生成、员工 QR、活跃 session 禁删桌 — 行为与现网一致。

建议单测：`restaurant-table-groups.ts` 分区构建逻辑（给定 groups + members + tables → section 列表）。

---

## 10. 实施顺序

1. DB migration + `ai-schema.md`
2. `restaurant-table-groups` 工具与 dashboard 数据加载
3. `TablesManager` 双 Tab + `TableGroupsManager`
4. QR 卡片与 `printTables` 组名展示
5. `fetchWaiterBoard` + `WaiterDisplay` 按组展示
6. i18n + 定向 lint / build / 单测

---

## 11. 开放问题（暂无）

当前无未决产品问题。若后续需要 **厨房看板按组** 或 **小票打印分区名**，另开文档扩展。

---

## 12. 审计备忘（实施前必读）

> 对照现网代码（`TablesManager`、`fetchWaiterBoard`、`computeWaiterBoardStats`、`/api/dashboard/tables` DELETE）整理的漏洞与注意事项。

### 12.1 必须落实（数据一致性）

| 项 | 风险 | 建议 |
|----|------|------|
| **软删桌位未清 members** | `restaurant_tables` 为软删（`UPDATE deleted_at`），`ON DELETE CASCADE` **不会**触发；`members` 可能残留，分组列表 join 出已删桌号 | migration 增加触发器：`deleted_at` 从 NULL → 非 NULL 时 `DELETE FROM restaurant_table_group_members WHERE table_id = …`；**并**在 `/api/dashboard/tables` DELETE 路径显式清理（双保险） |
| **跨店 / 跨组写入** | `members` 含冗余 `restaurant_id`，须与 `group`、`table` 一致 | 参考 `enforce_print_station_same_restaurant`，增加 `BEFORE INSERT OR UPDATE` 触发器：校验 `group.restaurant_id = table.restaurant_id = members.restaurant_id`，且 `table.deleted_at IS NULL` |
| **分配保存非原子** | 先删本组 members 再 insert、再处理他组冲突，多步 client 调用可能半成功或竞态 | 首期至少用 **单事务 RPC**（如 `replace_table_group_members(p_group_id, p_table_ids uuid[])`）：校验 → 删冲突 → 替换本组成员；UI 仍可调 RPC |
| **孤儿 member 指向软删桌** | 分组列表「已分配桌位」若 join 不过滤 `deleted_at`，会显示幽灵桌号 | 列表与 Modal 仅 join `deleted_at IS NULL` 的桌；保存时拒绝已删 `table_id` |

### 12.2 RLS 与权限（勿抄 print_stations 公开读）

| 项 | 说明 |
|----|------|
| **禁止 public SELECT** | `print_stations` 有 `print_stations_public_read`（`USING (true)`），分组 **无**顾客端读取场景，应仿 `restaurant_tables`：`owner_all` + `staff_select`（`kitchen` / `waiter` / `cashier`），**不要**对 `anon` 开放 |
| **楼面 API** | 现网 `fetchWaiterBoard` 走 `createAdminClient()`，RLS 仍须正确，避免日后 staff 直查路径泄露他店数据 |

### 12.3 楼面看板行为变化（需产品知情）

| 项 | 现网 | 分组后 | 建议 |
|----|------|--------|------|
| **待结账桌全局置顶** | 全店平铺网格，`allTableCards` **全局**按结账请求 → 活跃 → `sort_order` 排序，待结账桌总在页面最上方 | 分区内置顶；**另增 §6.0.1 顶部待结账快捷区**，跨组汇总全部待结账桌，保证一眼可见 | **已拍板**：采用快捷区 + 分区内双展示 |
| **分组配置刷新延迟** | 看板随订单/session Realtime 刷新 | 店主改分组后，已打开的楼面看板 **可能**直到下次 board refresh 才更新分区 | 可接受则文档保留现状；若要即时，可对 `restaurant_table_groups` / `members` 加 Realtime 或 Tab 可见时轮询 |

### 12.4 后台 UI 联动

| 项 | 说明 |
|----|------|
| **Tab1 ↔ Tab2 状态** | 在 Tab2 改分组后，Tab1 QR 卡片/打印用的 `table_id → group_name` 须 **同页刷新**（父组件 state 或切 Tab 时 refetch），避免仍显示旧组名 |
| **「打印全部」顺序** | 现网按 `tables` 的 `sort_order` 平铺，**不按分组区块**排序 | 与楼面看板布局不一致但可接受；若需一致，打印可按 `group.sort_order` → `table.sort_order` 排序（实施时二选一，建议写入代码注释） |
| **管理页 QR 网格** | 仍按桌位 `sort_order` 平铺，仅在卡片上 **附加**组名 | 与楼面分区布局不同，属预期 |
| **保留组名「未分组」** | 若店主建组名为「未分组」/ `Ungrouped`，会与系统「未分组」区块文案冲突 | 应用层 **保留名列表** 禁止，或系统区块改用不可冲突文案（如「其他桌位」） |

### 12.5 边界与校验（文档 §8 补充）

| 场景 | 注意 |
|------|------|
| 空白组名 | `trim` 后长度 0 拒绝保存 |
| 两店主端同时编辑 | `UNIQUE (restaurant_id, table_id)` 会挡双分配；后保存者需友好错误并 refetch |
| 空分组 | 后台列表展示；楼面不渲染空分区 — **已定义** |
| 新店 | **不** seed 默认分组（与桌位/档口不同），全桌初始为未分组 |
| 转台/并台/订单历史 | 仅用 `table_id` / `display_name`，**不受分组影响**；无需改 RPC |
| 厨房看板 | 本期不按组 — **已定义** |

### 12.6 测试补充（在 §9 之上）

1. 软删桌后：`members` 行消失；分组列表桌数正确。
2. 跨组移动桌：RPC 事务后他组无残留、`UNIQUE` 不报错。
3. 楼面：待结账快捷区展示 **全部** 待结账桌（含非首组）；点击可进详情；分区内仍高亮置顶。
4. Tab2 保存后切 Tab1：组名立即更新。
5. RLS：他店 owner/staff 无法读写分组；`anon` 无法 SELECT。
