# Farvoo ↔ 宏翔开票合同（必要字段）

> **给宏翔看的对外说明：** [`hongxiang-partner-invoice-api.zh.md`](./hongxiang-partner-invoice-api.zh.md)（无 Farvoo 内部表名）。本文给 Farvoo 实现用。

产品品牌：**Farvoo**。`source_system` 固定 `"farvoo"`。  
金额一律 **decimal 字符串**（如 `"14.95"`），禁止 JS float。  
宏翔是税务权威（是否已开、InvoiceNo、ATCUD）；Farvoo 只存副本。

---

## 1. Farvoo 表（开票用到的）

### 1.1 已有，直接用

**`bill_splits`（一笔结账账单）**

| 字段 | 开票用途 |
|------|----------|
| `id` | 整桌开票时的 `source_sale_id`；整桌时也是 `scope_id` |
| `display_name` | 票面桌名（如 `018`），禁止传 table UUID |
| `customer_nif` | 顾客税号；空 = 散客 |
| `result` | 分单人列表（按人开票时每人一行） |
| `total_amount` | 对账用；传给宏翔的是折后行合计 `gross_total` |

**`session_collected_payments`（按人收款行）**

| 字段 | 开票用途 |
|------|----------|
| `id` | 该人已收款时，按人开票的 `scope_id`（现网已有 UUID） |
| `bill_split_id` | 回到哪一笔账单 |
| `person_index` | **只给结账用**，不要当 `scope_id` |

**`orders.items`（行快照）**

加餐行：`item_code`、葡语名、含税单价、数量。  
自助餐 `kind=buffet_base`：拍成普通商品行（成人/儿童 × 人数 × 锁定价）。

**`menu_items` + 拍平后的 buffet SKU**

开票行从这里取 `item_code` / 葡语名 / 含税价 / `vat_rate`。Buffet 不传规则表，拍成商品行（如 `BF-LUNCH-ADULT`）。宏翔没有独立同步接口：签发时按行 `item_code` 有则覆盖、无则创建。

### 1.2 要补的（按人开票才需要）

`bill_splits.result[]` 每行增加 **`party_id`（uuid）**：创建该分单人时生成，之后不变。  
还没收款、又要按人开票时，`scope_id` = 这个 `party_id`。  
与楼面拼桌 `table_party_groups.party_id` **不是**同一个东西。

整桌开票 **不必**等这个字段。

### 1.3 新表：发票副本（一张票一行）

**`invoice_copies`**

| 字段 | 含义 |
|------|------|
| `id` | Farvoo 本行主键 |
| `restaurant_id` | 哪家店 |
| `source_sale_id` | 账单 `bill_splits.id` |
| `scope_type` | `whole_table` 或 `person` |
| `scope_id` | 见下节 |
| `document_id` | 宏翔返回的发票 ID，重打只传这个 |
| `invoice_no` | 票面编号（如 `FT 1/000000065746`），只展示 |
| `atcud` | 税务 ATCUD，只展示 |
| `document_type` | 本张票类型：`FT` 或 `FS`（收银选；同一 scope 开过哪种就记哪种） |

唯一约束：`(restaurant_id, source_sale_id, scope_type, scope_id)` 一行，防止同一范围记两张票。

这是副本。丢了或对不上，以宏翔按 `source_sale_id + scope_id` 查到的为准。

---

## 2. `scope_id` 怎么填

| 怎么开 | `scope_type` | `scope_id` |
|--------|----------------|------------|
| 整桌一张 | `whole_table` | `bill_splits.id`（与 `source_sale_id` 相同） |
| 按人、已收款 | `person` | `session_collected_payments.id` |
| 按人、未收款 | `person` | 该分单人 `result[].party_id` |

同一账单 + 同一 `scope_id` 已开过 → 不得再签，只能重打。

---

## 3. 接口（Farvoo → 宏翔）

共两个。鉴权（店密钥等）由宏翔定，此处不列。没有单独的商品同步：签发时按行 upsert。

### 3.1 签发（第一次开票）

收银点「打印发票」且该范围还没有 `document_id`。桌台只开 **`FT` 或 `FS`**（白天散客常用 FS；客人要正式发票/有 NIF 开 FT）。NC / FR / ND 仍在宏翔软件里办。

宏翔处理 `lines`：按 `item_code` 没有就创建，有则用本行名称/单价/税率覆盖。票面金额以本行 `line_gross` 为准。

**请求字段**

| 字段 | 含义 |
|------|------|
| `request_id` | 这一次点击的 UUID。网络重试带同一个号，避免连点签两张 |
| `document_type` | `"FT"` 或 `"FS"`，收银本次选哪种就传哪种 |
| `source_system` | 固定 `"farvoo"` |
| `source_sale_id` | 账单 `bill_splits.id` |
| `scope_type` | `whole_table` 或 `person` |
| `scope_id` | 这张票覆盖哪一块，见 §2 |
| `table_display_name` | 票面桌名，如 `"018"` |
| `customer_nif` | 顾客 9 位税号；没有则 `null`（宏翔按散客 `999999990`） |
| `lines` | 本张票的商品行（折后） |
| `gross_total` | 本张票含税合计，必须等于各行 `line_gross` 之和 |

**`lines[]` 每行**

| 字段 | 含义 |
|------|------|
| `item_code` | 与商品库同一编码 |
| `name` | 本行葡语名 |
| `qty` | 数量（buffet 成人 = 人数） |
| `unit_price_gross` | 折后含税单价（开台锁定的 buffet 价也走这里） |
| `line_gross` | 行含税金额 = 数量 × 单价（已舍入） |
| `vat_rate` | 本行 IVA |

**成功返回（必要）**

| 字段 | 含义 |
|------|------|
| `document_id` | 宏翔发票 ID。写入 `invoice_copies`，重打只用它 |
| `invoice_no` | 票面编号 |
| `atcud` | ATCUD |

同一 `request_id` 重试，或不同 `request_id` 但 `source_sale_id + scope_type + scope_id` 已开过 → **返回原票，不得新签**（不能先开一张 FS 再对同一 scope 开一张 FT；要换类型须在宏翔对原票做 NC 后再开）。

### 3.2 重打（已开过）

Farvoo 已有该范围的 `document_id`。

**请求字段**

| 字段 | 含义 |
|------|------|
| `document_id` | 签发时宏翔返回的发票 ID |

只再出纸，不改号、不重签、不改金额。

本地没有 `document_id` 时：不要猜；用 3.1 再推一次（带同一 `scope_id`），让宏翔返回原票。

---

## 4. 收银动作对照

```text
该 scope 没有 document_id
  → 3.1 签发 → 把返回值写入 invoice_copies

该 scope 已有 document_id
  → 3.2 只传 document_id → 重打
```

整桌与按人互斥：开过整桌就不能再按人开；开过任一人就不能再开整桌。未开的人可以继续 3.1。
