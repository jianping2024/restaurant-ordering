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
		t.Fatalf("display width %d want %d", displayWidth(line), escposWidth)
	}
	runes := []rune(line)
	if runes[stationSlipItemLeftMargin] != '0' {
		t.Fatalf("expected item label at col %d, got %q", stationSlipItemLeftMargin, runes[stationSlipItemLeftMargin])
	}
	qtyCol := padFieldCenter("3", stationSlipQtyColWidth)
	qtyStart := stationSlipQtyColStart(escposWidth)
	// Walk display columns to find qty band.
	col := 0
	var gotQty strings.Builder
	for _, r := range line {
		w := displayCols(r)
		if col >= qtyStart && col < qtyStart+stationSlipQtyColWidth {
			gotQty.WriteRune(r)
		}
		col += w
	}
	if gotQty.String() != qtyCol {
		t.Fatalf("qty band got %q want %q", gotQty.String(), qtyCol)
	}
}

func TestStationSlipItemLineKeepsQtyWithHan(t *testing.T) {
	line := stationSlipItemLine("001-中水", "1", escposWidth)
	if displayWidth(line) != escposWidth {
		t.Fatalf("display width %d want %d", displayWidth(line), escposWidth)
	}
	if !strings.Contains(line, "1") {
		t.Fatalf("qty missing from Han item line: %q", line)
	}
	if !strings.Contains(line, "中水") {
		t.Fatalf("Han label missing: %q", line)
	}
	qtyStart := stationSlipQtyColStart(escposWidth)
	col := 0
	found := false
	for _, r := range line {
		if col >= qtyStart && r == '1' {
			found = true
			break
		}
		col += displayCols(r)
	}
	if !found {
		t.Fatalf("qty not in qty column for %q", line)
	}
}

func TestStationSlipColumnHeaderLayout(t *testing.T) {
	line := stationSlipColumnHeaderLine("Items", "Qty", escposWidth)
	if displayWidth(line) != escposWidth {
		t.Fatalf("display width %d want %d", displayWidth(line), escposWidth)
	}
	runes := []rune(line)
	if runes[stationSlipSideMargin] != 'I' {
		t.Fatalf("expected Items at col %d, got %q", stationSlipSideMargin, runes[stationSlipSideMargin])
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
	han := wrapDisplay("Observação: 我要冰的", 20)
	joined := strings.Join(han, "")
	if !strings.Contains(joined, "我要冰的") {
		t.Fatalf("Han note must survive wrap, got %v", han)
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
	if !strings.Contains(itemLine, "2") {
		t.Fatalf("qty column disturbed: got %q", itemLine)
	}
}

func TestStationTicketHanNoteUsesBitmapFeed(t *testing.T) {
	payload, _ := json.Marshal(jobPayload{
		Locale:           "zh",
		TableDisplayName: "A-01",
		Lines: []jobLine{{
			ItemCode:    "001",
			ItemName:    "中水",
			DisplayName: "001-中水",
			Qty:         1,
			Note:        "我要冰的",
		}},
	})
	raw := escposFromJob(printJob{Type: "station_ticket", Payload: payload})
	if !bytes.Contains(raw, []byte{0x1D, 0x76, 0x30, 0x00}) {
		t.Fatal("expected GS v 0 for Han lines")
	}
	if !bytes.Contains(raw, []byte{0x1B, 0x4A}) {
		t.Fatal("expected ESC J feed after bitmap")
	}
	// Whole-line note (0.3.68): Observação:+Han is one bitmap — must NOT emit Latin prefix then GS v 0.
	obsLatin := encodeWindows1252("Observação: ")
	if idx := bytes.Index(raw, obsLatin); idx >= 0 {
		after := raw[idx+len(obsLatin):]
		if i := bytes.Index(after, []byte{0x1D, 0x76, 0x30, 0x00}); i >= 0 && i < 8 {
			t.Fatal("Han note must not mix Latin Observação: with immediately following GS v 0")
		}
	}
	if bytes.Contains(raw, []byte("…")) {
		t.Fatal("Han note ticket must not truncate with ellipsis")
	}
	dish := renderBitmapText(stationSlipItemLine("001-中水", "1", escposWidth), bitmapTextStyle{FontPx: bitmapFontDishPx})
	if dish.Height != bitmapFontDishPx {
		t.Fatalf("dish bitmap height want %d got %d", bitmapFontDishPx, dish.Height)
	}
	joined := strings.Join(wrapDisplay(escposItemNotePrefix+"我要冰的", stationSlipNoteMaxWidth(escposWidth)), "")
	if joined != escposItemNotePrefix+"我要冰的" {
		t.Fatalf("note wrap must preserve prefix+body, got %q", joined)
	}
}

func TestStationTicketLongHanDishWrapsNoEllipsis(t *testing.T) {
	longName := "红烧茄子加牛肉加豆腐加青椒加洋葱特供"
	payload, _ := json.Marshal(jobPayload{
		Locale:           "zh",
		TableDisplayName: "A-01",
		Lines: []jobLine{{
			ItemCode:    "999",
			ItemName:    longName,
			DisplayName: "999-" + longName,
			Qty:         2,
		}},
	})
	raw := escposFromJob(printJob{Type: "station_ticket", Payload: payload})
	if bytes.Contains(raw, []byte("…")) {
		t.Fatal("long Han dish must wrap, not ellipsis-truncate")
	}
	label := stationSlipItemLabel(jobLine{ItemCode: "999", ItemName: longName})
	chunks := wrapDisplay(label, stationSlipItemMaxWidth(escposWidth))
	joined := strings.Join(chunks, "")
	if joined != label {
		t.Fatalf("wrap must preserve dish label: got %q want %q", joined, label)
	}
	if len(chunks) < 2 {
		t.Fatalf("fixture should wrap, got %d chunks", len(chunks))
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
