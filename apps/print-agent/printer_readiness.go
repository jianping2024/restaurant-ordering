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
}

func newPrinterReadyTracker() *printerReadyTracker {
	return &printerReadyTracker{
		printAfter: make(map[string]time.Time),
		wasOffline: make(map[string]bool),
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

func (tr *printerReadyTracker) noteMappingChanges(prev, next *config) {
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
			tr.markPrintAfter(targetKey(pt))
		}
	}
}

func (tr *printerReadyTracker) shouldSkipBacklog(key string, job printJob) bool {
	since, ok := tr.printAfter[key]
	if !ok || since.IsZero() {
		return false
	}
	created, ok := parseJobCreatedAt(job)
	if !ok {
		return false
	}
	return created.Before(since)
}

func (tr *printerReadyTracker) observeTargetReady(target printerTarget) error {
	key := targetKey(target)
	if err := targetCheckReady(target); err != nil {
		tr.wasOffline[key] = true
		return fmt.Errorf("%w: %v", errPrinterNotReady, err)
	}
	if tr.wasOffline[key] {
		tr.markPrintAfter(key)
		delete(tr.wasOffline, key)
	}
	return nil
}

// preparePrint updates offline→online state and returns whether this job may print now.
func (tr *printerReadyTracker) preparePrint(target printerTarget, job printJob) error {
	if err := tr.observeTargetReady(target); err != nil {
		return err
	}
	if tr.shouldSkipBacklog(targetKey(target), job) {
		return errPrintJobSkippedBacklog
	}
	return nil
}
