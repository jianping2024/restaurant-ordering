package main

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestBuildOrderReceiptEnglishLayout(t *testing.T) {
	payloadMap := jobPayload{
		Locale:           "pt",
		RestaurantName:   "川味餐厅",
		TableDisplayName: "1",
		GuestCount:       4,
		OrderTime:        "2026-05-14 20:05",
		PrintTime:        "2026-05-14 21:01",
		Subtotal:         13.75,
		AmountDue:        13.75,
		AmountPaid:       13.75,
		PaymentMethod:    "Cash",
		ReceiptVariant:   "final",
		Lines: []jobLine{
			{ItemIndex: 1, DisplayName: "Agua 500ml", Qty: 1, UnitPrice: 1.85},
			{ItemIndex: 9, DisplayName: "Ice Tea Limão", Qty: 1, UnitPrice: 2.2},
		},
	}
	rawBytes, _ := json.Marshal(payloadMap)
	raw := escposFromJob(printJob{Type: "order_receipt", Payload: rawBytes})
	s := string(raw)
	for _, want := range []string{
		"restaurant",
		"Receipt",
		"Table No.:01",
		"Guest:4",
		"Original Price",
		"001-Agua 500ml",
		"Fee Details",
		"Original price",
		"Amount Due:13.75",
		"Amount Paid:13.75",
		"-Cash Payment:13.75",
		"Ordered By:Customer/Merchant",
		"Order Time:2026-05-14 20:05",
		"Printed By:restaurant",
		"Print Time:2026-05-14 21:01",
	} {
		if !strings.Contains(s, want) {
			t.Fatalf("missing %q in receipt output", want)
		}
	}
	if strings.Contains(s, "Original Pri") && !strings.Contains(s, "Original Price") {
		t.Fatal("price header must not wrap as Original Pri")
	}
}

func TestBuildOrderReceiptSplitPaymentGuestNumber(t *testing.T) {
	payload, _ := json.Marshal(map[string]any{
		"display_name":    "A-05",
		"table_id":        "550e8400-e29b-41d4-a716-446655440000",
		"receipt_variant": "split_payment",
		"payer_name":      "客人 2",
		"amount_due":      38.62,
		"amount_paid":     38.62,
		"payment_method":  "Cash",
	})
	raw := escposFromJob(printJob{Type: "order_receipt", Payload: payload})
	s := string(raw)
	if strings.Contains(s, "??") {
		t.Fatalf("must not contain ?? placeholders: %q", s)
	}
	if strings.Contains(s, "550e8400") {
		t.Fatalf("must not print table_id UUID on receipt: %q", s)
	}
	if !strings.Contains(s, "Guest:2") {
		t.Fatalf("expected Guest:2, got excerpt around guest: %q", s)
	}
	if !strings.Contains(s, "Table No.:A-05") {
		t.Fatalf("split receipt must show display_name, got: %q", s)
	}
}

func TestParseJobPayloadDisplayNameFromJSON(t *testing.T) {
	raw, _ := json.Marshal(map[string]any{"display_name": "A-01", "table_id": "550e8400-e29b-41d4-a716-446655440000"})
	p := parseJobPayload(printJob{Payload: raw})
	if p.TableDisplayName != "A-01" {
		t.Fatalf("expected A-01, got %q", p.TableDisplayName)
	}
	if p.TableID != "550e8400-e29b-41d4-a716-446655440000" {
		t.Fatalf("expected table_id, got %q", p.TableID)
	}
}

func TestPreBillOmitsPaymentLines(t *testing.T) {
	payload, _ := json.Marshal(map[string]any{
		"display_name": "A-02",
		"subtotal":     10,
		"amount_due":   10,
		"lines":        []jobLine{{ItemIndex: 1, DisplayName: "Soup", Qty: 1, UnitPrice: 10}},
	})
	raw := escposFromJob(printJob{Type: "pre_bill", Payload: payload})
	s := string(raw)
	if !strings.Contains(s, "Pré-conta") && !strings.Contains(s, "Pr\xe9-conta") {
		t.Fatalf("pre_bill title must be Pré-conta (default locale pt), got: %q", s)
	}
	if strings.Contains(s, "Amount Paid:") || strings.Contains(s, "Payment:") {
		t.Fatal("pre_bill must not include payment confirmation lines")
	}
}

func TestPreBillTitleEnglishLocale(t *testing.T) {
	payload, _ := json.Marshal(map[string]any{
		"locale":       "en",
		"display_name": "A-03",
		"subtotal":     5,
		"amount_due":   5,
		"lines":        []jobLine{{ItemIndex: 1, DisplayName: "Tea", Qty: 1, UnitPrice: 5}},
	})
	raw := escposFromJob(printJob{Type: "pre_bill", Payload: payload})
	s := string(raw)
	if !strings.Contains(s, "Pre-Bill") {
		t.Fatalf("pre_bill en locale must show Pre-Bill, got: %q", s)
	}
}
