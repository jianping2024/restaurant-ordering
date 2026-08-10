# 出品联中文 Han canvas 排版（唯一写法）

> Agent 侧布局；Web payload 不变。实现：`apps/print-agent/escpos_han_canvas.go`、`escpos_han_column_*.go`、`escpos.go` 站票路径。

## POS-80 / 80mm 纸规格（锁定）

| 项 | 值 |
|---|---|
| 可打点宽 | **576** |
| Font A | 48 列 × **12** dots = 576 |
| 左右边距 | 各 4 列 = 48 dots |
| Qty 区 | **4** 列，右贴右 4 列内侧 |

**禁止** `384 = 48×8` 当满纸。

## 何时启用

`text_encoding=bitmap` 且本票任意菜名/备注含汉字 → Items/Qty + 备注全部走 Han canvas。

## 纸面目标

1. 左右对称 col 4；Qty 在 576 尺子上贴右。
2. 菜名默认一行；仅超 Font A 可用列宽才折；续行无 Qty。
3. 备注前缀 = `labelsFor(print_locale).itemNote`，与正文 **同字号**；续行 hanging；只折一次。
4. 站票表头仍英文（`stationTicketLabels`）；**仅备注标签跟语言**。

## 唯一函数

| 能力 | 唯一入口 |
|------|----------|
| Han Items/Qty | `escposHanColumnRow` → `renderBitmapColumnRow` |
| Han 备注 | `escposHanLeftRow` → `renderBitmapLeftRow` |
| Qty 位置 | `hanQtyTextStartPx` |
| 备注折行 | `wrapHanNoteLines` + `wrapHanTextByPx` |
| 备注文案 | `labelsFor(locale).itemNote` |
| 拉丁 Items/Qty | `stationSlipColumnHeaderLine` / `stationSlipItemLine` + `padFieldRight` |

**禁止：** 半号前缀；`escposHanNoteRow`；硬编码 `Observação:`；384 画布。

## 像素

- `bitmapTextMaxWidthPx = 576`
- `escposDisplayColToPx(col) = col * 576 / 48`（= col×12）

## 版本

- **0.3.80**：Qty 列 4
- **0.3.79**：576 + 语言前缀 + 同号
- 0.3.78：对称 col4（仍 384，已 supersede）
