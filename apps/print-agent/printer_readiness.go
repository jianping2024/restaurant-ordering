// Printer readiness: offline backlog vs session print permission (printer_readiness.go).
//
// Per-printer state uses targetKey (tcp:host:port | winspool:Name). Three independent axes:
//
//  1. printAfter     — BACKLOG CUTOFF ONLY. If job.created_at < printAfter → failed:offline_backlog.
//                      Persisted (printer_print_after). Never means "printer is online".
//  2. wasOffline     — Last probe/IO thought target unreachable. Persisted (printer_was_offline).
//                      Cleared when targetCheckReady succeeds; triggers markPrintAfter on reconnect.
//  3. onlineConfirmed — SESSION-ONLY. May PATCH done / allow print after preparePrint.
//                      WinSpool: false until confirmOnline (successful print this session), except TCP arm.
//                      NEVER load from disk; NEVER set true because printAfter exists on disk.
//
// Invariants (do not break — caused 0.3.12/0.3.13 regressions):
//   - printAfter on disk ≠ onlineConfirmed.
//   - First Mesa pending fetch ≠ printer physically online (OpenPrinter can lie).
//   - Mesa API unreachable ≠ printer offline (different logs and job outcomes).
package main

import (
	"errors"
	"fmt"
	"net"
	"strings"
	"time"
)

// errPrinterNotReady — preparePrint: keep job pending (mesa pending), retry later.
var errPrinterNotReady = errors.New("printer not ready; will retry")

const printJobSkippedBacklogMsg = "Print job skipped (printer was offline; only jobs created after the printer came online are printed)"

// errPrintJobSkippedBacklog — job.created_at < printAfter; PATCH failed:offline_backlog.
var errPrintJobSkippedBacklog = errors.New(printJobSkippedBacklogMsg)

// printerReadyTracker holds per-targetKey readiness (memory; partly mirrored to config.json).
type printerReadyTracker struct {
	// agentStartedAt is fixed when this tracker is created (agent process/session start).
	// Used as printAfter when first pending fetch sees OpenPrinter OK but WinSpool is not
	// onlineConfirmed — skips only jobs created before this agent started, not "first fetch" time.
	agentStartedAt time.Time

	// printAfter[key] — backlog cutoff (RFC3339 on disk as printer_print_after[key]).
	// Compare to job.created_at in shouldSkipBacklog. Updated on: reconnect, remap, IO offline arm,
	// first pending arm. Does NOT grant permission to mark jobs done.
	printAfter map[string]time.Time

	// wasOffline[key] — probe or print IO failed since last successful observe for this target.
	// Persisted as printer_was_offline[key]. When cleared after targetCheckReady OK, markPrintAfter(now).
	wasOffline map[string]bool

	// onlineConfirmed[key] — this session may print and PATCH done for key.
	// WinSpool: set only by confirmOnline (after successful print) or TCP first arm.
	// Cleared on: session start (resetWinspoolSessionTrust), noteTargetOffline, observe fail.
	// NOT persisted; MUST NOT be derived from printer_print_after on load.
	onlineConfirmed map[string]bool
}

func newPrinterReadyTracker() *printerReadyTracker {
	return &printerReadyTracker{
		agentStartedAt:  time.Now(),
		printAfter:      make(map[string]time.Time),
		wasOffline:      make(map[string]bool),
		onlineConfirmed: make(map[string]bool),
	}
}

func (sess *agentSession) printerReady() *printerReadyTracker {
	if sess.printer == nil {
		tr := newPrinterReadyTracker()
		tr.loadFromConfig(sess.cfg)
		tr.resetWinspoolSessionTrust(sess.cfg)
		tr.logSessionInit(sess.cfg)
		sess.printer = tr
	}
	return sess.printer
}

// loadFromConfig restores printAfter and wasOffline from disk only.
// INVARIANT: never sets onlineConfirmed from PrinterPrintAfter or absence of PrinterWasOffline.
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

// resetWinspoolSessionTrust sets onlineConfirmed=false for all mapped WinSpool targets.
// Complements loadFromConfig: disk may have print_after but must not imply done is safe.
func (tr *printerReadyTracker) resetWinspoolSessionTrust(cfg *config) {
	if tr == nil || cfg == nil {
		return
	}
	for _, pt := range cfg.mappedPrinterTargets() {
		if pt.Scheme == schemeWinspool {
			tr.onlineConfirmed[targetKey(pt)] = false
		}
	}
}

// persist writes printAfter and wasOffline only (never onlineConfirmed — session-local).
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

// bootstrap probes all mapped targets once at poll loop start (observeTargetReady).
func (tr *printerReadyTracker) bootstrap(sess *agentSession) {
	if tr == nil || sess == nil || sess.cfg == nil {
		return
	}
	for _, pt := range sess.cfg.mappedPrinterTargets() {
		_ = tr.observeTargetReady(sess.cfg, sess.cfgPath, pt)
	}
}

// armPrintAfterOnPendingFetch runs once per target when Mesa returns a non-empty pending queue.
// Sets printAfter if missing; does not mean "printer came online" (see package comment).
//   - targetCheckReady fail → printAfter=now, wasOffline=true, onlineConfirmed=false
//   - OpenPrinter OK, WinSpool → printAfter=agentStartedAt, onlineConfirmed=false
//   - TCP OK → printAfter=agentStartedAt, onlineConfirmed=true
func (tr *printerReadyTracker) armPrintAfterOnPendingFetch(cfg *config, cfgPath string) {
	if tr == nil || cfg == nil {
		return
	}
	var displays []string
	for _, pt := range cfg.mappedPrinterTargets() {
		key := targetKey(pt)
		if pt.Scheme == schemeWinspool {
			tr.onlineConfirmed[key] = false
		}
		if _, ok := tr.printAfter[key]; ok {
			tr.logReadiness(cfg, readinessArmPending, pt, printJob{}, map[string]string{
				"arm_reason": "print_after_already_set",
				"decision":   "winspool_unconfirmed_reset",
			})
			continue
		}
		err := targetCheckReady(pt)
		fields := map[string]string{"check": readinessCheckValue(err, pt.Scheme)}
		if err != nil {
			tr.wasOffline[key] = true
			tr.onlineConfirmed[key] = false
			tr.printAfter[key] = time.Now()
			fields["arm_reason"] = "first_pending_unreachable"
			fields["decision"] = "arm_print_after_now"
			tr.logReadiness(cfg, readinessArmPending, pt, printJob{}, fields)
			displays = append(displays, pt.Display)
			continue
		}
		// OpenPrinter can lie while USB is unplugged; only skip queue older than session start.
		tr.printAfter[key] = tr.agentStartedAt
		if pt.Scheme == schemeTCP {
			tr.onlineConfirmed[key] = true
			fields["decision"] = "arm_agent_started_tcp_confirmed"
		} else {
			tr.onlineConfirmed[key] = false
			fields["decision"] = "arm_agent_started_winspool_unconfirmed"
		}
		fields["arm_reason"] = "first_pending_open_ok"
		tr.logReadiness(cfg, readinessArmPending, pt, printJob{}, fields)
		displays = append(displays, pt.Display)
	}
	if len(displays) == 0 {
		return
	}
	tr.persist(cfg, cfgPath)
	agentLog(cfg, "log_printer_arm_skip_stale_pending", strings.Join(displays, ", "))
}

// targetKey is the map key for printAfter, wasOffline, onlineConfirmed, and config.json fields.
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

// targetCheckReady is preflight only (TCP dial | WinSpool OpenPrinter). Unreliable for USB "really online".
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

// markPrintAfter sets backlog cutoff to now (reconnect, remap). Does not set onlineConfirmed.
func (tr *printerReadyTracker) markPrintAfter(key string) {
	key = strings.TrimSpace(key)
	if key == "" {
		return
	}
	tr.printAfter[key] = time.Now()
}

// noteTargetOffline records print IO failure: wasOffline=true, onlineConfirmed=false.
func (tr *printerReadyTracker) noteTargetOffline(cfg *config, cfgPath string, target printerTarget) {
	key := targetKey(target)
	tr.wasOffline[key] = true
	tr.onlineConfirmed[key] = false
	tr.logReadiness(cfg, readinessIOOffline, target, printJob{}, map[string]string{
		"decision": "mark_was_offline",
	})
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
				tr.logReadiness(cfg, readinessRemap, pt, printJob{}, map[string]string{
					"arm_reason": "station_remap",
					"station_id": sid,
					"decision":   "arm_print_after_now",
				})
			}
		}
	}
	if remapped {
		tr.persist(cfg, cfgPath)
	}
}

// shouldSkipBacklog compares job.created_at to printAfter only (ignores onlineConfirmed).
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

// observeTargetReady runs targetCheckReady; on success after wasOffline, markPrintAfter (not onlineConfirmed).
func (tr *printerReadyTracker) observeTargetReady(cfg *config, cfgPath string, target printerTarget) error {
	key := targetKey(target)
	err := targetCheckReady(target)
	fields := map[string]string{"check": readinessCheckValue(err, target.Scheme)}
	if err != nil {
		tr.wasOffline[key] = true
		tr.onlineConfirmed[key] = false
		fields["decision"] = "observe_fail"
		tr.logReadiness(cfg, readinessObserve, target, printJob{}, fields)
		tr.persist(cfg, cfgPath)
		return fmt.Errorf("%w: %v", errPrinterNotReady, err)
	}
	if tr.wasOffline[key] {
		tr.markPrintAfter(key)
		fields["decision"] = "reconnect_mark_print_after"
		fields["arm_reason"] = "was_offline_cleared"
		if cfg != nil {
			agentLog(cfg, "log_printer_reconnect_backlog", target.Display)
		}
	} else {
		fields["decision"] = "observe_ok"
	}
	delete(tr.wasOffline, key)
	tr.logReadiness(cfg, readinessObserve, target, printJob{}, fields)
	tr.persist(cfg, cfgPath)
	return nil
}

// confirmOnline sets onlineConfirmed=true after a successful physical print (agent_poll).
func (tr *printerReadyTracker) confirmOnline(cfg *config, cfgPath string, target printerTarget, job printJob) {
	key := targetKey(target)
	tr.onlineConfirmed[key] = true
	delete(tr.wasOffline, key)
	tr.logReadiness(cfg, readinessConfirmPrint, target, job, map[string]string{
		"decision":   "confirm_online_after_print",
		"mesa_patch": "done",
	})
	tr.persist(cfg, cfgPath)
}

// preparePrint gate order: observe → onlineConfirmed? → shouldSkipBacklog.
//   - !onlineConfirmed && !skip → errPrinterNotReady (pending)
//   - onlineConfirmed && skip → errPrintJobSkippedBacklog (failed)
//   - onlineConfirmed && !skip → nil (caller may print)
func (tr *printerReadyTracker) preparePrint(cfg *config, cfgPath string, target printerTarget, job printJob) error {
	if err := tr.observeTargetReady(cfg, cfgPath, target); err != nil {
		tr.logReadiness(cfg, readinessPrepare, target, job, map[string]string{
			"decision": "blocked_observe_fail",
		})
		return err
	}
	key := targetKey(target)
	if !tr.onlineConfirmed[key] {
		if skip, _ := tr.shouldSkipBacklog(key, job); skip {
			if cfg != nil {
				agentLog(cfg, "log_skipped_offline_backlog", job.ID, jobRouteStationID(job), target.Display)
			}
			tr.logReadiness(cfg, readinessPrepare, target, job, map[string]string{
				"decision":   "skip_backlog_unconfirmed",
				"mesa_patch": "failed:offline_backlog",
			})
			return errPrintJobSkippedBacklog
		}
		tr.logReadiness(cfg, readinessPrepare, target, job, map[string]string{
			"decision":   "pending_unconfirmed",
			"mesa_patch": "pending",
		})
		return errPrinterNotReady
	}
	if skip, noCreatedAt := tr.shouldSkipBacklog(key, job); skip {
		if noCreatedAt && cfg != nil {
			agentLog(cfg, "log_skipped_offline_backlog_no_time", job.ID, jobRouteStationID(job), target.Display)
		}
		decision := "skip_backlog"
		if noCreatedAt {
			decision = "skip_backlog_no_created_at"
		}
		tr.logReadiness(cfg, readinessPrepare, target, job, map[string]string{
			"decision":   decision,
			"mesa_patch": "failed:offline_backlog",
		})
		return errPrintJobSkippedBacklog
	}
	tr.logReadiness(cfg, readinessPrepare, target, job, map[string]string{
		"decision": "allow_print",
	})
	return nil
}
