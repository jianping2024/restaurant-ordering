package main

import "testing"

func TestRenderBitmapTextHasInkForHan(t *testing.T) {
	img := renderBitmapText("打印测试", bitmapTextStyle{Align: 1, Bold: true, DoubleW: true, DoubleH: true})
	if img.Width <= 0 || img.Height <= 0 {
		t.Fatalf("expected image, got %dx%d", img.Width, img.Height)
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
