package main

import (
	"errors"
	"fmt"
	"testing"
)

func TestPrinterIOFailure(t *testing.T) {
	if printerIOFailure(nil) {
		t.Fatal("nil is not IO failure")
	}
	if !printerIOFailure(errPrinterNotReady) {
		t.Fatal("errPrinterNotReady")
	}
	if !printerIOFailure(fmt.Errorf("wrap: %w", errPrinterNotReady)) {
		t.Fatal("wrapped errPrinterNotReady")
	}
	if !printerIOFailure(fmt.Errorf("tcp printer %q not reachable: dial tcp: connection refused", "1.2.3.4:9100")) {
		t.Fatal("connection refused")
	}
	if printerIOFailure(errors.New("invalid escpos payload length")) {
		t.Fatal("payload error is not IO")
	}
}

func TestPrinterIOFailureMarksOffline(t *testing.T) {
	dir := t.TempDir()
	path := dir + "/config.json"
	cfg := &config{APIBase: "https://x", AgentJWT: "t"}
	_ = saveConfig(path, cfg)
	tr := newPrinterReadyTracker()
	target := printerTarget{Scheme: schemeTCP, TCPHostPort: "10.0.0.1:9100", Display: "tcp:10.0.0.1:9100"}
	if printerIOFailure(fmt.Errorf("%w: write failed", errPrinterNotReady)) {
		tr.noteTargetOffline(cfg, path, target)
	}
	key := targetKey(target)
	if !tr.wasOffline[key] {
		t.Fatal("expected wasOffline after IO print failure")
	}
	loaded, _ := loadConfig(path)
	if loaded.PrinterWasOffline == nil || !loaded.PrinterWasOffline[key] {
		t.Fatal("expected was_offline persisted")
	}
}
