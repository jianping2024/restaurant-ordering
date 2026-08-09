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

// Han bitmap TrueType size: default when job omits han_bitmap_font_px; clamp matches web.
const (
	bitmapTextDefaultFontPx = 24
	bitmapTextMinFontPx     = 16
	bitmapTextMaxFontPx     = 40
	bitmapTextMaxWidthPx    = 384
)

func resolveHanBitmapFontPx(n int) int {
	if n < bitmapTextMinFontPx {
		if n <= 0 {
			return bitmapTextDefaultFontPx
		}
		return bitmapTextMinFontPx
	}
	if n > bitmapTextMaxFontPx {
		return bitmapTextMaxFontPx
	}
	return n
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
func escposBitmapText(s string, style bitmapTextStyle, fontPx int) []byte {
	s = strings.TrimRight(s, "\r\n")
	if s == "" {
		return nil
	}
	fontPx = resolveHanBitmapFontPx(fontPx)
	maxCols := bitmapMaxDisplayCols(fontPx)
	chunks := wrapDisplay(s, maxCols)
	if len(chunks) == 0 {
		return nil
	}
	var out []byte
	for _, chunk := range chunks {
		out = append(out, escposBitmapTextOne(chunk, style, fontPx)...)
	}
	return out
}

func escposBitmapTextOne(s string, style bitmapTextStyle, fontPx int) []byte {
	img := renderBitmapText(s, style, fontPx)
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
	out = append(out, '\n')
	return out
}
