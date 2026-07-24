# Despacho 8632/2014 Hash 参考材料

**B1（需求侧）已关闭（2026-07-24）。**  
官方 PDF：[DRE Despacho n.º 8632/2014](https://files.dre.pt/2s/2014/07/126000000/1725517261.pdf)  
本机副本：`/Users/chenjianping/Downloads/Invoice-project/Despacho_nº_8632_2014_03_07.pdf`

## 结论（需求口径）

| 项 | 状态 |
|----|------|
| 算法 / 拼接 / Base64 / OpenSSL 流程 | 已定，见需求 §2.6 |
| 附录示例私钥完整 PEM | **故意截断**，不作黄金向量 |
| 「复现 oso2FoOw…」逐字节对照 | **不做**（设计使然） |
| 验收 | 自生成钥 + 签验通过 + Go ↔ OpenSSL 字节一致 |
| Go PoC 实现 | **另排期**，不属于 B1 关闭范围 |

## 本目录文件（说明性参考，非金样）

| 文件 | 内容 |
|------|------|
| `Registo1.txt` | 附录首张明文：`2010-05-18;2010-05-18T11:22:19;FAC 001/14;3.12;`（无末尾换行） |
| `Registo1.expected.b64` / `Registo2.expected.b64` | 附录示例输出（文档对照用）；**禁止**用作实现通过条件 |

## `Invoice-project` 盘点

| 位置 | 与 Hash 关系 |
|------|----------------|
| 根目录 Despacho PDF | 算法与示例主文档 |
| `qr/` / `saft/` / `series/` | 无 Hash PEM / 无签名金样 |
