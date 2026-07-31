package main

import "testing"

func TestNormalizeAPIBase(t *testing.T) {
	got, err := normalizeAPIBase("https://restaurant-ordering-beryl-three.vercel.app/dashboard/settings/print-assistant")
	if err != nil {
		t.Fatal(err)
	}
	want := "https://restaurant-ordering-beryl-three.vercel.app"
	if got != want {
		t.Fatalf("got %q want %q", got, want)
	}
}

func TestPairWizardBaseURL(t *testing.T) {
	if got := pairWizardBaseURL("127.0.0.1:17892", ""); got != "http://127.0.0.1:17892/pair" {
		t.Fatalf("empty prefill: got %q", got)
	}
	got := pairWizardBaseURL("127.0.0.1:17892", "http://192.168.0.141/")
	want := "http://127.0.0.1:17892/pair?api=http%3A%2F%2F192.168.0.141"
	if got != want {
		t.Fatalf("with api: got %q want %q", got, want)
	}
}

func TestDedupePrinterList(t *testing.T) {
	got := dedupePrinterList([]printerListEntry{
		{Addr: "winspool:UK56009", Label: "UK56009"},
		{Addr: " winspool:uk56009 ", Label: "duplicate"},
		{Addr: "tcp:192.168.1.50:9100", Label: "LAN"},
	})
	if len(got) != 2 {
		t.Fatalf("got %d entries: %#v", len(got), got)
	}
	if got[0].Addr != "winspool:UK56009" || got[1].Addr != "tcp:192.168.1.50:9100" {
		t.Fatalf("unexpected entries: %#v", got)
	}
}
