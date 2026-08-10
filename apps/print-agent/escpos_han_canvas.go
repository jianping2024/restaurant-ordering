package main

import "strings"

// Han typography roles — map Latin ESC/POS size tiers to bitmap px (base B = han_bitmap_font_px).
type hanFontRole int

const (
	hanFontSmall hanFontRole = iota // branding / footer ≈ Font A 1×1
	hanFontBody                     // column block + meta ≈ Font A 1×2
	hanFontLarge                    // title / table no. ≈ Font A 2×2
)

func hanFontPxForRole(basePx int, role hanFontRole) int {
	basePx = resolveHanBitmapFontPx(basePx)
	var scaled float64
	switch role {
	case hanFontSmall:
		scaled = float64(basePx) * 0.75
	case hanFontLarge:
		scaled = float64(basePx) * 1.5
	default:
		scaled = float64(basePx)
	}
	px := int(scaled + 0.5)
	if px < bitmapTextMinFontPx {
		return bitmapTextMinFontPx
	}
	if px > bitmapTextMaxFontPx {
		return bitmapTextMaxFontPx
	}
	return px
}

// escposDisplayColToPx maps Font A display columns to fixed 384px canvas coordinates.
func escposDisplayColToPx(col int) int {
	if col <= 0 {
		return 0
	}
	return col * bitmapTextMaxWidthPx / escposWidth
}

func hanQtyColStartPx() int {
	return escposDisplayColToPx(stationSlipQtyColStart(escposWidth))
}

func hanQtyColWidthPx() int {
	return escposDisplayColToPx(stationSlipQtyColWidth)
}

func hanQtyFieldEndPx() int {
	return escposDisplayColToPx(stationSlipQtyColStart(escposWidth) + stationSlipQtyColWidth)
}

func hanColumnGapPx() int {
	return escposDisplayColToPx(1)
}

// hanQtyTextStartPx — right-align s in the 8-col Qty field (Font A column semantics → px).
func hanQtyTextStartPx(s string, fontPx int, bold bool) int {
	if strings.TrimSpace(s) == "" {
		return hanQtyColStartPx()
	}
	fieldEnd := hanQtyFieldEndPx()
	rw := measureHanTextWidth(s, fontPx, bold)
	rx := fieldEnd - rw
	minX := hanQtyColStartPx()
	if rx < minX {
		return minX
	}
	return rx
}

func hanNoteLeftPx() int {
	return escposDisplayColToPx(escposNoteIndentSpaces)
}

func hanNoteMaxPx() int {
	max := hanQtyColStartPx() - hanNoteLeftPx() - hanColumnGapPx()
	if max < 1 {
		return 1
	}
	return max
}

func hanNoteContinuationMaxPx(prefix string, fontPx int, bold bool) int {
	hangPx := hanNoteLeftPx() + measureHanTextWidth(prefix, fontPx, bold)
	max := hanQtyColStartPx() - hangPx - hanColumnGapPx()
	if max < 1 {
		return 1
	}
	return max
}

type hanNoteLine struct {
	x    int
	text string
}

// wrapHanNoteLines — single pixel wrap; first line full width, continuations hang after prefix.
func wrapHanNoteLines(note, prefix string, fontPx int, bold bool) []hanNoteLine {
	note = strings.TrimSpace(note)
	if note == "" {
		return nil
	}
	full := prefix + note
	firstChunks := wrapHanTextByPx(full, hanNoteMaxPx(), fontPx, bold)
	if len(firstChunks) == 0 {
		return nil
	}
	out := []hanNoteLine{{x: hanNoteLeftPx(), text: firstChunks[0]}}
	consumed := len([]rune(firstChunks[0]))
	fullRunes := []rune(full)
	if consumed >= len(fullRunes) {
		return out
	}
	remaining := strings.TrimSpace(string(fullRunes[consumed:]))
	if remaining == "" {
		return out
	}
	hangPx := hanNoteLeftPx() + measureHanTextWidth(prefix, fontPx, bold)
	for _, c := range wrapHanTextByPx(remaining, hanNoteContinuationMaxPx(prefix, fontPx, bold), fontPx, bold) {
		out = append(out, hanNoteLine{x: hangPx, text: c})
	}
	return out
}

type hanColumnRowKind int

const (
	hanColHeader hanColumnRowKind = iota
	hanColItem
)

func hanColumnLeftPx(kind hanColumnRowKind) int {
	if kind == hanColHeader {
		return escposDisplayColToPx(stationSlipSideMargin)
	}
	return escposDisplayColToPx(stationSlipItemLeftMargin)
}

func hanColumnLabelMaxPx(kind hanColumnRowKind) int {
	left := hanColumnLeftPx(kind)
	gap := escposDisplayColToPx(1)
	max := hanQtyColStartPx() - left - gap
	if max < 1 {
		return 1
	}
	return max
}

// stationSlipColumnBlockUsesHanCanvas — Items/Qty block uses one 384px ruler when any line needs Han bitmap.
func stationSlipColumnBlockUsesHanCanvas(p jobPayload, w *escposWriter) bool {
	if w.textMode != escposTextBitmap {
		return false
	}
	for _, ln := range p.Lines {
		if hasHan(stationSlipItemLabel(ln)) || hasHan(strings.TrimSpace(ln.Note)) {
			return true
		}
	}
	return false
}

func lastSpaceRunes(b []rune) int {
	for i := len(b) - 1; i >= 0; i-- {
		if b[i] == ' ' {
			return i
		}
	}
	return -1
}

func wrapHanTextByPx(s string, maxPx, fontPx int, bold bool) []string {
	s = strings.TrimSpace(s)
	if s == "" {
		return nil
	}
	if maxPx <= 0 {
		return []string{s}
	}
	if measureHanTextWidth(s, fontPx, bold) <= maxPx {
		return []string{s}
	}
	var out []string
	var b []rune
	for _, r := range s {
		try := string(append(b, r))
		if len(b) > 0 && measureHanTextWidth(try, fontPx, bold) > maxPx {
			if idx := lastSpaceRunes(b); idx > 0 {
				out = append(out, string(b[:idx]))
				rest := append([]rune(nil), b[idx+1:]...)
				b = append(rest, r)
				continue
			}
			out = append(out, string(b))
			b = []rune{r}
			continue
		}
		b = append(b, r)
	}
	if len(b) > 0 {
		out = append(out, string(b))
	}
	if len(out) == 0 {
		return []string{s}
	}
	return out
}

func escposBitmapRaster(img bitmapTextImage, align byte) []byte {
	if img.Width <= 0 || img.Height <= 0 || len(img.Pixels) != img.Width*img.Height {
		return nil
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
		0x1B, 0x61, align,
		0x1D, 0x76, 0x30, 0x00,
		byte(widthBytes & 0xff), byte((widthBytes >> 8) & 0xff),
		byte(img.Height & 0xff), byte((img.Height >> 8) & 0xff),
	}
	out = append(out, data...)
	out = append(out, '\n')
	return out
}

func escposHanColumnRow(left, right string, kind hanColumnRowKind, fontPx int, style bitmapTextStyle) []byte {
	img := renderBitmapColumnRow(left, right, kind, fontPx, style)
	return escposBitmapRaster(img, style.Align)
}

func escposHanLeftRow(text string, leftPx int, fontPx int, style bitmapTextStyle) []byte {
	img := renderBitmapLeftRow(text, leftPx, fontPx, style)
	return escposBitmapRaster(img, style.Align)
}

// bitmapInkInXBand reports whether any set pixel lies in [startPx, endPx).
func bitmapInkInXBand(img bitmapTextImage, startPx, endPx int) bool {
	if endPx <= startPx {
		return false
	}
	for y := 0; y < img.Height; y++ {
		for x := startPx; x < endPx && x < img.Width; x++ {
			if img.Pixels[y*img.Width+x] != 0 {
				return true
			}
		}
	}
	return false
}

func bitmapInkMaxX(img bitmapTextImage) int {
	maxX := -1
	for y := 0; y < img.Height; y++ {
		for x := 0; x < img.Width; x++ {
			if img.Pixels[y*img.Width+x] != 0 && x > maxX {
				maxX = x
			}
		}
	}
	return maxX
}
