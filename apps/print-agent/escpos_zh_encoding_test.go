package main

import (
	"bytes"
	"encoding/json"
	"testing"
)

func TestBuildConnectionTestZHUsesGBKBytes(t *testing.T) {
	payload, _ := json.Marshal(jobPayload{
		ConnectionTest: true,
		Locale:         "zh",
		RestaurantName: "mesa.example.com",
	})
	raw := escposFromJob(printJob{Type: "order_receipt", Payload: payload})

	if !bytes.Contains(raw, []byte{0x1C, 0x26}) {
		t.Fatal("expected FS & (Chinese mode) in connection test output")
	}
	if !bytes.Contains(raw, []byte{0x1C, 0x43, 0x01}) {
		t.Fatal("expected FS C 1 (GBK table) in connection test output")
	}
	want := encodeGBK("打印测试")
	if !bytes.Contains(raw, want) {
		t.Fatalf("expected GBK headline % x in output", want)
	}
}

func TestBuildStationTicketZHLocaleUsesGBK(t *testing.T) {
	payload, _ := json.Marshal(jobPayload{
		Locale:           "zh",
		TableDisplayName: "8",
		Lines:            []jobLine{{DisplayName: "Cola", Qty: 1}},
	})
	raw := escposFromJob(printJob{Type: "station_ticket", Payload: payload})
	if !bytes.Contains(raw, []byte{0x1C, 0x26}) {
		t.Fatal("zh locale station ticket should enter Chinese mode even for ASCII menu lines")
	}
	want := encodeGBK("出菜单")
	if !bytes.Contains(raw, want) {
		t.Fatalf("expected zh header % x", want)
	}
}

func TestNormalizePrintLocale(t *testing.T) {
	if normalizePrintLocale("zh-CN") != "zh" {
		t.Fatal("zh-CN")
	}
	if normalizePrintLocale("") != "pt" {
		t.Fatal("empty defaults to pt")
	}
}
