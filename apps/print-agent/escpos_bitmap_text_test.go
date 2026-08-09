package main

import (
	"bytes"
	"testing"
)

func TestRenderBitmapTextHasInkForHan(t *testing.T) {
	img := renderBitmapText("打印测试", bitmapTextStyle{Align: 1, Bold: true, DoubleH: true})
	if img.Width <= 0 || img.Height <= 0 {
		t.Fatalf("expected image, got %dx%d", img.Width, img.Height)
	}
	if img.Height != bitmapCellDotsY*2 {
		t.Fatalf("DoubleH height want %d got %d", bitmapCellDotsY*2, img.Height)
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
	raw := escposBitmapText("打印测试", bitmapTextStyle{Align: 1})
	if rasterInkBits(raw) == 0 {
		t.Fatal("escposBitmapText must emit non-blank GS v 0 payload")
	}
	if !bytes.Contains(raw, []byte{0x1B, 0x4A}) {
		t.Fatal("expected ESC J after raster")
	}
}
