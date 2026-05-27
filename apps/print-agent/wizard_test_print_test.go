package main

import (
	"strings"
	"testing"
)

func TestRunTestPrintForStationNeedsMapping(t *testing.T) {
	err := runTestPrintForStation(&config{StationPrinters: map[string]string{}}, "", "")
	if err == nil {
		t.Fatal("expected error")
	}
}

func TestRunTestPrintForStationPicksFirstMapped(t *testing.T) {
	cfg := &config{
		StationPrinters: map[string]string{"s1": "tcp:127.0.0.1:1"},
		APIBase:         "https://demo.example.com",
	}
	err := runTestPrintForStation(cfg, "", "")
	if err == nil {
		t.Fatal("expected print error to unreachable printer")
	}
	if !strings.Contains(err.Error(), "打印失败") {
		t.Logf("got: %v", err)
	}
}
