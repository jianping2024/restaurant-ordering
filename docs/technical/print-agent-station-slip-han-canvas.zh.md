# 出品联中文 Han canvas 排版（唯一写法）

> Agent 侧布局；Web payload 不变。实现：`apps/print-agent/escpos_han_canvas.go`、`escpos_han_column_*.go`、`escpos.go` 站票路径。

## 何时启用

`text_encoding=bitmap` 且本票 **任意** 菜品名或备注含汉字 → 整张票的 **Items/Qty 区块 + 备注** 全部走 Han canvas。**禁止** 菜名走 canvas、备注仍走 Font A `wrapDisplay` 的第二套路径。

## 纸面目标（验收）

1. **左右对称**：左缘 col `stationSlipSideMargin`（4）；右缘 col 44–47 空 4 列。表头 `Items`、菜名、备注 **同一左竖线**。
2. **Qty 贴右**：表头 `Qty` 与行内数量在 8 列 field（col 36–43）内 **右对齐**，右缘到 col 43，不得「数字后再空半张纸」。
3. **菜名**：默认 **一行**（编号+名+Qty）；仅当写到快碰 Qty 区才 `wrapHanTextByPx` 折行；续行无 Qty。左缘 col 4（与 Items 同）。
4. **备注**：与 Items **同一左缘与右界**（Qty 列前 1 列间隙）；`Observação: ` 仅首行；首行正文宽度 = 行宽 − 前缀宽；续行 **hanging indent**；每行 bitmap + underline；**只折一次**。
5. **纯拉丁**（整票无 Han）：仍 Font A 48 列 `stationSlipItemLine` + 原 `writeStationItemNoteLine` Latin 路径（同一 col 4 左缘、`padFieldRight` Qty）。

## 唯一函数（不得并行）

| 能力 | 唯一入口 |
|------|----------|
| Han 表头/菜名行（Items+Qty） | `escposHanColumnRow` → `renderBitmapColumnRow` |
| Han 备注行 | `escposHanLeftRow` → `renderBitmapLeftRow` |
| Qty 水平位置 | `hanQtyTextStartPx`（8 列 field **右对齐**） |
| Han 折行 | `wrapHanTextByPx`；备注 `wrapHanNoteLines`（前缀/正文分宽） |
| 拉丁 Items/Qty | `stationSlipColumnHeaderLine` / `stationSlipItemLine` + `padFieldRight` |

**禁止保留**：Han block 内 `wrapDisplay` 备注；`stationSlipItemBitmapLine`；空格垫 Qty；第二套左距（原 col 5 菜名 / col 1 备注）。

## 像素常量

- 画布宽 `bitmapTextMaxWidthPx` = 384（80mm Font A 48 列 × 8px/列）
- `escposDisplayColToPx(col) = col * 384 / 48`
- 表头/菜名/备注左界：`escposDisplayColToPx(stationSlipSideMargin)` = col **4**
- Qty field 右缘 px：`escposDisplayColToPx(stationSlipQtyColStart + stationSlipQtyColWidth)`

## 测试

- `TestHanColumnLeftMatchesItemsMargin`：表头/菜名/备注左 px 一致
- `TestHanItemLabelFont34SingleLine`：`002-冰水 500毫升` font 34 单行
- `TestHanNoteFont34FirstLineFitsBody`：备注首行正文 ≥4 字（非前缀吃满）
- `TestHanColumnRowQtyInkInBand`：Qty 墨迹贴 field 右缘
- `TestHanNoteEscposSingleWrapPath`：无二次折行

## 版本

- 0.3.78：左右对称 col 4 + 备注首行分宽 + 拉丁 Qty 右对齐
- 0.3.77：Han canvas 备注迁入（左距未统一，已 supersede）
