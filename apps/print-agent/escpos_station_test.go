package main

import (
	"bytes"
	"encoding/json"
	"strings"
	"testing"
)

func TestBuildStationTicketEnglishLayout(t *testing.T) {
	payload, err := json.Marshal(jobPayload{
		Locale:         "pt",
		RestaurantName: "川味餐厅",
		TableDisplayName: "A-32",
		GuestCount:     4,
		OrderTime:      "2026-05-14 20:15",
		Lines: []jobLine{
			{
				ItemIndex:           1,
				DisplayName:         "001-Água 500ml",
				Qty:                 1,
				CategoryGroupSort:   0,
				CategoryGroupHeader: "(Bebidas/ Drinks2)",
			},
			{
				ItemIndex:           7,
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
	s := string(raw) // includes control bytes, but useful for ASCII checks
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
		"  (Bebidas/ Drinks2)",
		"001-",
		"500ml",
		"007-Coca Cola Zero",
		"Order Time:",
		"Printed By:Customer/Merchant",
	} {
		if !strings.Contains(s, want) {
			t.Fatalf("missing %q in ticket output", want)
		}
	}

	// Ensure Windows-1252 bytes for Á/á were emitted (not UTF-8).
	// Á = 0xC1, á = 0xE1 in Windows-1252.
	if !bytes.Contains(raw, []byte{0xC1}) && !bytes.Contains(raw, []byte{0xE1}) {
		t.Fatalf("expected Windows-1252 accented bytes in ticket output")
	}

	// Masthead (title + table) uses 2×2; menu body stays Font A 1×1 like pre-bill items.
	idx := bytes.Index(raw, []byte("Items"))
	if idx < 0 {
		t.Fatal(`missing "Items" column header`)
	}
	if bytes.Contains(raw[idx:], []byte{0x1D, 0x21, 0x11}) {
		t.Fatal("menu body must not use GS ! 2×2 after column headers")
	}
}

func TestStationTicketItemNoteUsesUnderline(t *testing.T) {
	payload, _ := json.Marshal(jobPayload{
		TableDisplayName: "A-1",
		Lines: []jobLine{{
			DisplayName: "Soup",
			Qty:         1,
			Note:        "no onion",
		}},
	})
	raw := escposFromJob(printJob{Type: "station_ticket", Payload: payload})
	noteIdx := bytes.Index(raw, []byte("no onion"))
	if noteIdx < 0 {
		t.Fatal("missing note text")
	}
	prefix := raw[max(0, noteIdx-4):noteIdx]
	if !bytes.Contains(prefix, []byte{0x1B, 0x2D, 0x01}) {
		t.Fatal("expected ESC - 1 underline before item note")
	}
}

func TestStationTicketNeedsGBKIgnoresRestaurantName(t *testing.T) {
	if stationTicketNeedsGBK(jobPayload{RestaurantName: "川味", Lines: []jobLine{{DisplayName: "Coca Cola"}}}) {
		t.Fatal("ASCII menu should not require GBK on station slip")
	}
	if !stationTicketNeedsGBK(jobPayload{Lines: []jobLine{{DisplayName: "宫保鸡丁"}}}) {
		t.Fatal("Chinese menu name should require GBK")
	}
}
