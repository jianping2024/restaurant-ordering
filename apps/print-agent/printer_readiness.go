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
		tr := newPrinterReadyTracker()
		tr.loadFromConfig(sess.cfg)
		sess.printer = tr
	}
	return sess.printer
}

func (tr *printerReadyTracker) loadFromConfig(cfg *config) {
	if cfg == nil {
		return
	}
	for k, raw := range cfg.PrinterPrintAfter {
		k = strings.TrimSpace(k)
		raw = strings.TrimSpace(raw)
		if k == "" || raw == "" {
			continue
		}
		t, err := time.Parse(time.RFC3339, raw)
		if err != nil {
			continue
		}
		tr.printAfter[k] = t
	}
	for k, v := range cfg.PrinterWasOffline {
		if v {
			tr.wasOffline[strings.TrimSpace(k)] = true
		}
	}
}

func (tr *printerReadyTracker) persist(cfg *config, cfgPath string) {
	if tr == nil || cfg == nil || strings.TrimSpace(cfgPath) == "" {
		return
	}
	if len(tr.printAfter) > 0 {
		m := make(map[string]string, len(tr.printAfter))
		for k, t := range tr.printAfter {
			if k == "" || t.IsZero() {
				continue
			}
			m[k] = t.UTC().Format(time.RFC3339)
		}
		cfg.PrinterPrintAfter = m
	}
	offline := make(map[string]bool)
	for k, v := range tr.wasOffline {
		if v && strings.TrimSpace(k) != "" {
			offline[k] = true
		}
	}
	if len(offline) > 0 {
		cfg.PrinterWasOffline = offline
	} else {
		cfg.PrinterWasOffline = nil
	}
	_ = saveConfig(cfgPath, cfg)
}

func (tr *printerReadyTracker) bootstrap(sess *agentSession) {
	if tr == nil || sess == nil || sess.cfg == nil {
		return
	}
	for _, pt := range sess.cfg.mappedPrinterTargets() {
		_ = tr.observeTargetReady(sess.cfg, sess.cfgPath, pt)
	}
}

// armPrintAfterOnPendingFetch skips jobs created before now for mapped printers without printAfter yet.
func (tr *printerReadyTracker) armPrintAfterOnPendingFetch(cfg *config, cfgPath string) {
	if tr == nil || cfg == nil {
		return
	}
	displays := tr.armPrintAfterUnsetKeys(cfg, time.Now())
	if len(displays) == 0 {
		return
	}
	tr.persist(cfg, cfgPath)
	agentLog(cfg, "log_printer_arm_skip_stale_pending", strings.Join(displays, ", "))
}

func (tr *printerReadyTracker) armPrintAfterUnsetKeys(cfg *config, when time.Time) []string {
	var displays []string
	for _, pt := range cfg.mappedPrinterTargets() {
		key := targetKey(pt)
		if _, ok := tr.printAfter[key]; ok {
			continue
		}
		tr.printAfter[key] = when
		displays = append(displays, pt.Display)
	}
	return displays
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

func (tr *printerReadyTracker) noteTargetOffline(cfg *config, cfgPath string, target printerTarget) {
	key := targetKey(target)
	tr.wasOffline[key] = true
	tr.persist(cfg, cfgPath)
}

func (tr *printerReadyTracker) noteMappingChanges(cfg *config, cfgPath string, prev, next *config) {
	if next == nil || next.StationPrinters == nil {
		return
	}
	var remapped bool
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
			remapped = true
			if cfg != nil {
				agentLog(cfg, "log_printer_remap_backlog", pt.Display, sid)
			}
		}
	}
	if remapped {
		tr.persist(cfg, cfgPath)
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

func (tr *printerReadyTracker) observeTargetReady(cfg *config, cfgPath string, target printerTarget) error {
	key := targetKey(target)
	if err := targetCheckReady(target); err != nil {
		tr.wasOffline[key] = true
		tr.persist(cfg, cfgPath)
		return fmt.Errorf("%w: %v", errPrinterNotReady, err)
	}
	if tr.wasOffline[key] {
		tr.markPrintAfter(key)
		if cfg != nil {
			agentLog(cfg, "log_printer_reconnect_backlog", target.Display)
		}
	}
	delete(tr.wasOffline, key)
	tr.persist(cfg, cfgPath)
	return nil
}

// preparePrint updates offline→online state and returns whether this job may print now.
func (tr *printerReadyTracker) preparePrint(cfg *config, cfgPath string, target printerTarget, job printJob) error {
	if err := tr.observeTargetReady(cfg, cfgPath, target); err != nil {
		return err
	}
	key := targetKey(target)
	if skip, noCreatedAt := tr.shouldSkipBacklog(key, job); skip {
		if noCreatedAt && cfg != nil {
			agentLog(cfg, "log_skipped_offline_backlog_no_time", job.ID, jobRouteStationID(job), target.Display)
		}
		return errPrintJobSkippedBacklog
	}
	return nil
}
