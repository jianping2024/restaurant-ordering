package main

import (
	"path/filepath"
	"testing"
	"time"
)

func TestPrinterReadyTracker_shouldSkipBacklogAfterReconnect(t *testing.T) {
	t.Parallel()
	tr := newPrinterReadyTracker()
	key := "winspool:Kitchen"
	tr.printAfter[key] = time.Now()

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

func TestPrinterReadyTracker_reconnectPersists(t *testing.T) {
	t.Parallel()
	dir := t.TempDir()
	path := filepath.Join(dir, "config.json")
	cfg := &config{
		APIBase:           "https://example.com",
		AgentJWT:          "x",
		PrinterWasOffline: map[string]bool{"winspool:Kitchen": true},
	}
	if err := saveConfig(path, cfg); err != nil {
		t.Fatal(err)
	}
	tr := newPrinterReadyTracker()
	tr.loadFromConfig(cfg)
	key := "winspool:Kitchen"
	tr.markPrintAfter(key)
	delete(tr.wasOffline, key)
	tr.persist(cfg, path)

	loaded, err := loadConfig(path)
	if err != nil {
		t.Fatal(err)
	}
	if loaded.PrinterPrintAfter[key] == "" {
		t.Fatal("expected print_after persisted")
	}
	if loaded.PrinterWasOffline != nil && loaded.PrinterWasOffline[key] {
		t.Fatal("expected was_offline cleared on disk")
	}
}

func TestShouldSkipBacklog_missingCreatedAt(t *testing.T) {
	t.Parallel()
	tr := newPrinterReadyTracker()
	key := "tcp:10.0.0.1:9100"
	tr.printAfter[key] = time.Now()
	skip, noTime := tr.shouldSkipBacklog(key, printJob{ID: "x"})
	if !skip || !noTime {
		t.Fatal("expected conservative skip when created_at missing")
	}
}

func TestPrinterReadyTracker_markOnMappingChange(t *testing.T) {
	t.Parallel()
	dir := t.TempDir()
	path := filepath.Join(dir, "config.json")
	cfg := &config{StationPrinters: map[string]string{"a": "tcp:10.0.0.1:9100"}}
	if err := saveConfig(path, cfg); err != nil {
		t.Fatal(err)
	}
	sess := &agentSession{cfgPath: path, cfg: cfg, printer: newPrinterReadyTracker()}
	prev := &config{StationPrinters: map[string]string{"a": "tcp:10.0.0.1:9100"}}
	next := &config{StationPrinters: map[string]string{"a": "winspool:Kitchen"}}
	sess.printerReady().noteMappingChanges(cfg, path, prev, next)
	key := targetKey(printerTarget{Scheme: schemeWinspool, WinspoolName: "Kitchen"})
	if _, ok := sess.printer.printAfter[key]; !ok {
		t.Fatal("expected printAfter marker on remap")
	}
}

func TestArmPrintAfterOnPendingFetch_skipsOlderJobs(t *testing.T) {
	t.Parallel()
	dir := t.TempDir()
	path := dir + "/config.json"
	cfg := &config{
		StationPrinters: map[string]string{"s1": "winspool:Kitchen"},
	}
	_ = saveConfig(path, cfg)
	tr := newPrinterReadyTracker()
	tr.armPrintAfterOnPendingFetch(cfg, path)
	key := "winspool:Kitchen"
	since := tr.printAfter[key]
	old := printJob{
		ID:        "old",
		CreatedAt: since.Add(-2 * time.Minute).UTC().Format(time.RFC3339),
	}
	if skip, _ := tr.shouldSkipBacklog(key, old); !skip {
		t.Fatal("expected skip for job before pending fetch arm")
	}
	fresh := printJob{
		ID:        "new",
		CreatedAt: since.Add(2 * time.Second).UTC().Format(time.RFC3339),
	}
	if skip, _ := tr.shouldSkipBacklog(key, fresh); skip {
		t.Fatal("expected job after arm time to print")
	}
}

func TestArmPrintAfterOnPendingFetch_doesNotOverwriteReconnect(t *testing.T) {
	t.Parallel()
	tr := newPrinterReadyTracker()
	key := "winspool:Kitchen"
	earlier := time.Now().Add(-10 * time.Minute)
	tr.printAfter[key] = earlier
	cfg := &config{StationPrinters: map[string]string{"s1": "winspool:Kitchen"}}
	tr.armPrintAfterOnPendingFetch(cfg, "")
	if !tr.printAfter[key].Equal(earlier) {
		t.Fatal("must not overwrite printAfter from reconnect or disk")
	}
}

func TestPrinterReadyTracker_loadFromConfig(t *testing.T) {
	t.Parallel()
	tr := newPrinterReadyTracker()
	when := time.Date(2026, 5, 29, 12, 0, 0, 0, time.UTC)
	cfg := &config{
		PrinterPrintAfter: map[string]string{"winspool:Bar": when.Format(time.RFC3339)},
		PrinterWasOffline: map[string]bool{"winspool:Bar": true},
	}
	tr.loadFromConfig(cfg)
	if tr.printAfter["winspool:Bar"] != when {
		t.Fatalf("printAfter got %v", tr.printAfter["winspool:Bar"])
	}
	if !tr.wasOffline["winspool:Bar"] {
		t.Fatal("expected wasOffline loaded")
	}
}
