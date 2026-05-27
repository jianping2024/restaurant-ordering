package main

import (
	"bytes"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

func TestBuildConnectionTestZHUsesGBKByDefault(t *testing.T) {
	payload, _ := json.Marshal(jobPayload{
		ConnectionTest: true,
		Locale:         "zh",
		RestaurantName: "mesa.example.com",
	})
	raw := escposFromJob(printJob{Type: "order_receipt", Payload: payload})

	want := encodeGBK("打印测试")
	headIdx := bytes.Index(raw, want)
	if headIdx < 0 {
		t.Fatalf("expected GBK headline % x in output", want)
	}
	if !bytes.Contains(raw[:headIdx], []byte{0x1C, 0x26}) {
		t.Fatal("expected FS & before Chinese headline")
	}
	venue := []byte("mesa.example.com")
	venueIdx := bytes.Index(raw, venue)
	if venueIdx < 0 {
		t.Fatal("expected venue line")
	}
	if !bytes.Contains(raw[headIdx:venueIdx], []byte{0x1C, 0x2E}) {
		t.Fatal("expected FS . before ASCII venue line after Chinese")
	}
	if bytes.Contains(raw, []byte{0x1B, 0x39, 0x01}) {
		t.Fatal("auto mode should not use ESC 9 UTF-8 on connection test")
	}
	if bytes.Contains(raw, []byte{0x1C, 0x21, 0x0F}) {
		t.Fatal("GBK connection test should not use FS ! enlarge (UNYKA USB)")
	}
	if bytes.Contains(raw, []byte{0x1D, 0x21, 0x11}) {
		t.Fatal("GBK connection test should not use GS ! double-size")
	}
}

func TestBuildConnectionTestZHUsesUTF8WhenConfigured(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "config.json")
	if err := os.WriteFile(path, []byte(`{"agentjwt":"x","text_encoding":"utf8"}`), 0o600); err != nil {
		t.Fatal(err)
	}
	prev := configPathOverride
	configPathOverride = path
	defer func() { configPathOverride = prev }()

	payload, _ := json.Marshal(jobPayload{
		ConnectionTest: true,
		Locale:         "zh",
	})
	raw := escposFromJob(printJob{Type: "order_receipt", Payload: payload})
	if !bytes.Contains(raw, []byte{0x1B, 0x39, 0x01}) {
		t.Fatal("expected ESC 9 when text_encoding=utf8")
	}
	want := []byte("打印测试")
	if !bytes.Contains(raw, want) {
		t.Fatalf("expected UTF-8 headline % x", want)
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
		t.Fatal("zh locale station ticket should use GBK by default")
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
