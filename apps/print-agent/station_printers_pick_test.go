package main

import "testing"

func TestFirstMappedStationPrinterPrefersWinspool(t *testing.T) {
	cfg := &config{
		StationPrinters: map[string]string{
			"bbb": "tcp:10.0.0.9:9100",
			"aaa": "winspool:Kitchen",
		},
	}
	sid, raw := firstMappedStationPrinter(cfg)
	if sid != "aaa" || raw != "winspool:Kitchen" {
		t.Fatalf("got sid=%q raw=%q, want aaa winspool:Kitchen", sid, raw)
	}
}

func TestFirstMappedStationPrinterStableSort(t *testing.T) {
	cfg := &config{
		StationPrinters: map[string]string{
			"z": "winspool:Z",
			"a": "winspool:A",
		},
	}
	sid, _ := firstMappedStationPrinter(cfg)
	if sid != "a" {
		t.Fatalf("got sid=%q, want a (sorted)", sid)
	}
}
