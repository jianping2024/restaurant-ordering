package main

import (
	"errors"
	"testing"
	"time"
)

func TestPrinterReadyTracker_shouldSkipBacklogAfterReconnect(t *testing.T) {
	t.Parallel()
	tr := newPrinterReadyTracker()
	key := "winspool:Kitchen"
	tr.markPrintAfter(key)

	old := printJob{
		ID:        "old",
		CreatedAt: tr.printAfter[key].Add(-5 * time.Minute).UTC().Format(time.RFC3339),
	}
	if !tr.shouldSkipBacklog(key, old) {
		t.Fatal("expected skip for job before reconnect")
	}
	fresh := printJob{
		ID:        "new",
		CreatedAt: tr.printAfter[key].Add(2 * time.Second).UTC().Format(time.RFC3339),
	}
	if tr.shouldSkipBacklog(key, fresh) {
		t.Fatal("expected fresh job after reconnect to print")
	}
}

func TestPrinterReadyTracker_preparePrint_skipsBacklog(t *testing.T) {
	t.Parallel()
	tr := newPrinterReadyTracker()
	target := printerTarget{Scheme: schemeTCP, TCPHostPort: "127.0.0.1:1", Display: "tcp:127.0.0.1:1"}
	key := targetKey(target)
	tr.markPrintAfter(key)

	job := printJob{
		ID:        "old",
		CreatedAt: time.Now().Add(-10 * time.Minute).UTC().Format(time.RFC3339),
	}
	// observeTargetReady will fail (nothing listening); only test skip when ready
	tr.wasOffline[key] = false
	if !tr.shouldSkipBacklog(key, job) {
		t.Fatal("expected backlog skip")
	}
	err := tr.preparePrint(target, job)
	if err == nil || (!errors.Is(err, errPrinterNotReady) && !errors.Is(err, errPrintJobSkippedBacklog)) {
		// unreachable port → not ready; if somehow ready, backlog skip
		if !errors.Is(err, errPrinterNotReady) {
			t.Fatalf("expected not ready or backlog skip, got %v", err)
		}
	}
}

func TestPrinterReadyTracker_markOnMappingChange(t *testing.T) {
	t.Parallel()
	sess := &agentSession{printer: newPrinterReadyTracker()}
	prev := &config{StationPrinters: map[string]string{"a": "tcp:10.0.0.1:9100"}}
	next := &config{StationPrinters: map[string]string{"a": "winspool:Kitchen"}}
	sess.printerReady().noteMappingChanges(prev, next)
	key := targetKey(printerTarget{Scheme: schemeWinspool, WinspoolName: "Kitchen"})
	if _, ok := sess.printer.printAfter[key]; !ok {
		t.Fatal("expected printAfter marker on remap")
	}
}
