package main

import (
	"bytes"
	"testing"
)

func TestRenderBitmapTextHasInkForHan(t *testing.T) {
	img := renderBitmapText("打印测试", bitmapTextStyle{Align: 1, Bold: true, FontPx: bitmapFontDishPx})
	if img.Width <= 0 || img.Height <= 0 {
		t.Fatalf("expected image, got %dx%d", img.Width, img.Height)
	}
	if img.Height != bitmapFontDishPx {
		t.Fatalf("dish FontPx height want %d got %d", bitmapFontDishPx, img.Height)
	}
	if img.Width > escposWidth*bitmapCellDotsX {
		t.Fatalf("Han bitmap must not exceed paper width: %d", img.Width)
	}
	ink := 0
	for _, p := range img.Pixels {
		if p != 0 {
			ink++
		}
	}
	if ink == 0 {
		t.Fatal("Han bitmap must contain ink pixels")
	}
	raw := escposBitmapText("打印测试", bitmapTextStyle{Align: 1, FontPx: bitmapFontDishPx})
	if rasterInkBits(raw) == 0 {
		t.Fatal("escposBitmapText must emit non-blank GS v 0 payload")
	}
	if !bytes.Contains(raw, []byte{0x1B, 0x4A}) {
		t.Fatal("expected ESC J after raster")
	}
}

func TestEscposBitmapTextWrapsNeverTruncates(t *testing.T) {
	// Wider than one paper line in display cols — must wrap, no ellipsis.
	long := stringsRepeatHan(40) // 80 display cols
	raw := escposBitmapText(long, bitmapTextStyle{FontPx: bitmapFontDishPx})
	if bytes.Contains(raw, []byte("…")) || bytes.Contains(raw, []byte{0xe2, 0x80, 0xa6}) {
		t.Fatal("bitmap path must not emit ellipsis truncation")
	}
	gsCount := bytes.Count(raw, []byte{0x1D, 0x76, 0x30, 0x00})
	if gsCount < 2 {
		t.Fatalf("expected multiple rasters for wrap, got %d", gsCount)
	}
}

func stringsRepeatHan(n int) string {
	var b []rune
	for i := 0; i < n; i++ {
		b = append(b, '中')
	}
	return string(b)
}
