//go:build !windows

package main

func renderBitmapText(s string, style bitmapTextStyle) bitmapTextImage {
	if s == "" {
		return bitmapTextImage{}
	}
	charW := 12
	charH := 16
	if style.DoubleW {
		charW *= 2
	}
	if style.DoubleH {
		charH *= 2
	}
	width := len([]rune(s))*charW + 2
	height := charH + 2
	pixels := make([]byte, width*height)
	for i, r := range []rune(s) {
		if r == ' ' {
			continue
		}
		x0 := i*charW + 1
		for y := 1; y < height-1; y++ {
			for x := x0; x < x0+charW-2 && x < width-1; x++ {
				border := x == x0 || x == x0+charW-3 || y == 1 || y == height-2
				stroke := (x+y+int(r))%7 == 0
				if border || stroke || style.Bold && (x+y+int(r))%5 == 0 {
					pixels[y*width+x] = 1
				}
			}
		}
	}
	return bitmapTextImage{Width: width, Height: height, Pixels: pixels}
}
