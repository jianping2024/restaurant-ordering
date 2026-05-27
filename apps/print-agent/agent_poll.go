package main

import (
	"context"
	"errors"
	"log"
	"strconv"
	"time"
)

func runPollLoop(ctx context.Context, sess *agentSession, status *agentStatus) {
	cfg := sess.cfg
	pc := sess.pc
	var lastLogged pollPhase
	var queue []printJob

	setStatus := func(summary, detail string) {
		if status != nil {
			status.set(summary, detail)
		}
	}
	setStatus("Starting", cfg.APIBase)

	for {
		select {
		case <-ctx.Done():
			setStatus("Stopped", "")
			return
		default:
		}

		open, err := pc.scheduleOpen()
		if err != nil {
			log.Println("schedule:", err)
			setStatus("Schedule error", err.Error())
			sleepOrCancel(ctx, pc.sleepFor(pollPhaseError))
			continue
		}
		if !open {
			queue = nil
			if lastLogged != pollPhaseClosed {
				if wait, werr := pc.closedSleep(); werr == nil {
					log.Printf("outside schedule — sleeping %s (no API polls)", wait.Round(time.Second))
					setStatus("Outside business hours", "Not polling until next window")
				} else {
					log.Println("outside schedule — no API polls")
					setStatus("Outside business hours", "Not polling")
				}
				lastLogged = pollPhaseClosed
			}
			sleepOrCancel(ctx, pc.sleepFor(pollPhaseClosed))
			continue
		}
		if lastLogged == pollPhaseClosed {
			log.Println("schedule open — resuming polls")
			lastLogged = ""
		}

		if len(queue) == 0 {
			jobs, err := fetchPending(cfg.APIBase, cfg.AgentJWT)
			phase := pc.phase(len(jobs) > 0, err != nil)
			if err != nil {
				if lastLogged != pollPhaseError {
					log.Println("pending-jobs:", err)
					lastLogged = pollPhaseError
				}
				setStatus("Connection problem", err.Error())
				sleepOrCancel(ctx, pc.sleepFor(pollPhaseError))
				continue
			}
			if len(jobs) == 0 {
				if lastLogged != phase && phase != pollPhaseIdle {
					log.Printf("poll %s — next check in %s", phase, pc.sleepFor(phase).Round(time.Second))
					lastLogged = phase
				} else if lastLogged != phase {
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
			_ = patchJob(cfg.APIBase, cfg.AgentJWT, job.ID, map[string]any{
				"status":        "failed",
				"error_message": errPrintJobExpired.Error(),
			})
			log.Printf("skipped expired job %s (created %s)", job.ID, job.CreatedAt)
			queue = queue[1:]
			pc.markActivity()
			continue
		}
		target, err := cfg.printerTargetForJob(job)
		if err != nil {
			if errors.Is(err, errReceiptPrintDeferred) {
				if len(queue) > 1 {
					queue = append(queue[1:], queue[0])
				} else {
					queue = nil
				}
				if lastLogged != pollPhaseBusy {
					log.Println("receipt job waiting for printer mapping (up to 20m)")
					lastLogged = pollPhaseBusy
				}
				setStatus("Waiting for receipt printer", "Map a station in Settings (up to 20 min)")
				sleepOrCancel(ctx, pc.sleepFor(pollPhaseBusy))
				pc.markActivity()
				continue
			}
			_ = patchJob(cfg.APIBase, cfg.AgentJWT, job.ID, map[string]any{
				"status":        "failed",
				"error_message": err.Error(),
			})
			log.Println("route:", err)
			queue = queue[1:]
			pc.markActivity()
			continue
		}
		setStatus("Printing", summarizeJobPayload(job))
		if err := patchJob(cfg.APIBase, cfg.AgentJWT, job.ID, map[string]any{"status": "processing"}); err != nil {
			log.Println("claim job:", err)
			sleepOrCancel(ctx, pc.sleepFor(pollPhaseBusy))
			continue
		}
		data := escposFromJob(job)
		if err := printToTarget(target, data); err != nil {
			_ = patchJob(cfg.APIBase, cfg.AgentJWT, job.ID, map[string]any{
				"status":        "failed",
				"error_message": err.Error(),
			})
			log.Printf("print failed (%s): %v", target.Display, err)
			setStatus("Print failed", err.Error())
		} else {
			if err := patchJob(cfg.APIBase, cfg.AgentJWT, job.ID, map[string]any{"status": "done"}); err != nil {
				log.Println("mark done:", err)
			} else {
				log.Printf("printed job %s (%s) -> %s\n  ticket: %s", job.ID, job.Type, target.Display, summarizeJobPayload(job))
			}
			setStatus("Ready", "Last print OK")
		}
		queue = queue[1:]
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
