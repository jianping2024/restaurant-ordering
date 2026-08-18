# Farvoo → 宏翔 账单同步 API

**读者：** 宏翔  
**调用方：** Farvoo（点餐 / 结账）  
**被调用方：** 宏翔  
**日期：** 2026-08-18

Farvoo 只负责把结账时确认的**账单快照**同步给宏翔。

金额一律使用**十进制字符串**（如 `"14.95"`），不要使用浮点数。  
鉴权方式、URL、端口由宏翔指定，本文只定义 JSON 字段。  
`source_system` 固定为 `"farvoo"`。

---

## 1. 接口用途

一次请求同步一笔账单。

- 未分单：顶层带 `lines` / `gross_total`
- 已分单：顶层带 `splits[]`，每个分单自己带 `lines` / `gross_total`

两种形态互斥，不要混用。

---

## 2. 请求字段

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `request_id` | string (uuid) | 这一次同步操作的唯一 ID。网络重试必须沿用同一个值 |
| `source_system` | `"farvoo"` | 固定值 |
| `source_sale_id` | string (uuid) | Farvoo 这笔账单的 ID |
| `table_display_name` | string | 桌面显示名，如 `"018"` |
| `scope_type` | `"whole_table"` 或 `"split"` | `whole_table` = 未分单；`split` = 已按分单结构拆好 |
| `lines` | array | 仅 `whole_table`：整桌账单行 |
| `gross_total` | string | 仅 `whole_table`：整桌含税合计，必须等于各行 `line_gross` 之和 |
| `splits` | array | 仅 `split`：已分好的各份账单 |

### `lines[]`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `item_code` | string | 商品编码 |
| `name` | string | 商品名称 |
| `qty` | string | 数量 |
| `unit_price_gross` | string | 含税单价 |
| `line_gross` | string | 行含税金额 |
| `vat_rate` | string | 本行税率，如 `"13.00"`、`"23.00"` |

### `splits[]`

已分单时必填。每一项是一份独立账单。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `scope_id` | string (uuid) | 这份分单的稳定 ID |
| `name` | string | 分单显示名，如 `"Ana"` |
| `lines` | array | 这份分单的账单行，结构同上面的 `lines[]` |
| `gross_total` | string | 这份分单的含税合计，必须等于该份各行 `line_gross` 之和 |

同一 `source_sale_id` 下，各 `splits[].scope_id` 不得重复。  
各份 `gross_total` 之和应等于这桌应付总额。

---

## 3. 成功与失败

成功时返回 HTTP `200`。

失败时返回 HTTP `4xx` / `5xx` 以及可读的错误信息。

本文不约束成功响应体字段；只要求宏翔能明确区分“同步成功”与“同步失败”。

---

## 4. 幂等要求

1. 相同 `request_id` 的重复请求，必须按同一次同步处理，不能重复落账。
2. 未分单：同一 `source_sale_id` + `scope_type="whole_table"` 视为同一笔。
3. 已分单：同一 `source_sale_id` + `splits[].scope_id` 视为同一份分单。

---

## 5. 示例

### 未分单（整桌）

```json
{
  "request_id": "8f3c1a2e-6b14-4d90-9c2a-1b7e0d4a9f21",
  "source_system": "farvoo",
  "source_sale_id": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
  "table_display_name": "018",
  "scope_type": "whole_table",
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

### 已分单（两份）

同一桌、同一 `source_sale_id`，一次请求带两份分单。

```json
{
  "request_id": "c2d4e6f8-1a23-4b56-8c90-d1e2f3a4b5c6",
  "source_system": "farvoo",
  "source_sale_id": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
  "table_display_name": "018",
  "scope_type": "split",
  "splits": [
    {
      "scope_id": "11111111-1111-1111-1111-111111111111",
      "name": "Ana",
      "lines": [
        {
          "item_code": "BF-LUNCH-ADULT",
          "name": "BUFFET ADULTO ALMOCO",
          "qty": "1",
          "unit_price_gross": "14.95",
          "line_gross": "14.95",
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
      "gross_total": "17.20"
    },
    {
      "scope_id": "22222222-2222-2222-2222-222222222222",
      "name": "Bruno",
      "lines": [
        {
          "item_code": "BF-LUNCH-ADULT",
          "name": "BUFFET ADULTO ALMOCO",
          "qty": "2",
          "unit_price_gross": "14.95",
          "line_gross": "29.90",
          "vat_rate": "13.00"
        }
      ],
      "gross_total": "29.90"
    }
  ]
}
```

---

## 6. 需宏翔确认

1. 接口 URL
2. 鉴权方式
3. 成功 / 失败时的 HTTP 状态码
4. 失败响应体格式
