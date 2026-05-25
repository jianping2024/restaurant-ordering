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
		TableNumber:    32,
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
		"Table No.:32",
		"Guest:4",
		"Items",
		"Qty",
		"(Bebidas/ Drinks2)",
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
}

func TestStationTicketNeedsGBKIgnoresRestaurantName(t *testing.T) {
	if stationTicketNeedsGBK(jobPayload{RestaurantName: "川味", Lines: []jobLine{{DisplayName: "Coca Cola"}}}) {
		t.Fatal("ASCII menu should not require GBK on station slip")
	}
	if !stationTicketNeedsGBK(jobPayload{Lines: []jobLine{{DisplayName: "宫保鸡丁"}}}) {
		t.Fatal("Chinese menu name should require GBK")
	}
}
