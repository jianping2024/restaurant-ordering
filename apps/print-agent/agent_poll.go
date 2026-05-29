package main

import (
	"context"
	"errors"
	"strconv"
	"time"
)

func runPollLoop(ctx context.Context, sess *agentSession, status *agentStatus) {
	pc := sess.pc
	var lastLogged pollPhase
	var queue []printJob

	setStatus := func(summary, detail string) {
		if status != nil {
			status.set(summary, detail)
		}
	}
	reloadAgentSessionConfig(sess)
	cfg := sess.cfg
	if cfg == nil {
		setStatus("Error", "config missing")
		return
	}
	setStatus("Starting", cfg.APIBase)

	for {
		select {
		case <-ctx.Done():
			setStatus("Stopped", "")
			return
		default:
		}

		reloadAgentSessionConfig(sess)
		cfg = sess.cfg
		if cfg == nil {
			sleepOrCancel(ctx, 5*time.Second)
			continue
		}

		open, err := pc.scheduleOpen()
		if err == nil {
			if hbErr := postHeartbeat(ctx, cfg, open, &sess.hb); hbErr != nil {
				agentLogTech(cfg, "log_heartbeat_error", hbErr.Error())
			}
		}
		if err != nil {
			agentLogTech(cfg, "log_schedule_error", err.Error())
			setStatus("Schedule error", err.Error())
			sleepOrCancel(ctx, pc.sleepFor(pollPhaseError))
			continue
		}
		if !open {
			queue = nil
			if lastLogged != pollPhaseClosed {
				if wait, werr := pc.closedSleep(); werr == nil {
					agentLog(cfg, "log_outside_schedule_sleep", wait.Round(time.Second))
					setStatus("Outside business hours", "Not polling until next window")
				} else {
					agentLog(cfg, "log_outside_schedule")
					setStatus("Outside business hours", "Not polling")
				}
				lastLogged = pollPhaseClosed
			}
			sleepOrCancel(ctx, pc.sleepFor(pollPhaseClosed))
			continue
		}
		if lastLogged == pollPhaseClosed {
			agentLog(cfg, "log_schedule_resume")
			lastLogged = ""
		}

		if len(queue) == 0 {
			jobs, err := fetchPending(ctx, cfg.APIBase, cfg.AgentJWT)
			phase := pc.phase(len(jobs) > 0, err != nil)
			if err != nil {
				if lastLogged != pollPhaseError {
					agentLogTech(cfg, "log_pending_jobs_error", err.Error())
					lastLogged = pollPhaseError
				}
				setStatus("Connection problem", err.Error())
				sleepOrCancel(ctx, pc.sleepFor(pollPhaseError))
				continue
			}
			if len(jobs) == 0 {
				if lastLogged != phase {
					lastLogged = phase
				}
				switch phase {
				case pollPhaseWarm:
					setStatus("Ready", "Watching for new tickets")
				case pollPhaseIdle:
					setStatus("Ready", "Idle — waiting for orders")
				default:
					setStatus("Ready", "Polling")
				}
				sleepOrCancel(ctx, pc.sleepFor(phase))
				continue
			}
			queue = jobs
			lastLogged = pollPhaseBusy
			pc.markActivity()
			setStatus("Printing queue", strconv.Itoa(len(jobs))+" job(s) pending")
		}

		job := queue[0]
		if jobPrintExpired(job) {
			_ = patchJob(ctx, cfg.APIBase, cfg.AgentJWT, job.ID, map[string]any{
				"status":        "failed",
				"error_message": errPrintJobExpired.Error(),
			})
			agentLog(cfg, "log_skipped_expired", job.ID)
			queue = queue[1:]
			pc.markActivity()
			continue
		}
		target, err := cfg.printerTargetForJob(job)
		if err != nil {
			if errors.Is(err, errReceiptPrintDeferred) {
				shouldLog := lastLogged != pollPhaseBusy
				deferPollJob(&queue, &lastLogged, pollPhaseBusy)
				if shouldLog {
					agentLog(cfg, "log_receipt_deferred")
				}
				setStatus("Waiting for receipt printer", "Map a station in Settings (up to 20 min)")
				sleepOrCancel(ctx, pc.sleepFor(pollPhaseBusy))
				pc.markActivity()
				continue
			}
			_ = patchJob(ctx, cfg.APIBase, cfg.AgentJWT, job.ID, map[string]any{
				"status":        "failed",
				"error_message": err.Error(),
			})
			agentLogTech(cfg, "log_route_error", err.Error())
			queue = queue[1:]
			pc.markActivity()
			continue
		}
		if prepErr := sess.printerReady().preparePrint(target, job); prepErr != nil {
			if errors.Is(prepErr, errPrinterNotReady) {
				shouldLog := lastLogged != pollPhaseBusy
				deferPollJob(&queue, &lastLogged, pollPhaseBusy)
				if shouldLog {
					agentLog(cfg, "log_printer_not_ready")
				}
				setStatus("Waiting for printer", "Printer offline or unreachable")
				sleepOrCancel(ctx, pc.sleepFor(pollPhaseBusy))
				pc.markActivity()
				continue
			}
			if errors.Is(prepErr, errPrintJobSkippedBacklog) {
				_ = patchJob(ctx, cfg.APIBase, cfg.AgentJWT, job.ID, map[string]any{
					"status":        "failed",
					"error_message": printJobSkippedBacklogMsg,
				})
				agentLog(cfg, "log_skipped_offline_backlog", job.ID)
				queue = queue[1:]
				pc.markActivity()
				continue
			}
		}
		setStatus("Printing", summarizeJobPayload(job))
		if err := patchJob(ctx, cfg.APIBase, cfg.AgentJWT, job.ID, map[string]any{"status": "processing"}); err != nil {
			agentLogTech(cfg, "log_claim_job_error", err.Error())
			sleepOrCancel(ctx, pc.sleepFor(pollPhaseBusy))
			continue
		}
		data := escposFromJob(job)
		if err := printToTarget(target, data); err != nil {
			_ = patchJob(ctx, cfg.APIBase, cfg.AgentJWT, job.ID, map[string]any{
				"status":        "failed",
				"error_message": err.Error(),
			})
			sess.hb.recordPrint(false)
			agentLogTech(cfg, "log_print_failed", err.Error(), target.Display)
			setStatus("Print failed", err.Error())
		} else {
			if err := patchJob(ctx, cfg.APIBase, cfg.AgentJWT, job.ID, map[string]any{"status": "done"}); err != nil {
				agentLogTech(cfg, "log_mark_done_error", err.Error())
			} else {
				agentLog(cfg, "log_printed_ok", target.Display, summarizeJobPayload(job))
			}
			sess.hb.recordPrint(true)
			setStatus("Ready", "Last print OK")
		}
		queue = queue[1:]
		pc.markActivity()

		if len(queue) == 0 {
			sleepOrCancel(ctx, pc.sleepFor(pollPhaseAfterPrint))
		}
	}
}

func deferPollJob(queue *[]printJob, lastLogged *pollPhase, phase pollPhase) {
	if len(*queue) > 1 {
		*queue = append((*queue)[1:], (*queue)[0])
	} else {
		*queue = nil
	}
	*lastLogged = phase
}

func sleepOrCancel(ctx context.Context, d time.Duration) {
	if d <= 0 {
		select {
		case <-ctx.Done():
		default:
		}
		return
	}
	t := time.NewTimer(d)
	defer t.Stop()
	select {
	case <-ctx.Done():
	case <-t.C:
	}
}
