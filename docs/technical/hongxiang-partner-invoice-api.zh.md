# Farvoo → 宏翔 开票对接说明

**读者：** 宏翔  
**调用方：** Farvoo（点餐 / 结账）  
**被调用方：** 宏翔（AT 认证开票软件）  
**日期：** 2026-08-17

Farvoo 负责账单；宏翔负责签发、编号、ATCUD、出纸、SAF-T。Farvoo 只保存宏翔返回的发票副本。

金额一律用 **十进制字符串**（如 `"14.95"`），不要用浮点数。  
鉴权方式、URL、端口由宏翔指定，本文只定 JSON 字段。

Farvoo 请求里 `source_system` 固定为 `"farvoo"`。

**没有单独的商品同步接口。** 开票行里已有编码、名称、单价、税率；签发时按 `item_code` 有则覆盖、无则创建即可。

---

## 1. 宏翔需要提供的两个接口

| 序号 | 用途 | Farvoo 何时调用 |
|------|------|-----------------|
| A | 签发发票 | 收银第一次为某笔账（或某个人）开票 |
| B | 重打发票 | 该范围已经开过，再出一张纸 |

NC / FR / ND 继续在宏翔自己的软件里办理，不走 Farvoo。

---

## 2. 接口 A：签发发票

收银选择开 **FS** 或 **FT**（白天散客多用 FS；客人要正式发票或提供 NIF 时开 FT）。

处理 `lines` 时：按 `item_code` 找商品，没有就创建，有则用本行的 `name` / `unit_price_gross` / `vat_rate` 覆盖。自助餐人头也是普通商品（如 `BF-LUNCH-ADULT`），不要单独做「人头费」类型。

**本张票的行金额以本次 `lines` 为准**，不要用库里的旧价重算。

### 请求

| 字段 | 类型 | 说明 |
|------|------|------|
| `request_id` | string (uuid) | 这一次点击。网络重试必须带同一个值，不得签第二张 |
| `document_type` | `"FT"` 或 `"FS"` | 收银本次选择 |
| `source_system` | `"farvoo"` | 固定 |
| `source_sale_id` | string (uuid) | Farvoo 这一笔账单的 ID |
| `scope_type` | `"whole_table"` 或 `"person"` | 整桌一张，或按人一张 |
| `scope_id` | string (uuid) | 这张票覆盖的范围 ID。整桌时等于 `source_sale_id`；按人时是该客人的稳定 ID |
| `table_display_name` | string | 票面桌名，如 `"018"`。不要当桌台主键 |
| `customer_nif` | string 或 `null` | 顾客 9 位税号。`null` = 散客，请按 `999999990` / Consumidor Final |
| `lines` | array | 本张票的商品行（折后成交价） |
| `gross_total` | string | 本张票含税合计，必须等于各行 `line_gross` 之和 |

### `lines[]` 每一行

| 字段 | 类型 | 说明 |
|------|------|------|
| `item_code` | string | 商品编码；没有该编码则创建 |
| `name` | string | 本行葡语名（禁止中文） |
| `qty` | string | 数量。自助餐成人 = 人数 |
| `unit_price_gross` | string | 折后含税单价 |
| `line_gross` | string | 行含税金额 |
| `vat_rate` | string | 本行 IVA，如 `"13.00"`、`"23.00"` |

### 必须返回

| 字段 | 说明 |
|------|------|
| `document_id` | 宏翔发票 ID。以后重打只传这个 |
| `invoice_no` | 票面编号 |
| `atcud` | ATCUD |

### 幂等（必须）

1. 相同 `request_id` + 相同内容 → 返回原来那张票，不得新签。  
2. 不同 `request_id`，但 `source_sale_id` + `scope_type` + `scope_id` 已开过 → 仍返回原来那张票，不得新签。  
3. 同一范围不能先开 FS 再开 FT（或反过来）。要换类型：在宏翔对原票做 NC，再开新票。

### 整桌 / 按人（必须）

同一 `source_sale_id`：

- 已开过 **整桌** → 禁止再开任何按人票  
- 已开过 **任意一张按人** → 禁止再开整桌  
- 按人可以只开一部分人，其余人以后再开

### 示例（整桌 FS，散客）

```json
{
  "request_id": "8f3c1a2e-6b14-4d90-9c2a-1b7e0d4a9f21",
  "document_type": "FS",
  "source_system": "farvoo",
  "source_sale_id": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
  "scope_type": "whole_table",
  "scope_id": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
  "table_display_name": "018",
  "customer_nif": null,
  "lines": [
    {
      "item_code": "BF-LUNCH-ADULT",
      "name": "BUFFET ADULTO ALMOCO",
      "qty": "3",
      "unit_price_gross": "14.95",
      "line_gross": "44.85",
      "vat_rate": "13.00"
    },
    {
      "item_code": "006",
      "name": "CERVEJA SUPERBOCK",
      "qty": "1",
      "unit_price_gross": "2.25",
      "line_gross": "2.25",
      "vat_rate": "23.00"
    }
  ],
  "gross_total": "47.10"
}
```

按人开票时：`scope_type` 为 `"person"`，`scope_id` 换成该客人的 UUID，`lines` / `gross_total` 只含这个人的金额。

---

## 3. 接口 B：重打

该范围已经签发过。只再出纸，**不改号、不重签、不改金额**。

### 请求

| 字段 | 类型 | 说明 |
|------|------|------|
| `document_id` | string | 接口 A 返回的发票 ID |

Farvoo 若还没有 `document_id`：会再调一次接口 A（同一 `scope_id`），请按幂等返回原票，不要新开。

---

## 4. 请宏翔确认

1. 两个接口的 URL、鉴权方式。  
2. 接口 A / B 成功、失败时的 HTTP 状态码与错误 JSON。  
3. 出纸是否由宏翔本机完成（Farvoo 不负责正式税务票打印）。
