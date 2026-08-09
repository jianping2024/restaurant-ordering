package main

import (
	"bytes"
	"testing"
)

func TestRenderBitmapTextHasInkForHan(t *testing.T) {
	img := renderBitmapText("打印测试", bitmapTextStyle{Align: 1, Bold: true, DoubleW: true, DoubleH: true})
	if img.Width <= 0 || img.Height <= 0 {
		t.Fatalf("expected image, got %dx%d", img.Width, img.Height)
	}
	// DoubleH must not enlarge Han font — sole size is bitmapTextBaseFontPx (+padding).
	if img.Height > bitmapTextBaseFontPx+16 {
		t.Fatalf("Han height should stay near %dpx, got %d", bitmapTextBaseFontPx, img.Height)
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
	raw := escposBitmapText("打印测试", bitmapTextStyle{Align: 1})
	if rasterInkBits(raw) == 0 {
		t.Fatal("escposBitmapText must emit non-blank GS v 0 payload")
	}
}

func TestEscposBitmapTextWrapsLongHanNoEllipsis(t *testing.T) {
	long := stringsRepeatHan(40)
	raw := escposBitmapText(long, bitmapTextStyle{})
	if bytes.Contains(raw, []byte("…")) {
		t.Fatal("bitmap path must not emit ellipsis truncation")
	}
	gs := bytes.Count(raw, []byte{0x1D, 0x76, 0x30, 0x00})
	if gs < 2 {
		t.Fatalf("long Han must wrap into multiple GS v 0, got %d", gs)
	}
}

func stringsRepeatHan(n int) string {
	var b []rune
	for i := 0; i < n; i++ {
		b = append(b, '测')
	}
	return string(b)
}
