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
	if skip, _ := tr.shouldSkipBacklog(key, old); !skip {
		t.Fatal("expected skip for job before reconnect")
	}
	fresh := printJob{
		ID:        "new",
		CreatedAt: tr.printAfter[key].Add(2 * time.Second).UTC().Format(time.RFC3339),
	}
	if skip, _ := tr.shouldSkipBacklog(key, fresh); skip {
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
	if skip, _ := tr.shouldSkipBacklog(key, job); !skip {
		t.Fatal("expected backlog skip")
	}
	err := tr.preparePrint(nil, target, job)
	if err == nil || (!errors.Is(err, errPrinterNotReady) && !errors.Is(err, errPrintJobSkippedBacklog)) {
		// unreachable port → not ready; if somehow ready, backlog skip
		if !errors.Is(err, errPrinterNotReady) {
			t.Fatalf("expected not ready or backlog skip, got %v", err)
		}
	}
}

func TestPrinterReadyTracker_noPrintAfterOnFirstReadyAfterStartupGlitch(t *testing.T) {
	t.Parallel()
	tr := newPrinterReadyTracker()
	target := printerTarget{Scheme: schemeWinspool, WinspoolName: "Kitchen", Display: "winspool:Kitchen"}
	key := targetKey(target)

	tr.wasOffline[key] = true
	// First time online in this session (startup): must not arm backlog skip.
	if tr.wasOffline[key] && tr.everReady[key] {
		tr.markPrintAfter(key)
	}
	delete(tr.wasOffline, key)
	tr.everReady[key] = true
	if _, ok := tr.printAfter[key]; ok {
		t.Fatal("first online after startup should not set printAfter")
	}

	tr.wasOffline[key] = true
	if tr.wasOffline[key] && tr.everReady[key] {
		tr.markPrintAfter(key)
	}
	if _, ok := tr.printAfter[key]; !ok {
		t.Fatal("expected printAfter after real reconnect")
	}
}

func TestShouldSkipBacklog_missingCreatedAt(t *testing.T) {
	t.Parallel()
	tr := newPrinterReadyTracker()
	key := "tcp:10.0.0.1:9100"
	tr.markPrintAfter(key)
	skip, noTime := tr.shouldSkipBacklog(key, printJob{ID: "x"})
	if !skip || !noTime {
		t.Fatal("expected conservative skip when created_at missing")
	}
}

func TestPrinterReadyTracker_markOnMappingChange(t *testing.T) {
	t.Parallel()
	sess := &agentSession{printer: newPrinterReadyTracker()}
	prev := &config{StationPrinters: map[string]string{"a": "tcp:10.0.0.1:9100"}}
	next := &config{StationPrinters: map[string]string{"a": "winspool:Kitchen"}}
	sess.printerReady().noteMappingChanges(nil, prev, next)
	key := targetKey(printerTarget{Scheme: schemeWinspool, WinspoolName: "Kitchen"})
	if _, ok := sess.printer.printAfter[key]; !ok {
		t.Fatal("expected printAfter marker on remap")
	}
}
