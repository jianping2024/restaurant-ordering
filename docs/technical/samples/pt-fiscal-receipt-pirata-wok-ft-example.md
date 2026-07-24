# 真实 FT 小票样例（参考版式）

| 项 | 内容 |
|----|------|
| 文件 | [`pt-fiscal-receipt-pirata-wok-ft-example.png`](./pt-fiscal-receipt-pirata-wok-ft-example.png) |
| 来源 | 门店实票照片（PIRATA WOK / ESTRELAS OGIVAIS LDA） |
| 用途 | **版式与字段摆放参考**；非 Hash 金样、非本产品输出 |

## 从票面可读到的要点

- 抬头：商号、公司名、地址、`NIF: PT…`、电话；`Original`
- 类型与编号：`FATURA: FT 系列/序号`（例：`FT 1/000000065746`）
- 客户：`Consumidor Final`（散客）
- 行：品名、单价、折扣%、数量、行金额；汇总含 TOTAL / 实收 / 找零 / 折扣合计
- IVA 表：税率、税基、税额、含税合计；`IVA INCLUIDO`
- **ATCUD** 印在 QR 上方（例：`JJYGRNPT-000000065746`）
- **QR** 较大、居中偏下
- 认证行形态：`… - Processado por programa certificado n.º *1549/AT`（真号示例；我方 A12 通过前用占位）
- 桌台：`MESA: …`（仅展示名，无 UUID）

## 与本产品定稿的关系

- Mesa API 开票默认 FT、散客 NIF、桌号用 `display_name`：与本样一致方向。
- 我方 MVP 折后价进票、可不单独列折扣行；本样有折扣列，属他牌版式，**不强制抄列结构**。
- Hash/RSA 金样仍以 Despacho 8632/2014 附录为准，不用本图反推签名。
