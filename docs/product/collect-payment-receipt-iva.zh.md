# 收款方式 · 热敏税汇总 · 预结免责 · 人头费 IVA（定稿）

> **状态：定稿 · 已实现（2026-09-26）**  
> **权威：是**（结账收款 / 预结与账单热敏 / 财政开票付款行 / 自助餐人头费税率）  
> **实现仓：** Mesa Web + Mesa print-agent + farvoo-fatura（须同分或紧接合）  
> **相关：** [`../technical/farvoo-fiscal-bill-sync-api.zh.md`](../technical/farvoo-fiscal-bill-sync-api.zh.md)、[`../checkout-dashboard-ui.zh.md`](../checkout-dashboard-ui.zh.md)、[`../technical/04-printing.md`](../technical/04-printing.md)、[`../buffet-pricing-design.zh.md`](../buffet-pricing-design.zh.md)

本文取代此前「六种付款方式 / 票面一行 MIXED / 现金超 100 仍可 FS / 混合付款 fatura 否决」等口径。

---

## 1. 付款方式（唯一三选）

| 码 | UI / 票面 |
|----|-----------|
| `CASH` | 现金 / Dinheiro |
| `MULTIBANCO` | Multibanco（取代原 `CARD`；不保留并行 CARD） |
| `MIXED` | 混合（仅台账/枚举；**禁止**票面只打一行 Misto） |

- **不写** MBWAY / OTHER / CARD 兼容（开发期只认上述三种）。
- 收款弹窗与开票弹窗（`CollectPaymentModal` / `PrintFiscalInvoiceModal`）**同一套** UI 与校验。

### 1.1 交互

| 方式 | 行为 |
|------|------|
| 现金 | 实收 + 找零；不足不可确认；确认后开钱箱 |
| Multibanco | 整笔按终端收，无拆额框 |
| 混合 | Multibanco 可编辑、现金只读 = 应收 − 卡；默认卡=全额、现金=0（须改小后才能确认，**预期 UX**）；**两边都必须 >0** 才可确认为 `MIXED`；卡改成全额 → 提示「现金须 >0，或改为 Multibanco」；卡额 ∈ `(0, 应收]` |

确认归一：卡=全额 → `MULTIBANCO`；两边 >0 → `MIXED`。  
`MIXED` 且现金额 >0 → 也开钱箱。混合路径无「实收/找零」。

### 1.2 台账

- 一笔 `session_collected_payments`：`amount` = 本次应收；`payment_method` ∈ {CASH, MULTIBANCO, MIXED}。
- **唯一拆额落点：** 列 `payment_lines` jsonb（与 bill_sync / 热敏 payload **同名同形**）：

```json
[{ "method": "MULTIBANCO", "amount": "15.00" }, { "method": "CASH", "amount": "5.00" }]
```

- `MIXED`：两行，和 = `amount`，两边 >0。
- 纯 CASH / MULTIBANCO：可空或单行。
- 旧行无 `payment_lines` 的 MIXED：开票 / 重打 **fail-closed**（不写兼容）。

---

## 2. 证件类型 FS / FT

| 条件 | `document_type` |
|------|-----------------|
| `CASH` 且折后含税应付 **≤ €100** | 可 `FS` |
| `CASH` 且折后含税应付 **> €100** | 必须 `FT` |
| `MULTIBANCO` / `MIXED` | `FT` |

- 门槛 = **折后含税应付总额**（CIVA art. 40 实务「发票金额」；税基在折后，art. 16.º n.º 6 b)）。
- Mesa **显式传入** `document_type`；fatura 侧总额 >100 且入队 FS 时升 FT 的闸保留。

---

## 3. 票面付款（热敏业务票 + 财政票）

- 禁止票面只打 `MIXED` / `Misto`。
- 混合：按方式分行（Dinheiro + Multibanco + 各自金额；参照 Vendus 结构）。
- 纯现金 / 纯 Multibanco：一行方式 + 金额（sole label）。
- **farvoo-fatura：** bill_sync / auto_issue 消费 `payment_lines[]` → 多行 `sale.Payments` → 打印分行；`MIXED` 无 lines → fail-closed。撤销「整单 MIXED 够用」。

---

## 4. 热敏税汇总 · 预结 / 账单

- 菜品价为**含税价**；票面打「不含税合计 + 分税率税额」（多税率与财政票一致）。
- 扩 `print_jobs` payload：入队**快照**每行 `vat_rate`（百分数串 `"13.00"`，与 bill_sync 同约定；**不**打印时现查菜单）。
- 税率来源：
  - **菜品行** ← `menu_items.vat_rate`（必填；numeric 百分数；档位 0/6/13/23；默认 23）。
  - **唯一例外：自助餐人头费** ← `buffets.vat_rate`（新增；同档；**默认 13**；设置页必填可改）。
  - 以后其它计费行都走菜单；不为「改价行」单独设计。
- 缺税率 → **fail-closed**（财政票也不再静默默认税率）。
- **预结单 + 账单**（非发票）在标题下、菜品前明显位置印法定句（Despacho n.º 8632/2014 原句，固定葡语，不跟 `print_locale` 改写）：

  > Este documento não serve de fatura

- 真发票 FT / FS **不印**该句。
- 无折扣：不打重复「原价 + 小计」；有折扣：打折扣 + 折后税汇总。
- Troco：仅实收 > 应付时打。
- 按人小票：IVA = **此人份额**。
- 其它标签跟 `restaurants.print_locale`（葡萄牙店为 `pt`）。

---

## 5. IVA 存储约定（跨系统）

| 位置 | 形态 | 例子 |
|------|------|------|
| Mesa `menu_items.vat_rate` / `buffets.vat_rate` | `numeric` 百分数点 | `23`、`13` |
| bill_sync / print_jobs 行 | 字符串百分数两位 | `"13.00"`（禁止 `"0.13"`） |
| fatura 商品库 | TEXT 百分数串 | `"13.00"` |
| fatura 签发内部 | 可转小数串 | `"0.13"`（仅内部/SAF-T） |

语义统一为百分数点；库类型可不同。

---

## 6. 实现范围

| 仓 | 职责 |
|----|------|
| Mesa Web | 收款/开票 UI；台账 `payment_method` + `payment_lines`；buffet IVA；print_jobs / bill_sync 载荷 |
| Mesa print-agent | 热敏税汇总、免责句、`payment_lines` 分行、按人税额 |
| farvoo-fatura | 吃 `payment_lines`；多行付款打印；与 §2 证件类型对齐 |

---

## 7. 废止口径（勿再写回）

- 付款六选（含 MBWAY / OTHER / 并行 CARD）。
- 票面一行 `Mixed` / 整单 MIXED 够用（fatura 曾否决多行 — **已撤销**）。
- 现金 > €100 仍可 FS。
- 预结/账单可不打「Este documento não serve de fatura」。
- 人头费无 IVA、打印时默认税率糊弄过关。
- 免责句按 `print_locale=zh` 译成中文替代葡语原句。
