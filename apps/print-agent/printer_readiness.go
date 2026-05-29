package main

import (
	"errors"
	"fmt"
	"net"
	"strings"
	"time"
)

// errPrinterNotReady — do not claim; job stays pending until the bound printer is reachable.
var errPrinterNotReady = errors.New("printer not ready; will retry")

const printJobSkippedBacklogMsg = "Print job skipped (printer was offline; only jobs created after the printer came online are printed)"

// errPrintJobSkippedBacklog — job is older than the last offline→online (or remap) moment for this printer.
var errPrintJobSkippedBacklog = errors.New(printJobSkippedBacklogMsg)

type printerReadyTracker struct {
	printAfter map[string]time.Time
	wasOffline map[string]bool
	everReady  map[string]bool // avoid treating agent startup as offline→online reconnect
}

func newPrinterReadyTracker() *printerReadyTracker {
	return &printerReadyTracker{
		printAfter: make(map[string]time.Time),
		wasOffline: make(map[string]bool),
		everReady:  make(map[string]bool),
	}
}

func (sess *agentSession) printerReady() *printerReadyTracker {
	if sess.printer == nil {
		sess.printer = newPrinterReadyTracker()
	}
	return sess.printer
}

func targetKey(t printerTarget) string {
	switch t.Scheme {
	case schemeTCP:
		return schemeTCP + ":" + t.TCPHostPort
	case schemeWinspool:
		return schemeWinspool + ":" + t.WinspoolName
	default:
		return t.Display
	}
}

func targetCheckReady(t printerTarget) error {
	switch t.Scheme {
	case schemeTCP:
		return tcpCheckReady(t.TCPHostPort)
	case schemeWinspool:
		return winspoolCheckReady(t.WinspoolName)
	default:
		return fmt.Errorf("unknown printer scheme %q", t.Scheme)
	}
}

func tcpCheckReady(hostPort string) error {
	hostPort = strings.TrimSpace(hostPort)
	if hostPort == "" {
		return fmt.Errorf("empty tcp host:port")
	}
	c, err := net.DialTimeout("tcp", hostPort, 2*time.Second)
	if err != nil {
		return fmt.Errorf("tcp printer %q not reachable: %w", hostPort, err)
	}
	_ = c.Close()
	return nil
}

func (tr *printerReadyTracker) markPrintAfter(key string) {
	key = strings.TrimSpace(key)
	if key == "" {
		return
	}
	tr.printAfter[key] = time.Now()
}

func (tr *printerReadyTracker) noteMappingChanges(cfg *config, prev, next *config) {
	if next == nil || next.StationPrinters == nil {
		return
	}
	for sid, addr := range next.StationPrinters {
		addr = strings.TrimSpace(addr)
		if addr == "" {
			continue
		}
		pt, err := parsePrinterTarget(addr)
		if err != nil {
			continue
		}
		prevAddr := ""
		if prev != nil && prev.StationPrinters != nil {
			prevAddr = strings.TrimSpace(prev.StationPrinters[sid])
		}
		if prevAddr != addr {
			key := targetKey(pt)
			tr.markPrintAfter(key)
			if cfg != nil {
				agentLog(cfg, "log_printer_remap_backlog", pt.Display, sid)
			}
		}
	}
}

func (tr *printerReadyTracker) shouldSkipBacklog(key string, job printJob) (skip bool, noCreatedAt bool) {
	since, ok := tr.printAfter[key]
	if !ok || since.IsZero() {
		return false, false
	}
	created, ok := parseJobCreatedAt(job)
	if !ok {
		return true, true
	}
	return created.Before(since), false
}

func (tr *printerReadyTracker) observeTargetReady(cfg *config, target printerTarget) error {
	key := targetKey(target)
	if err := targetCheckReady(target); err != nil {
		tr.wasOffline[key] = true
		return fmt.Errorf("%w: %v", errPrinterNotReady, err)
	}
	if tr.wasOffline[key] && tr.everReady[key] {
		tr.markPrintAfter(key)
		if cfg != nil {
			agentLog(cfg, "log_printer_reconnect_backlog", target.Display)
		}
	}
	delete(tr.wasOffline, key)
	tr.everReady[key] = true
	return nil
}

// preparePrint updates offline→online state and returns whether this job may print now.
func (tr *printerReadyTracker) preparePrint(cfg *config, target printerTarget, job printJob) error {
	if err := tr.observeTargetReady(cfg, target); err != nil {
		return err
	}
	key := targetKey(target)
	if skip, noCreatedAt := tr.shouldSkipBacklog(key, job); skip {
		if noCreatedAt && cfg != nil {
			agentLog(cfg, "log_skipped_offline_backlog_no_time", job.ID, target.Display)
		}
		return errPrintJobSkippedBacklog
	}
	return nil
}
