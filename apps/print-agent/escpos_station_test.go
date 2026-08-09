package main

import (
	"bytes"
	"encoding/json"
	"strings"
	"testing"
)

func TestBuildStationTicketEnglishLayout(t *testing.T) {
	payload, err := json.Marshal(jobPayload{
		Locale:           "pt",
		RestaurantName:   "川味餐厅",
		TableDisplayName: "A-32",
		GuestCount:       4,
		OrderTime:        "2026-05-14 20:15",
		StationSlipOptions: &stationSlipOptions{
			ShowCategoryGroup: true,
		},
		Lines: []jobLine{
			{
				ItemIndex:           1,
				ItemCode:            "001",
				ItemName:            "Água 500ml",
				DisplayName:         "001-Água 500ml",
				Qty:                 1,
				CategoryGroupSort:   0,
				CategoryGroupHeader: "(Bebidas/ Drinks2)",
			},
			{
				ItemIndex:           7,
				ItemCode:            "007",
				ItemName:            "Coca Cola Zero",
				DisplayName:         "007-Coca Cola Zero",
				Qty:                 1,
				CategoryGroupSort:   0,
				CategoryGroupHeader: "(Bebidas/ Drinks2)",
			},
		},
	})
	if err != nil {
		t.Fatal(err)
	}
	raw := escposFromJob(printJob{Type: "station_ticket", Payload: payload})
	s := string(raw)
	for _, bad := range []string{"Mesa", "Pedido", "Estacao", "Estação", "Artigos", "Hora impressao", "Print Time"} {
		if strings.Contains(s, bad) {
			t.Fatalf("station ticket must not contain %q", bad)
		}
	}
	for _, want := range []string{
		"restaurant",
		"Guest Order",
		"Table No.:A-32",
		"Guest:4",
		"Items",
		"Qty",
		"(Bebidas/ Drinks2)",
		"001-",
		"500ml",
		"007-Coca Cola Zero",
		"Order Time:",
		"Printed By:restaurant",
	} {
		if !strings.Contains(s, want) {
			t.Fatalf("missing %q in ticket output", want)
		}
	}

	if bytes.Contains(raw, []byte{0xC1}) || bytes.Contains(raw, []byte{0xE1}) {
		// Windows-1252 Á/á when present in payload.
	} else {
		t.Fatalf("expected Windows-1252 accented bytes in ticket output")
	}

	idx := bytes.Index(raw, []byte("Items"))
	if idx < 0 {
		t.Fatal(`missing "Items" column header`)
	}
	if !bytes.Contains(raw[idx:], []byte{0x1D, 0x21, 0x01}) {
		t.Fatal("menu body must use GS ! 1×2 after column headers")
	}
	if bytes.Contains(raw[idx:], []byte{0x1D, 0x21, 0x11}) {
		t.Fatal("menu body must not use GS ! 2×2 after column headers")
	}
}

func TestStationSlipSkipsCategoryHeaderWhenDisabled(t *testing.T) {
	payload, _ := json.Marshal(jobPayload{
		TableDisplayName: "1",
		StationSlipOptions: &stationSlipOptions{
			ShowCategoryGroup: false,
		},
		Lines: []jobLine{{
			ItemCode:            "001",
			ItemName:            "Soup",
			DisplayName:         "001-Soup",
			Qty:                 1,
			CategoryGroupHeader: "(Bebidas/ Drinks2)",
		}},
	})
	raw := escposFromJob(printJob{Type: "station_ticket", Payload: payload})
	if strings.Contains(string(raw), "(Bebidas/ Drinks2)") {
		t.Fatal("category header must not print when show_category_group is false")
	}
}

func TestStationSlipItemLineLayout(t *testing.T) {
	line := stationSlipItemLine("001-Agua 500ml", "3", escposWidth)
	if displayWidth(line) != escposWidth {
		t.Fatalf("line display width %d want %d", displayWidth(line), escposWidth)
	}
	runes := []rune(line)
	if runes[stationSlipItemLeftMargin] != '0' {
		t.Fatalf("expected item label at col %d, got %q", stationSlipItemLeftMargin, runes[stationSlipItemLeftMargin])
	}
	qtyCol := []rune(padFieldCenter("3", stationSlipQtyColWidth))
	qtyStart := stationSlipQtyColStart(escposWidth)
	for i, c := range qtyCol {
		if runes[qtyStart+i] != c {
			t.Fatalf("expected centered qty at col %d: got %q want %q", qtyStart, string(runes[qtyStart:qtyStart+len(qtyCol)]), string(qtyCol))
		}
	}
	for i := len(runes) - stationSlipSideMargin; i < len(runes); i++ {
		if runes[i] != ' ' {
			t.Fatalf("expected right margin %d cols", stationSlipSideMargin)
		}
	}
}

// Han item+qty: sole stationSlipItemLine layout at bitmap cols; Qty stays on first display row.
func TestStationSlipItemLineHanQtyOnFirstBitmapRow(t *testing.T) {
	fontPx := bitmapTextDefaultFontPx
	width := bitmapMaxDisplayCols(fontPx)
	maxLeft := stationSlipItemMaxWidth(width)
	labels := []string{"002-冰水 500毫升", "003-冰Vitalis 750ml"}
	for _, label := range labels {
		chunks := wrapDisplay(label, maxLeft)
		if len(chunks) == 0 {
			t.Fatalf("empty wrap for %q", label)
		}
		line := stationSlipItemLine(chunks[0], "1", width)
		if displayWidth(line) != width {
			t.Fatalf("%q line display width %d want %d (%q)", label, displayWidth(line), width, line)
		}
		// Must not re-wrap inside escposBitmapText (that dropped Qty onto the next left-aligned row).
		wrapped := wrapDisplay(line, width)
		if len(wrapped) != 1 {
			t.Fatalf("%q first row re-wrapped into %v", label, wrapped)
		}
		qtyField := padFieldCenter("1", stationSlipQtyColWidth)
		qtyStart := stationSlipQtyColStart(width)
		prefix := displaySlice(line, 0, qtyStart)
		gotQty := displaySlice(line, qtyStart, qtyStart+stationSlipQtyColWidth)
		if strings.Contains(prefix, "1") && !strings.Contains(chunks[0], "1") {
			t.Fatalf("%q qty leaked into label band: %q", label, prefix)
		}
		if gotQty != qtyField {
			t.Fatalf("%q qty band got %q want %q (line=%q)", label, gotQty, qtyField, line)
		}
		for _, cont := range chunks[1:] {
			contLine := strings.Repeat(" ", stationSlipItemLeftMargin) + cont
			if displayWidth(contLine) > width {
				t.Fatalf("continuation wider than canvas: %q", contLine)
			}
			if strings.TrimSpace(cont) == "1" {
				t.Fatalf("qty must not be a continuation chunk for %q", label)
			}
		}
	}
}

// displaySlice returns the substring covering display columns [start, end).
func displaySlice(s string, start, end int) string {
	if end <= start || start < 0 {
		return ""
	}
	var b []rune
	col := 0
	for _, r := range s {
		cw := displayCols(r)
		next := col + cw
		if next <= start {
			col = next
			continue
		}
		if col >= end {
			break
		}
		b = append(b, r)
		col = next
		if col >= end {
			break
		}
	}
	return string(b)
}

func TestStationSlipColumnHeaderLayout(t *testing.T) {
	line := stationSlipColumnHeaderLine("Items", "Qty", escposWidth)
	runes := []rune(line)
	if runes[stationSlipSideMargin] != 'I' {
		t.Fatalf("expected Items at col %d (Guest 't'), got %q", stationSlipSideMargin, runes[stationSlipSideMargin])
	}
	qtyCol := []rune(padFieldCenter("Qty", stationSlipQtyColWidth))
	qtyStart := stationSlipQtyColStart(escposWidth)
	for i, c := range qtyCol {
		if runes[qtyStart+i] != c {
			t.Fatalf("expected centered Qty header at col %d: got %q want %q", qtyStart, string(runes[qtyStart:qtyStart+len(qtyCol)]), string(qtyCol))
		}
	}
}

func TestStationTicketItemNoteUsesUnderline(t *testing.T) {
	payload, _ := json.Marshal(jobPayload{
		TableDisplayName: "A-1",
		Lines: []jobLine{{
			ItemCode:    "001",
			ItemName:    "Soup",
			DisplayName: "001-Soup",
			Qty:         1,
			Note:        "no onion",
		}},
	})
	raw := escposFromJob(printJob{Type: "station_ticket", Payload: payload})
	labelIdx := bytes.Index(raw, []byte("Observ"))
	if labelIdx < 0 {
		t.Fatal("missing Observação: prefix")
	}
	prefix := raw[max(0, labelIdx-4):labelIdx]
	if !bytes.Contains(prefix, []byte{0x1B, 0x2D, 0x01}) {
		t.Fatal("expected ESC - 1 underline before item note")
	}
	if !bytes.Contains(raw, []byte("Observ")) || !bytes.Contains(raw, []byte(": no onion")) {
		t.Fatal("expected Observação: prefix before item note")
	}
}

func TestWrapDisplay(t *testing.T) {
	if got := wrapDisplay("", 10); got != nil {
		t.Fatalf("empty want nil, got %v", got)
	}
	if got := wrapDisplay("ab", 0); got != nil {
		t.Fatalf("max<=0 want nil, got %v", got)
	}
	got := wrapDisplay("abcdefghij", 4)
	want := []string{"abcd", "efgh", "ij"}
	if len(got) != len(want) {
		t.Fatalf("len got %v want %v", got, want)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("got %v want %v", got, want)
		}
	}
	// Han = 2 cols
	han := wrapDisplay("测试测试测试", 4)
	if len(han) < 2 {
		t.Fatalf("Han wrap want >=2 chunks, got %v", han)
	}
	for _, c := range han {
		if displayWidth(c) > 4 {
			t.Fatalf("chunk %q wider than 4 cols", c)
		}
	}
}

func TestStationSlipNoteMaxWidthLeftOfQty(t *testing.T) {
	maxW := stationSlipNoteMaxWidth(escposWidth)
	if escposNoteIndentSpaces+maxW > stationSlipQtyColStart(escposWidth) {
		t.Fatalf("note text band overlaps qty column: indent=%d max=%d qtyStart=%d",
			escposNoteIndentSpaces, maxW, stationSlipQtyColStart(escposWidth))
	}
}

func TestStationTicketItemNoteWrapsFullText(t *testing.T) {
	note := "2 pacotes de acucar 1 pacote de leite em po sem canela e bem quente por favor"
	full := escposItemNotePrefix + note
	maxW := stationSlipNoteMaxWidth(escposWidth)
	chunks := wrapDisplay(full, maxW)
	if len(chunks) < 2 {
		t.Fatal("fixture note too short to exercise wrap")
	}
	payload, _ := json.Marshal(jobPayload{
		TableDisplayName: "068",
		Lines: []jobLine{{
			ItemCode:    "903",
			ItemName:    "Cafe",
			DisplayName: "903-Cafe",
			Qty:         2,
			Note:        note,
		}},
	})
	raw := escposFromJob(printJob{Type: "station_ticket", Payload: payload})
	for _, chunk := range chunks {
		enc := encodeWindows1252(chunk)
		if !bytes.Contains(raw, enc) {
			t.Fatalf("missing wrapped note chunk %q", chunk)
		}
	}
	if bytes.Contains(raw, []byte("…")) {
		t.Fatal("station note must not use ellipsis truncation")
	}
	itemLine := stationSlipItemLine("903-Cafe", "2", escposWidth)
	qtyStart := stationSlipQtyColStart(escposWidth)
	qtyCol := []rune(padFieldCenter("2", stationSlipQtyColWidth))
	runes := []rune(itemLine)
	for i, c := range qtyCol {
		if runes[qtyStart+i] != c {
			t.Fatalf("qty column disturbed: got %q", itemLine)
		}
	}
}

func TestStationTicketLongZhNameWrapsNoEllipsis(t *testing.T) {
	longName := "超长中文菜名测试一二三四五六七八九十甲乙丙丁戊己庚辛"
	payload, _ := json.Marshal(jobPayload{
		Locale:           "zh",
		TableDisplayName: "A-01",
		Lines: []jobLine{{
			ItemCode:    "001",
			ItemName:    longName,
			DisplayName: "001-" + longName,
			Qty:         1,
			Note:        "我要冰的备注要打全",
		}},
	})
	raw := escposFromJob(printJob{Type: "station_ticket", Payload: payload})
	if bytes.Contains(raw, []byte("…")) {
		t.Fatal("zh station slip must not ellipsis-truncate menu or note")
	}
	if !bytes.Contains(raw, []byte{0x1D, 0x76, 0x30, 0x00}) {
		t.Fatal("expected GS v 0 for zh menu")
	}
	if bytes.Count(raw, []byte{0x1D, 0x76, 0x30, 0x00}) < 2 {
		t.Fatal("long zh name+note should emit multiple bitmaps")
	}
}

func TestStationTicketUsesLatinEncodingOnly(t *testing.T) {
	payload, _ := json.Marshal(jobPayload{
		Lines: []jobLine{{
			ItemCode:    "001",
			ItemName:    "宫保鸡丁",
			DisplayName: "001-宫保鸡丁",
			Qty:         1,
		}},
	})
	raw := escposFromJob(printJob{Type: "station_ticket", Payload: payload})
	if bytes.Contains(raw, []byte{0x1C, 0x26}) {
		t.Fatal("station slip must not enter GBK mode")
	}
}
