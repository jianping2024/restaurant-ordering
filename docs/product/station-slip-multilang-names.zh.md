# 出品联多语菜名勾选（档口小票）

> **状态：定稿**  
> **权威：是**（本需求产品与入队契约）  
> **Agent 纸面契约：** farvoo-fatura `docs/station-slip-print-names.zh.md`  
> **对应实现：** Dashboard `MenuManager` + `menu_items` 三列 + 下单快照（`resolve-append-cart-items`）+ `stationTicketLineNames` → `print_names`  
> **写作规范：** 与仓内 design-doc 习惯一致（一列一行、P0 拍板）

---

## 0. 背景

门店菜品有葡 / 英 / 中三语名。出品联今日按店 `print_locale` **只打一个**名（`menuLocalizedName`）。后厨常需同一菜多语对照（如葡语 + 中文），且不要改结账/预结单。

编辑菜品 UI（Dashboard「编辑菜品」）在葡语 / 英语 / 中文名称旁增加勾选；勾选则该语种名进入档口小票。

---

## 1. 范围

| 做 | 不做 |
|----|------|
| 档口出品联 `station_ticket` 多语菜名 | 预结 / 结账 / 开台小票菜名 |
| 编辑菜品勾选 + 库表 + 下单快照 + 入队 | 客人菜单、厨显标题逻辑 |
| Agent 按 `print_names` 顺序 1×2 出纸 | 类别名同款勾选；自定义语言顺序 |

---

## 2. P0 定法

| # | 定法 |
|---|------|
| 1 | **UI**：葡语名称 / 英语名称 / 中文名称输入框下各一勾选；文案意涵「印上档口小票」。**葡语默认勾选**；英、中默认不勾。**名为空时不可勾** |
| 2 | **存库**（`menu_items`）：见 §3。默认 `station_print_pt=true`，`station_print_en=false`，`station_print_zh=false` |
| 3 | **展开规则**：勾选且对应 `name_*` trim 后非空 → 进入打印列表。勾选但名为空 → **跳过** |
| 4 | **顺序固定**：葡 → 英 → 中（与编辑表单顺序一致；不可拖拽重排） |
| 5 | **全不勾**：回退 `menuLocalizedName(item, print_locale)` 单名（店默认葡语优先 → 即葡语）；禁止无名菜行 |
| 6 | **纸面（每道菜）**：① 第一语言行：`{item_code}-{名}`（有码时）+ **Qty**；② 其余语言行：仅菜名（与 Items 同左边距，**无编号、无 Qty**）；③ `note` 非空才打备注（前缀仍跟店 `print_locale`：`备注: ` / `Note: ` / `Observação: `） |
| 7 | **字号**：①②③ **全部 1×2**：葡语 Font A `GS !`，中文固件汉字 `FS &` + GBK + `FS !`（与现出品联菜单区 `writeBody1x2` 一致；编码见 farvoo-fatura `docs/fiscal-thermal-text-encoding.zh.md`） |
| 8 | **`print_locale`**：票面固定栏（标题、Items/Qty、备注前缀）仍跟店 `print_locale`；**菜名列表由勾选决定**，不再被 `print_locale` 收成单语 |
| 9 | **下单快照**：`orders.items[]`（或等价 order line JSON）写入时快照 `name_pt/en/zh` **与** 三个 `station_print_*`；出品联入队读快照（改菜单不影响已下单/重打） |
| 10 | **入队 payload**：每行带有序 `print_names: string[]`（纯菜名，已 trim、已按勾选展开，**不含** `item_code`）。`item_code` / `qty` / `note` 仍独立字段。缺省或空数组 → Agent 回退现 `item_name` / `display_name` 单行（兼容旧 job） |
| 11 | **结账 / 预结**：**不改**；仍 `orderItemReceiptLineLabel` / 单语 `print_locale` |

---

## 3. Schema（`menu_items` 新增）

| 列 | 类型 | 必填 | 默认 | 说明 |
|----|------|------|------|------|
| station_print_pt | BOOLEAN | 是 | true | 出品联是否打葡语名 |
| station_print_en | BOOLEAN | 是 | false | 出品联是否打英语名 |
| station_print_zh | BOOLEAN | 是 | false | 出品联是否打中文名 |

迁移：`ADD COLUMN … DEFAULT …`；既有行得默认值。DDL 与本文不一致 = 缺陷。

---

## 4. 下单快照字段（order line）

在现有 `name_pt` / `name_en` / `name_zh` / `item_code` / `note` 旁增加（一列一行语义）：

| 字段 | 类型 | 说明 |
|------|------|------|
| station_print_pt | boolean | 下单时从 `menu_items` 拷贝 |
| station_print_en | boolean | 同上 |
| station_print_zh | boolean | 同上 |

缺省（旧订单，三字段都没有）：`print_names = [menuLocalizedName(item, print_locale)]`，与上线前单行完全一致。

---

## 5. 入队：展开 `print_names`

**唯一写法：** `menu-print-label.ts` 的 `stationTicketLineNames`（内部 `orderItemStationPrintNames`）。两个入队入口都只调它、不自己拼菜名：

| 入口 | 触发 |
|------|------|
| `lib/station-ticket-enqueue.ts` | 下单自动出单、`station-tickets/auto`、重做（未开厨显）、寿司轮次 |
| `lib/station-ticket-prep-enqueue.ts` | 厨显备菜 / 重做选行（按桌一张） |

```text
names = []
if station_print_pt && name_pt: append name_pt
if station_print_en && name_en: append name_en
if station_print_zh && name_zh: append name_zh
旧快照（三个 station_print_* 都缺省）或 names 为空: names = [menuLocalizedName(item, print_locale)]
每个名：控制字符与内部换行压成一个空格；最多 3 项
payload.line.print_names = names
payload.line.item_code / qty / note 不变
item_name / display_name：仍填「第一名」供旧 Agent / 调试（第一名 = names[0]；display_name = formatStationSlipItemLabel(code, names[0])）
```

---

## 6. 纸面示例

80mm 纸、Font A 48 列（汉字占 2 列）。012 / 020 / 001 勾葡 + 中，006 仅勾葡；012 葡、中两名都超长换行，且带葡中混写备注：

```text
restaurant
                     Pedido
------------------------------------------------
Mesa n.º:001
Conv.:2
------------------------------------------------
    Artigos                                  Qtd
                    (PRATOS)
    012-Bacalhau à Brás com Batata Palha e     2
    Azeitonas
    葡式炒鳕鱼丝配金黄薯丝和黑橄榄及香草橄
    榄油
    Observação: sem cebola, 少放盐
    020-Frango Piri-Piri                       1
    霹雳烤鸡
                   (BEBIDAS)
    001-Água 500ml                             1
    矿泉水 500ml
    006-Cola                                   1
------------------------------------------------
Hora pedido:2026-10-18 12:13
Impresso por:restaurant
```

| 行 | 字号 |
|----|------|
| `Pedido`、`Mesa n.º:001` | 2×2（不变） |
| `Artigos / Qtd`、类别组头、全部菜名行（含续行）、备注行 | 1×2 |
| 店名、`Conv.`、`Hora pedido`、`Impresso por` | 1×1（不变） |

- Qty 只在第一语言名的首行；续行与其余语言名同左边距，不打编号、不打 Qty。
- 每个名字各自在菜名列内换行（汉字按 2 列计）。
- 备注前缀跟店 `print_locale`（此处 pt → `Observação: `），在全部菜名之后。
- 仅勾葡、无备注（如 006）：与现网单行一致。

---

## 7. UI

| 项 | 定法 |
|----|------|
| 位置 | `MenuManager` 编辑/新建菜品：三个名称 `Input` 下各一勾选（`StationPrintCheckbox`） |
| 默认 | 新建：pt 勾、en/zh 不勾；编辑：读库 |
| 提示 | 短文案：「勾选则印上档口小票」（三语 i18n） |
| 校验 | 名为空 → 勾选框禁用、显示为不勾；保存时名空的语种一律存 false（客户端与 `buildMenuItemPayload` 双重保证）。§2#3「勾选但名空 → 跳过」仍保留为入队兜底 |

---

## 8. 验收

- 默认仅葡：纸面与现网单行一致（有码则 `编号-葡名` + Qty）  
- 勾选葡+中：两行菜名，Qty 只在第一行；中文行无编号  
- 有备注才出现备注行；备注与菜名均为 1×2  
- 改菜单勾选不影响已入队/已下单快照重打  
- 结账/预结菜名行为不变  
- 长名换行：每个名字各自换行，续行不打 Qty  
- 厨显备菜 / 重做出的单同样多语  

---

## 9. 实现顺序（确认后）

1. migration（§3）+ Dashboard 勾选 + API 读写  
2. append 快照（§4）  
3. `print_names` 入队（§5）  
4. farvoo-fatura Agent 按契约出纸（见对端文档）  
5. 单测：展开顺序、全不勾回退、旧快照回退、控制字符（`menu-print-label.test.ts`）；Qty 仅首行在 Agent 侧  
