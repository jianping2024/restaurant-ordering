package main

import "testing"

func TestRunTrayTestPrintNeedsMapping(t *testing.T) {
	_, err := runTrayTestPrintTarget(&config{StationPrinters: map[string]string{}})
	if err == nil {
		t.Fatal("expected error without mapping")
	}
}
