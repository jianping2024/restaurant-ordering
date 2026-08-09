//go:build !windows

package main

func renderBitmapText(s string, style bitmapTextStyle) bitmapTextImage {
	if s == "" {
		return bitmapTextImage{}
	}
	cellW, cellH := bitmapCellSize(style)
	maxCols := bitmapMaxCols(style)
	if displayWidth(s) > maxCols {
		s = truncateDisplay(s, maxCols)
	}
	cols := displayWidth(s)
	if cols <= 0 {
		return bitmapTextImage{}
	}
	width := cols * cellW
	height := cellH
	pixels := make([]byte, width*height)
	col := 0
	for _, r := range s {
		span := displayCols(r)
		if r == ' ' {
			col += span
			continue
		}
		x0 := col * cellW
		x1 := x0 + span*cellW
		for y := 1; y < height-1; y++ {
			for x := x0 + 1; x < x1-1 && x < width; x++ {
				border := x == x0+1 || x == x1-2 || y == 1 || y == height-2
				stroke := (x+y+int(r))%7 == 0
				if border || stroke || style.Bold && (x+y+int(r))%5 == 0 {
					pixels[y*width+x] = 1
				}
			}
		}
		col += span
	}
	return bitmapTextImage{Width: width, Height: height, Pixels: pixels}
}
