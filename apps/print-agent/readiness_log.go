// Readiness decision logs (grep agent.log for "就绪决策" / event=).
//
// Log fields mirror printerReadyTracker (see printer_readiness.go); do not repurpose:
//   print_after      → same as printAfter[key] (backlog cutoff)
//   online_confirmed → same as onlineConfirmed[key] (session may PATCH done)
//   was_offline      → same as wasOffline[key]
//   agent_started    → agentStartedAt
//   decision/mesa_patch → outcome of this step only
package main

import (
	"fmt"
	"strings"
	"time"
)

// readinessEvent labels a single log line (log_readiness); not persisted.
type readinessEvent string

const (
	readinessSessionInit  readinessEvent = "session_init"  // after load + resetWinspoolSessionTrust
	readinessArmPending   readinessEvent = "arm_pending"   // first non-empty Mesa pending per target
	readinessObserve      readinessEvent = "observe"       // targetCheckReady inside observeTargetReady
	readinessPrepare      readinessEvent = "prepare_job"   // per-job gate before print
	readinessConfirmPrint readinessEvent = "confirm_print" // confirmOnline after IO success
	readinessIOOffline    readinessEvent = "io_offline"    // noteTargetOffline
	readinessRemap        readinessEvent = "remap"         // station printer mapping changed
)

func readinessCheckValue(err error, scheme string) string {
	if err != nil {
		if scheme == schemeTCP {
			return "tcp_fail"
		}
		return "open_fail"
	}
	if scheme == schemeTCP {
		return "tcp_ok"
	}
	return "open_ok"
}

func (tr *printerReadyTracker) readinessStateFields(key string) []string {
	if tr == nil {
		return nil
	}
	out := []string{
		fmt.Sprintf("online_confirmed=%t", tr.onlineConfirmed[key]),
		fmt.Sprintf("was_offline=%t", tr.wasOffline[key]),
	}
	if t, ok := tr.printAfter[key]; ok && !t.IsZero() {
		out = append(out, "print_after="+t.UTC().Format(time.RFC3339))
	} else {
		out = append(out, "print_after=-")
	}
	out = append(out, "agent_started="+tr.agentStartedAt.UTC().Format(time.RFC3339))
	return out
}

func (tr *printerReadyTracker) logReadiness(cfg *config, event readinessEvent, pt printerTarget, job printJob, fields map[string]string) {
	if cfg == nil || tr == nil {
		return
	}
	key := targetKey(pt)
	parts := []string{
		"event=" + string(event),
		"target=" + key,
		"scheme=" + pt.Scheme,
	}
	parts = append(parts, tr.readinessStateFields(key)...)
	if job.ID != "" {
		parts = append(parts, "job_id="+job.ID)
	}
	if created, ok := parseJobCreatedAt(job); ok {
		parts = append(parts, "job_created="+created.UTC().Format(time.RFC3339))
	}
	for k, v := range fields {
		if strings.TrimSpace(v) == "" {
			continue
		}
		parts = append(parts, k+"="+v)
	}
	agentLogTech(cfg, "log_readiness", strings.Join(parts, " "), string(event))
}

func (tr *printerReadyTracker) logSessionInit(cfg *config) {
	if tr == nil || cfg == nil {
		return
	}
	for _, pt := range cfg.mappedPrinterTargets() {
		key := targetKey(pt)
		fields := map[string]string{"arm_reason": "session_start"}
		if t, ok := tr.printAfter[key]; ok && !t.IsZero() {
			fields["disk_print_after"] = t.UTC().Format(time.RFC3339)
		}
		if pt.Scheme == schemeWinspool {
			fields["decision"] = "winspool_session_unconfirmed"
		}
		tr.logReadiness(cfg, readinessSessionInit, pt, printJob{}, fields)
	}
}
