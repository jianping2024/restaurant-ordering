//go:build !windows

package main

// renderBitmapColumnRow — stub places ink in left band + Qty pixel band for tests.
func renderBitmapColumnRow(left, right string, kind hanColumnRowKind, fontPx int, style bitmapTextStyle) bitmapTextImage {
	canvasW := bitmapTextMaxWidthPx
	fontPx = resolveHanBitmapFontPx(fontPx)
	height := fontPx + 8
	pixels := make([]byte, canvasW*height)

	leftX := hanColumnLeftPx(kind)
	qtyStart := hanQtyColStartPx()
	qtyWidth := hanQtyColWidthPx()
	charW := fontPx / 2
	if charW < 1 {
		charW = 1
	}

	stamp := func(s string, x0 int) {
		col := 0
		for _, r := range s {
			if r == ' ' {
				col++
				continue
			}
			x := x0 + col*charW
			span := displayCols(r) * charW
			for y := 1; y < height-1; y++ {
				for x := x; x < x+span-1 && x < canvasW-1; x++ {
					pixels[y*canvasW+x] = 1
				}
			}
			col += displayCols(r)
		}
	}

	if left != "" {
		stamp(left, leftX)
	}
	if right != "" {
		rw := measureHanTextWidth(right, fontPx, style.Bold)
		rx := qtyStart + (qtyWidth-rw)/2
		if rx < qtyStart {
			rx = qtyStart
		}
		stamp(right, rx)
	}

	return bitmapTextImage{Width: canvasW, Height: height, Pixels: pixels}
}
