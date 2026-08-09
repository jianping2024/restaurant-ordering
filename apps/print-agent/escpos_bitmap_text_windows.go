//go:build windows

package main

import (
	"syscall"
	"unsafe"
)

type gdiBitmapInfoHeader struct {
	Size          uint32
	Width         int32
	Height        int32
	Planes        uint16
	BitCount      uint16
	Compression   uint32
	SizeImage     uint32
	XPelsPerMeter int32
	YPelsPerMeter int32
	ClrUsed       uint32
	ClrImportant  uint32
}
type gdiRGBQuad struct{ Blue, Green, Red, Reserved byte }
type gdiBitmapInfo struct {
	Header gdiBitmapInfoHeader
	Colors [2]gdiRGBQuad
}

var (
	gdi32                  = syscall.NewLazyDLL("gdi32.dll")
	procCreateCompatibleDC = gdi32.NewProc("CreateCompatibleDC")
	procDeleteDC           = gdi32.NewProc("DeleteDC")
	procCreateFontW        = gdi32.NewProc("CreateFontW")
	procSelectObject       = gdi32.NewProc("SelectObject")
	procDeleteObject       = gdi32.NewProc("DeleteObject")
	procCreateDIBSection   = gdi32.NewProc("CreateDIBSection")
	procSetBkColor         = gdi32.NewProc("SetBkColor")
	procSetTextColor       = gdi32.NewProc("SetTextColor")
	procSetBkMode          = gdi32.NewProc("SetBkMode")
	procTextOutW           = gdi32.NewProc("TextOutW")
)

// renderBitmapText draws s into a cell grid. Caller must wrap to bitmapMaxCols;
// this function does not truncateDisplay (overflow runes still advance by displayCols).
func renderBitmapText(s string, style bitmapTextStyle) bitmapTextImage {
	if s == "" {
		return bitmapTextImage{}
	}
	cellW, cellH := bitmapCellSize(style)
	cols := displayWidth(s)
	if cols <= 0 {
		return bitmapTextImage{}
	}
	width := cols * cellW
	height := cellH
	fontPx := bitmapFontPx(style)

	dc, _, _ := procCreateCompatibleDC.Call(0)
	if dc == 0 {
		return bitmapTextImage{}
	}
	defer procDeleteDC.Call(dc)

	var bits unsafe.Pointer
	stride := ((width*32 + 31) / 32) * 4
	bi := gdiBitmapInfo{}
	bi.Header.Size = uint32(unsafe.Sizeof(bi.Header))
	bi.Header.Width = int32(width)
	bi.Header.Height = -int32(height)
	bi.Header.Planes = 1
	bi.Header.BitCount = 32
	bitmap, _, _ := procCreateDIBSection.Call(dc, uintptr(unsafe.Pointer(&bi)), 0, uintptr(unsafe.Pointer(&bits)), 0, 0)
	if bitmap == 0 || bits == nil {
		return bitmapTextImage{}
	}
	defer procDeleteObject.Call(bitmap)
	oldBitmap, _, _ := procSelectObject.Call(dc, bitmap)
	defer procSelectObject.Call(dc, oldBitmap)

	raw := unsafe.Slice((*byte)(bits), stride*height)
	for i := range raw {
		raw[i] = 0xff
	}

	procSetBkColor.Call(dc, 0x00ffffff)
	procSetTextColor.Call(dc, 0x00000000)
	procSetBkMode.Call(dc, 2)

	weight := uintptr(400)
	if style.Bold {
		weight = 700
	}
	face, _ := syscall.UTF16PtrFromString("Microsoft YaHei")
	underline := boolToUintptr(style.Underline)

	col := 0
	y := 1
	for _, r := range s {
		span := displayCols(r)
		slotW := span * cellW
		// Force glyph into its display-column slot so tall fonts (24) do not spill past 2×8.
		font, _, _ := procCreateFontW.Call(
			uintptr(^uint32(fontPx-1)+1), uintptr(slotW), 0, 0, weight, 0, underline, 0,
			1, 4, 0, 0, 0, uintptr(unsafe.Pointer(face)),
		)
		if font != 0 {
			oldFont, _, _ := procSelectObject.Call(dc, font)
			utf16, err := syscall.UTF16FromString(string(r))
			if err == nil && len(utf16) > 1 {
				procTextOutW.Call(dc, uintptr(col*cellW), uintptr(y), uintptr(unsafe.Pointer(&utf16[0])), uintptr(len(utf16)-1))
			}
			procSelectObject.Call(dc, oldFont)
			procDeleteObject.Call(font)
		}
		col += span
	}

	pixels := make([]byte, width*height)
	for y := 0; y < height; y++ {
		for x := 0; x < width; x++ {
			off := y*stride + x*4
			if raw[off] < 128 || raw[off+1] < 128 || raw[off+2] < 128 {
				pixels[y*width+x] = 1
			}
		}
	}
	return bitmapTextImage{Width: width, Height: height, Pixels: pixels}
}

func boolToUintptr(v bool) uintptr {
	if v {
		return 1
	}
	return 0
}
