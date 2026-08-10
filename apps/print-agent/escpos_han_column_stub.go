//go:build !windows

package main

import "strings"

// renderBitmapColumnRow — stub places ink in left band + Qty right-aligned in field.
func renderBitmapColumnRow(left, right string, kind hanColumnRowKind, fontPx int, style bitmapTextStyle) bitmapTextImage {
	canvasW := bitmapTextMaxWidthPx
	fontPx = resolveHanBitmapFontPx(fontPx)
	height := fontPx + 8
	pixels := make([]byte, canvasW*height)
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
				for xi := x; xi < x+span-1 && xi < canvasW-1; xi++ {
					pixels[y*canvasW+xi] = 1
				}
			}
			col += displayCols(r)
		}
	}

	leftX := hanColumnLeftPx(kind)

	if left != "" {
		stamp(left, leftX)
	}
	if right != "" {
		rx := hanQtyTextStartPx(right, fontPx, style.Bold)
		stamp(right, rx)
	}

	return bitmapTextImage{Width: canvasW, Height: height, Pixels: pixels}
}

func renderBitmapLeftRow(text string, leftPx int, fontPx int, style bitmapTextStyle) bitmapTextImage {
	canvasW := bitmapTextMaxWidthPx
	text = strings.TrimSpace(text)
	if text == "" {
		return bitmapTextImage{}
	}
	fontPx = resolveHanBitmapFontPx(fontPx)
	height := fontPx + 8
	pixels := make([]byte, canvasW*height)
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
	stamp(text, leftPx)
	return bitmapTextImage{Width: canvasW, Height: height, Pixels: pixels}
}

func renderBitmapNoteRow(prefix, body string, leftPx, prefixFontPx, bodyFontPx int, style bitmapTextStyle) bitmapTextImage {
	prefix = strings.TrimSpace(prefix)
	body = strings.TrimSpace(body)
	if prefix == "" && body == "" {
		return bitmapTextImage{}
	}
	if prefix == "" {
		return renderBitmapLeftRow(body, leftPx, bodyFontPx, style)
	}
	prefixFontPx = resolveHanBitmapFontPx(prefixFontPx)
	bodyFontPx = resolveHanBitmapFontPx(bodyFontPx)
	height := prefixFontPx + 8
	if bodyFontPx+8 > height {
		height = bodyFontPx + 8
	}
	canvasW := bitmapTextMaxWidthPx
	pixels := make([]byte, canvasW*height)
	stamp := func(s string, x0, fontPx int) {
		charW := fontPx / 2
		if charW < 1 {
			charW = 1
		}
		col := 0
		for _, r := range s {
			if r == ' ' {
				col++
				continue
			}
			x := x0 + col*charW
			span := displayCols(r) * charW
			for y := 1; y < height-1; y++ {
				for xi := x; xi < x+span-1 && xi < canvasW-1; xi++ {
					pixels[y*canvasW+xi] = 1
				}
			}
			col += displayCols(r)
		}
	}
	stamp(prefix, leftPx, prefixFontPx)
	bodyX := leftPx + measureHanTextWidth(prefix, prefixFontPx, style.Bold)
	if body != "" {
		stamp(body, bodyX, bodyFontPx)
	}
	return bitmapTextImage{Width: canvasW, Height: height, Pixels: pixels}
}
