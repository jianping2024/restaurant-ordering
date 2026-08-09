package main

import "strings"

type escposTextMode int

const (
	escposTextLatin escposTextMode = iota
	escposTextUTF8
	escposTextBitmap
)

type bitmapTextStyle struct {
	Align     byte
	Bold      bool
	Underline bool
	DoubleW   bool
	DoubleH   bool
}

type bitmapTextImage struct {
	Width  int
	Height int
	Pixels []byte
}

// Bitmap cells match Font A pitch on 80mm (48 cols × 8 dots = 384).
// Cell height 20 (1×1) / 40 (1×2) — slightly under classic 24/48 so CJK reads smaller.
const (
	bitmapCellDotsX = 8
	bitmapCellDotsY = 20
)

func bitmapCellSize(style bitmapTextStyle) (cellW, cellH int) {
	cellW = bitmapCellDotsX
	cellH = bitmapCellDotsY
	if style.DoubleW {
		cellW *= 2
	}
	if style.DoubleH {
		cellH *= 2
	}
	return cellW, cellH
}

func bitmapMaxCols(style bitmapTextStyle) int {
	cellW, _ := bitmapCellSize(style)
	if cellW <= 0 {
		return escposWidth
	}
	return (escposWidth * bitmapCellDotsX) / cellW
}

func textModeForConfiguredChinese(needChinese bool) escposTextMode {
	if !needChinese {
		return escposTextLatin
	}
	cfg, err := loadConfig(defaultConfigPath())
	if err == nil && cfg != nil {
		switch normalizeTextEncoding(cfg.TextEncoding) {
		case "utf8":
			return escposTextUTF8
		case "latin":
			return escposTextLatin
		}
	}
	return escposTextBitmap
}

func needsBitmapText(s string) bool {
	return hasHan(s)
}

func escposBitmapText(s string, style bitmapTextStyle) []byte {
	img := renderBitmapText(strings.TrimRight(s, "\r\n"), style)
	if img.Width <= 0 || img.Height <= 0 || len(img.Pixels) != img.Width*img.Height {
		return encodeWindows1252(s)
	}
	widthBytes := (img.Width + 7) / 8
	data := make([]byte, widthBytes*img.Height)
	for y := 0; y < img.Height; y++ {
		for x := 0; x < img.Width; x++ {
			if img.Pixels[y*img.Width+x] == 0 {
				continue
			}
			data[y*widthBytes+x/8] |= 0x80 >> uint(x%8)
		}
	}
	out := []byte{
		0x1B, 0x61, style.Align,
		0x1D, 0x76, 0x30, 0x00,
		byte(widthBytes & 0xff), byte((widthBytes >> 8) & 0xff),
		byte(img.Height & 0xff), byte((img.Height >> 8) & 0xff),
	}
	out = append(out, data...)
	// Feed exactly the raster height (ESC J n). Do not append '\n' — writer.lf()
	// skips once after bitmap so Latin/CJK line spacing stays one advance.
	for remain := img.Height; remain > 0; {
		n := remain
		if n > 255 {
			n = 255
		}
		out = append(out, 0x1B, 0x4A, byte(n))
		remain -= n
	}
	return out
}
