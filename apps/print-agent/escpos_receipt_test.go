package main

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestBuildOrderReceiptEnglishLayout(t *testing.T) {
	payloadMap := jobPayload{
		Locale:         "pt",
		RestaurantName: "川味餐厅",
		TableNumber:    1,
		GuestCount:     4,
		OrderTime:      "2026-05-14 20:05",
		PrintTime:      "2026-05-14 21:01",
		Subtotal:       13.75,
		AmountDue:      13.75,
		AmountPaid:     13.75,
		PaymentMethod:  "Cash",
		ReceiptVariant: "final",
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
	if strings.Contains(s, "Original Pri") {
		t.Fatal("price header must not wrap as Original Pri")
	}
}

func TestBuildOrderReceiptSplitPaymentGuestNumber(t *testing.T) {
	payload, _ := json.Marshal(jobPayload{
		TableNumber:    5,
		ReceiptVariant: "split_payment",
		PayerName:      "客人 2",
		AmountDue:      38.62,
		AmountPaid:     38.62,
		PaymentMethod:  "Cash",
	})
	raw := escposFromJob(printJob{Type: "order_receipt", Payload: payload})
	s := string(raw)
	if strings.Contains(s, "??") {
		t.Fatalf("must not contain ?? placeholders: %q", s)
	}
	if !strings.Contains(s, "Guest:2") {
		t.Fatalf("expected Guest:2, got excerpt around guest: %q", s)
	}
}

func TestPreBillOmitsPaymentLines(t *testing.T) {
	payload, _ := json.Marshal(jobPayload{
		TableNumber: 2,
		Subtotal:    10,
		AmountDue:   10,
		Lines:       []jobLine{{ItemIndex: 1, DisplayName: "Soup", Qty: 1, UnitPrice: 10}},
	})
	raw := escposFromJob(printJob{Type: "pre_bill", Payload: payload})
	s := string(raw)
	if strings.Contains(s, "Amount Paid:") || strings.Contains(s, "Payment:") {
		t.Fatal("pre_bill must not include payment confirmation lines")
	}
}
