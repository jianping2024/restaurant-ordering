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
	// FontPx: when > 0, raster cell height and GDI font use this size (Han body = bitmapFontDishPx).
	// When 0, height follows bitmapCellDotsY and DoubleH/DoubleW.
	FontPx int
}

type bitmapTextImage struct {
	Width  int
	Height int
	Pixels []byte
}

// Bitmap cells match Font A pitch on 80mm (48 cols × 8 dots = 384).
const (
	bitmapCellDotsX  = 8
	bitmapCellDotsY  = 20
	bitmapFontDishPx = 24 // sole Han body size (dish + note whole-line bitmap)
	bitmapFontMinPx  = 12
)

func bitmapCellSize(style bitmapTextStyle) (cellW, cellH int) {
	cellW = bitmapCellDotsX
	if style.FontPx > 0 {
		cellH = style.FontPx
		if cellH < bitmapFontMinPx {
			cellH = bitmapFontMinPx
		}
	} else {
		cellH = bitmapCellDotsY
		if style.DoubleH {
			cellH *= 2
		}
	}
	if style.DoubleW {
		cellW *= 2
	}
	return cellW, cellH
}

func bitmapFontPx(style bitmapTextStyle) int {
	if style.FontPx > 0 {
		if style.FontPx < bitmapFontMinPx {
			return bitmapFontMinPx
		}
		return style.FontPx
	}
	_, cellH := bitmapCellSize(style)
	px := cellH - 2
	if px < bitmapFontMinPx {
		return bitmapFontMinPx
	}
	return px
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

// escposBitmapText renders s as one or more GS v 0 rasters. Over-wide strings are
// wrapDisplay'd (never truncateDisplay) so every rune is emitted.
func escposBitmapText(s string, style bitmapTextStyle) []byte {
	s = strings.TrimRight(s, "\r\n")
	if s == "" {
		return nil
	}
	maxCols := bitmapMaxCols(style)
	chunks := wrapDisplay(s, maxCols)
	if len(chunks) == 0 {
		return nil
	}
	var out []byte
	for _, chunk := range chunks {
		out = append(out, escposBitmapTextOne(chunk, style)...)
	}
	return out
}

func escposBitmapTextOne(s string, style bitmapTextStyle) []byte {
	img := renderBitmapText(s, style)
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
