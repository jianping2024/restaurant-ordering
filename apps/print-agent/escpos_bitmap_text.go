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
	out = append(out, '\n')
	return out
}
