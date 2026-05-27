package main

import (
	"strings"
	"testing"
)

func TestEncodeWindows1252Portuguese(t *testing.T) {
	raw := encodeWindows1252("ção")
	if len(raw) != 3 || raw[0] != 0xe7 || raw[1] != 0xe3 || raw[2] != 0x6f {
		t.Fatalf("Windows-1252 encoding: got % x", raw)
	}
}

func TestEncodeGBKChinese(t *testing.T) {
	raw := encodeGBK("川味")
	if len(raw) < 4 {
		t.Fatalf("GBK encoding too short: % x", raw)
	}
}

func TestPayloadNeedsGBK(t *testing.T) {
	if !payloadNeedsGBK(jobPayload{Locale: "pt", RestaurantName: "川味"}) {
		t.Fatal("expected GBK for Chinese restaurant name")
	}
	if payloadNeedsGBK(jobPayload{Locale: "pt", RestaurantName: "Mesa"}) {
		t.Fatal("expected Latin for ASCII-only pt payload")
	}
}

func TestReceiptTicketNeedsGBKPayer(t *testing.T) {
	if !receiptTicketNeedsGBK(jobPayload{PayerName: "王小明"}) {
		t.Fatal("expected GBK for custom Chinese payer name")
	}
	if receiptTicketNeedsGBK(jobPayload{PayerName: "2", Lines: []jobLine{{DisplayName: "Soup"}}}) {
		t.Fatal("expected Latin for numeric placeholder payer")
	}
	if receiptTicketNeedsGBK(jobPayload{PayerName: "客人 2", Lines: []jobLine{{DisplayName: "Soup"}}}) {
		t.Fatal("split placeholder payer should use Latin after formatting")
	}
}

func TestReceiptTicketNeedsGBKIgnoresRestaurantName(t *testing.T) {
	if receiptTicketNeedsGBK(jobPayload{
		RestaurantName: "川味餐厅",
		Lines:          []jobLine{{DisplayName: "Chá camomila"}},
	}) {
		t.Fatal("Portuguese menu with Chinese restaurant_name in payload must stay Latin")
	}
}

func TestConnectionTestNeedsGBK(t *testing.T) {
	if !connectionTestNeedsGBK(jobPayload{RestaurantName: "川味"}) {
		t.Fatal("connection test should use GBK when venue name has Han")
	}
	if !connectionTestNeedsGBK(jobPayload{Locale: "zh", RestaurantName: "restaurant-ordering.vercel.app"}) {
		t.Fatal("zh locale test slip needs GBK for 打印测试 headline")
	}
	if connectionTestNeedsGBK(jobPayload{Locale: "en", RestaurantName: "Mesa Lisboa"}) {
		t.Fatal("en locale + ASCII venue should use Latin on connection test")
	}
}

func TestFormatSplitPayerForReceipt(t *testing.T) {
	if got := formatSplitPayerForReceipt("客人 2"); got != "2" {
		t.Fatalf("客人 2: got %q", got)
	}
	if got := formatSplitPayerForReceipt("Guest 3"); got != "3" {
		t.Fatalf("Guest 3: got %q", got)
	}
	if got := formatSplitPayerForReceipt("Maria"); got != "Maria" {
		t.Fatalf("custom name: got %q", got)
	}
}

func TestEncodeWindows1252OmitsUnmappable(t *testing.T) {
	raw := encodeWindows1252("客人")
	if strings.Contains(string(raw), "?") {
		t.Fatalf("must not emit question marks, got %q", raw)
	}
}
