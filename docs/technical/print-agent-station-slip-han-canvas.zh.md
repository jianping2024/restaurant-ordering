# 出品联中文 Han canvas 排版（唯一写法）

> Agent 侧布局；Web payload 不变。实现：`apps/print-agent/escpos_han_canvas.go`、`escpos_han_column_*.go`、`escpos.go` 站票路径。

## 何时启用

`text_encoding=bitmap` 且本票 **任意** 菜品名或备注含汉字 → 整张票的 **Items/Qty 区块 + 备注** 全部走 Han canvas。**禁止** 菜名走 canvas、备注仍走 Font A `wrapDisplay` 的第二套路径。

## 纸面目标（验收）

1. **Qty 贴右**：表头 `Qty` 与行内数量 **右对齐** 在同一 8 列 field 内（`stationSlipQtyColStart`…+`stationSlipQtyColWidth`），右侧仅保留 `stationSlipSideMargin`（4 列），不得出现「数字后面空半张纸」。
2. **菜名**：左缘 col `stationSlipItemLeftMargin`（5）；折行用 `wrapHanTextByPx`（GDI/像素宽，只折一次）；续行无 Qty。
3. **备注**：与菜名 **同一像素标尺**（左缘 col `escposNoteIndentSpaces`，右界 Qty 列前 1 列间隙）；`Observação: ` 仅首行；续行 **hanging indent** 到前缀后首字 x；每行 bitmap + underline；**只折一次**，禁止 `wrapDisplay` → `escposBitmapText` 二次折行。
4. **纯拉丁**（整票无 Han）：仍 Font A 48 列 `stationSlipItemLine` + 原 `writeStationItemNoteLine` Latin 路径。

## 唯一函数（不得并行）

| 能力 | 唯一入口 |
|------|----------|
| Han 表头/菜名行（Items+Qty） | `escposHanColumnRow` → `renderBitmapColumnRow` |
| Han 备注行 | `escposHanLeftRow` → `renderBitmapLeftRow` |
| Qty 水平位置 | `hanQtyTextStartPx`（8 列 field **右对齐**，列语义 → `escposDisplayColToPx`） |
| Han 折行 | `wrapHanTextByPx`；备注首行/续行宽 `hanNoteMaxPx` / `hanNoteContinuationMaxPx` + `wrapHanNoteLines` |
| 拉丁 Items/Qty | `stationSlipItemLine` / `stationSlipColumnHeaderLine` |

**禁止保留**：`writeStationItemNoteLine` 在 Han block 内调用 `wrapDisplay` 或 `escposBitmapText` 整行备注；`stationSlipItemBitmapLine`；空格垫 Qty。

## 像素常量

- 画布宽 `bitmapTextMaxWidthPx` = 384（80mm Font A 48 列 × 8px/列）
- `escposDisplayColToPx(col) = col * 384 / 48`
- 菜名左界：`hanColumnLeftPx(hanColItem)` = col 5
- 表头 Items 左界：`hanColumnLeftPx(hanColHeader)` = col 4
- Qty field 右缘 px：`escposDisplayColToPx(stationSlipQtyColStart + stationSlipQtyColWidth)`
- 备注左界：`escposDisplayColToPx(escposNoteIndentSpaces)`

## 测试

- `TestHanQtyRightAlignedInField`：表头 Qty 与 `"1"` 的 ink 右缘落在同一 field 右界 ± 容差
- `TestHanNoteSingleWrapNoDouble`：长中文备注 ESC/POS 中 GS v 0 行数 = `wrapHanNoteLines` 行数（无二次折行）
- `TestHanNoteFirstLineFitsPixels`：首行汉字数 ≥ 按 `hanNoteMaxPx` 测算下限（回归「一行未满就断」）
- 保留拉丁 `TestStationSlipItemLineLayout` / `TestStationTicketItemNoteWrapsFullText`

## 版本

- 0.3.76：仅 Items/Qty 行 canvas（备注漏迁，已废弃为完整方案）
- **0.3.77+**：本文件为完整 end-state
