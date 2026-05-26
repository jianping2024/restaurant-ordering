package main

import (
	"testing"
	"time"
)

func TestPrinterAddrForJob_receiptFirstMappedWithoutId(t *testing.T) {
	c := &config{
		StationPrinters: map[string]string{
			"kitchen": "tcp:10.0.0.1:9100",
			"bar":     "tcp:10.0.0.2:9100",
		},
	}
	addr, err := c.printerAddrForJob(printJob{
		Type:      "pre_bill",
		CreatedAt: time.Now().UTC().Format(time.RFC3339),
	})
	if err != nil {
		t.Fatalf("expected route, got err=%v", err)
	}
	if addr != "tcp:10.0.0.2:9100" {
		t.Fatalf("expected first sorted station (bar), got %q", addr)
	}
}

func TestPrinterAddrForJob_receiptSoleMappedWithoutId(t *testing.T) {
	c := &config{
		StationPrinters: map[string]string{"kitchen": "tcp:10.0.0.1:9100"},
	}
	addr, err := c.printerAddrForJob(printJob{Type: "pre_bill"})
	if err != nil || addr != "tcp:10.0.0.1:9100" {
		t.Fatalf("got %q err=%v", addr, err)
	}
}

func TestPrinterAddrForJob_receiptStationPicker(t *testing.T) {
	c := &config{
		StationPrinters: map[string]string{"kitchen": "tcp:10.0.0.1:9100"},
	}
	payload := []byte(`{"receipt_printer_id":"station:kitchen"}`)
	addr, err := c.printerAddrForJob(printJob{Type: "order_receipt", Payload: payload})
	if err != nil || addr != "tcp:10.0.0.1:9100" {
		t.Fatalf("got %q err=%v", addr, err)
	}
}

func TestPrinterAddrForJob_receiptCashierIdRejected(t *testing.T) {
	c := &config{CashierPrinter: "tcp:10.0.0.2:9100"}
	payload := []byte(`{"receipt_printer_id":"cashier"}`)
	_, err := c.printerAddrForJob(printJob{Type: "order_receipt", Payload: payload})
	if err == nil {
		t.Fatal("expected error for legacy cashier id")
	}
}

func TestPrinterAddrForJob_stationDoesNotUseCashier(t *testing.T) {
	c := &config{CashierPrinter: "tcp:10.0.0.2:9100"}
	payload := []byte(`{"print_station_id":"kitchen"}`)
	_, err := c.printerAddrForJob(printJob{Type: "station_ticket", Payload: payload})
	if err == nil {
		t.Fatal("expected error when station unmapped")
	}
}

func TestPrinterAddrForJob_stationMapped(t *testing.T) {
	c := &config{
		StationPrinters: map[string]string{"kitchen": "tcp:10.0.0.1:9100"},
	}
	payload := []byte(`{"print_station_id":"kitchen"}`)
	addr, err := c.printerAddrForJob(printJob{Type: "station_ticket", Payload: payload})
	if err != nil || addr != "tcp:10.0.0.1:9100" {
		t.Fatalf("got %q err=%v", addr, err)
	}
}
