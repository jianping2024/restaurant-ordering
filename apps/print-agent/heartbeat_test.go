package main

import "testing"

func TestMappedStationCount(t *testing.T) {
	c := &config{StationPrinters: map[string]string{"a": "tcp:1.2.3.4:9100", "b": "", "c": "winspool:UK"}}
	if c.mappedStationCount() != 2 {
		t.Fatalf("got %d", c.mappedStationCount())
	}
}

func TestHeartbeatSnapshotRecordPrint(t *testing.T) {
	var hb heartbeatSnapshot
	hb.recordPrint(true)
	if hb.lastPrintStatus != "done" || hb.lastPrintAt.IsZero() {
		t.Fatal("expected done timestamp")
	}
	hb.recordPrint(false)
	if hb.lastPrintStatus != "failed" {
		t.Fatal("expected failed")
	}
}
