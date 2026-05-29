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
	var blockedSpins int
	var reorderPasses int
	var throttle pollLogThrottle
	const waitLogEvery = 60 * time.Second

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
	sess.printerReady().bootstrap(sess)
	setStatus("Starting", cfg.APIBase)

	logBatchAllBlocked := func(c *config, reason string) {
		if c == nil {
			return
		}
		if throttle.allow("queue_all_blocked:"+reason, waitLogEvery) {
			agentLog(c, "log_queue_all_blocked")
		}
	}

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
				if throttle.allow("pending_jobs_error", waitLogEvery) || lastLogged != pollPhaseError {
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
			blockedSpins = 0
			reorderPasses = 0
			lastLogged = pollPhaseBusy
			pc.markActivity()
			agentLog(cfg, "log_fetched_pending", len(jobs))
			setStatus("Printing queue", strconv.Itoa(len(jobs))+" job(s) pending")
		}

		job := queue[0]
		if jobPrintExpired(job) {
			if patchJobStatus(ctx, cfg, job.ID, map[string]any{
				"status":        "failed",
				"error_message": errPrintJobExpired.Error(),
			}, "failed:expired") {
				agentLog(cfg, "log_skipped_expired", job.ID)
			} else {
				agentLog(cfg, "log_job_still_pending", job.ID, "failed:expired")
			}
			queue = queue[1:]
			blockedSpins = 0
			reorderPasses = 0
			pc.markActivity()
			continue
		}
		target, err := cfg.printerTargetForJob(job)
		if err != nil {
			if errors.Is(err, errReceiptPrintDeferred) {
				if throttle.allow("receipt_deferred", waitLogEvery) {
					agentLog(cfg, "log_receipt_deferred")
					lastLogged = pollPhaseBusy
				}
				setStatus("Waiting for receipt printer", "Map a station in Settings (up to 20 min)")
				var allBlocked bool
				queue, allBlocked = deferBlockedHead(queue, &blockedSpins)
				if !allBlocked {
					if throttle.allow("queue_try_other:receipt", waitLogEvery) {
						agentLog(cfg, "log_queue_try_other", job.ID)
					}
					pc.markActivity()
					continue
				}
				logBatchAllBlocked(cfg, "receipt")
				sleepOrCancel(ctx, pc.sleepFor(pollPhaseBusy))
				pc.markActivity()
				continue
			}
			if patchJobStatus(ctx, cfg, job.ID, map[string]any{
				"status":        "failed",
				"error_message": err.Error(),
			}, "failed:route") {
				agentLog(cfg, "log_route_error", job.ID, jobRouteStationID(job), err.Error())
			} else {
				agentLog(cfg, "log_job_still_pending", job.ID, "failed:route")
			}
			queue = queue[1:]
			blockedSpins = 0
			reorderPasses = 0
			pc.markActivity()
			continue
		}
		if prepErr := sess.printerReady().preparePrint(cfg, sess.cfgPath, target, job); prepErr != nil {
			if errors.Is(prepErr, errPrinterNotReady) {
				bk := targetKey(target)
				station := jobRouteStationID(job)
				if throttle.allow("printer_not_ready:"+bk, waitLogEvery) {
					agentLog(cfg, "log_printer_not_ready", target.Display, station, prepErr.Error())
					lastLogged = pollPhaseBusy
				}
				setStatus("Waiting for printer", "Spooler not accepting jobs; retrying")
				if reordered := reorderQueueAwayFromPrinter(queue, cfg, bk); len(reordered) > 0 && reordered[0].ID != queue[0].ID {
					queue = reordered
					blockedSpins = 0
					reorderPasses++
					if reorderPasses < len(queue) {
						if throttle.allow("queue_reorder:"+bk, waitLogEvery) {
							agentLog(cfg, "log_queue_reorder_printer", target.Display, station)
						}
						pc.markActivity()
						continue
					}
					reorderPasses = 0
				}
				var allBlocked bool
				queue, allBlocked = deferBlockedHead(queue, &blockedSpins)
				if !allBlocked {
					if throttle.allow("queue_try_other:printer:"+targetKey(target), waitLogEvery) {
						agentLog(cfg, "log_queue_try_other", job.ID)
					}
					pc.markActivity()
					continue
				}
				logBatchAllBlocked(cfg, "printer:"+targetKey(target))
				sleepOrCancel(ctx, pc.sleepFor(pollPhaseBusy))
				pc.markActivity()
				continue
			}
			if errors.Is(prepErr, errPrintJobSkippedBacklog) {
				if patchJobStatus(ctx, cfg, job.ID, map[string]any{
					"status":        "failed",
					"error_message": printJobSkippedBacklogMsg,
				}, "failed:offline_backlog") {
					agentLog(cfg, "log_skipped_offline_backlog", job.ID, jobRouteStationID(job), target.Display)
				} else {
					agentLog(cfg, "log_job_still_pending", job.ID, "failed:offline_backlog")
				}
				queue = queue[1:]
				blockedSpins = 0
				reorderPasses = 0
				pc.markActivity()
				continue
			}
			if patchJobStatus(ctx, cfg, job.ID, map[string]any{
				"status":        "failed",
				"error_message": prepErr.Error(),
			}, "failed:prepare") {
				agentLog(cfg, "log_prepare_print_error", job.ID, prepErr.Error())
			} else {
				agentLog(cfg, "log_job_still_pending", job.ID, "failed:prepare")
			}
			queue = queue[1:]
			blockedSpins = 0
			reorderPasses = 0
			pc.markActivity()
			continue
		}
		agentLog(cfg, "log_printing_job", job.ID, jobRouteStationID(job), target.Display, job.Type)
		setStatus("Printing", summarizeJobPayload(job))
		if !patchJobStatus(ctx, cfg, job.ID, map[string]any{"status": "processing"}, "processing") {
			var allBlocked bool
			queue, allBlocked = deferBlockedHead(queue, &blockedSpins)
			if !allBlocked {
				if throttle.allow("queue_try_other:claim", waitLogEvery) {
					agentLog(cfg, "log_queue_try_other", job.ID)
				}
				pc.markActivity()
				continue
			}
			logBatchAllBlocked(cfg, "claim")
			sleepOrCancel(ctx, pc.sleepFor(pollPhaseBusy))
			continue
		}
		data := escposFromJob(job)
		if err := printToTarget(target, data); err != nil {
			sess.printerReady().notePrintFailure(cfg, sess.cfgPath, target, err)
			if patchJobStatus(ctx, cfg, job.ID, map[string]any{
				"status":        "failed",
				"error_message": err.Error(),
			}, "failed:print") {
				sess.hb.recordPrint(false)
				agentLog(cfg, "log_print_failed", job.ID, jobRouteStationID(job), target.Display, err.Error())
			} else {
				agentLog(cfg, "log_print_failed_stuck", job.ID, target.Display)
			}
			setStatus("Print failed", err.Error())
		} else {
			if patchJobStatus(ctx, cfg, job.ID, map[string]any{"status": "done"}, "done") {
				agentLog(cfg, "log_printed_ok", target.Display, summarizeJobPayload(job), job.ID)
				sess.hb.recordPrint(true)
				setStatus("Ready", "Last print OK")
			} else {
				agentLog(cfg, "log_print_ok_patch_stuck", job.ID, target.Display)
				sess.hb.recordPrint(true)
			}
		}
		queue = queue[1:]
		blockedSpins = 0
		reorderPasses = 0
		pc.markActivity()

		if len(queue) == 0 {
			sleepOrCancel(ctx, pc.sleepFor(pollPhaseAfterPrint))
		}
	}
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
