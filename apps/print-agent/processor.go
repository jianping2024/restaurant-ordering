package main

import (
	"context"
	"errors"
	"log"
	"strconv"
	"time"
)

// JobProcessor processes print jobs from a queue.
type JobProcessor struct {
	queue   *JobQueue
	config  *config
	session *agentSession
	status  *agentStatus
}

// NewJobProcessor creates a new job processor.
func NewJobProcessor(queue *JobQueue, session *agentSession, status *agentStatus) *JobProcessor {
	return &JobProcessor{
		queue:   queue,
		session: session,
		status:  status,
	}
}

// Start begins processing jobs from the queue (blocks until context canceled).
func (p *JobProcessor) Start(ctx context.Context) error {
	log.Println("Job processor: starting")

	var throttle pollLogThrottle
	const waitLogEvery = 60 * time.Second

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		// Reload config periodically
		reloadAgentSessionConfig(p.session)
		p.config = p.session.cfg
		if p.config == nil {
			p.setStatus("Error", "config missing")
			time.Sleep(5 * time.Second)
			continue
		}

		// Try to get a job from queue
		job, ok := p.queue.Pop()
		if !ok {
			// Empty: Ready only sticks when open (closed tray owned by schedule loop).
			p.setStatus("Ready", "Waiting for jobs")
			time.Sleep(1 * time.Second)
			continue
		}

		if p.session != nil && p.session.pc != nil {
			open, err := p.session.pc.scheduleOpen()
			if err != nil {
				p.setStatus("Schedule error", err.Error())
				p.queue.Forget(job.ID)
				p.queue.ClearPending()
				time.Sleep(5 * time.Second)
				continue
			}
			if !open {
				// Discard in-flight + remaining; schedule loop also clears and owns yellow tray.
				p.queue.Forget(job.ID)
				p.queue.ClearPending()
				time.Sleep(5 * time.Second)
				continue
			}
		}

		// Process the job
		p.setStatus("Processing", strconv.Itoa(p.queue.Len()+1)+" job(s) in queue")

		// Check expiration
		if jobPrintExpired(job) {
			if patchJobStatus(ctx, p.config, job.ID, map[string]any{
				"status":        "failed",
				"error_message": errPrintJobExpired.Error(),
			}, "failed:expired") {
				agentLog(p.config, "log_skipped_expired", job.ID)
			}
			continue
		}

		// Resolve printer target
		target, err := p.config.printerTargetForJob(job)
		if err != nil {
			if errors.Is(err, errReceiptPrintDeferred) {
				// Re-queue for later (up to 20 minutes)
				if throttle.allow("receipt_deferred", waitLogEvery) {
					agentLog(p.config, "log_receipt_deferred")
				}
				p.setStatus("Waiting for receipt printer", "Map a station in Settings")
				// Put back in queue (will retry)
				p.queue.Push(job)
				time.Sleep(5 * time.Second)
				continue
			}

			// Permanent routing error
			if patchJobStatus(ctx, p.config, job.ID, map[string]any{
				"status":        "failed",
				"error_message": err.Error(),
			}, "failed:route") {
				agentLog(p.config, "log_route_error", job.ID, jobRouteStationID(job), err.Error())
			}
			continue
		}

		// Check printer readiness
		if prepErr := preparePrint(target); prepErr != nil {
			if errors.Is(prepErr, errPrinterNotReady) {
				if throttle.allow("printer_not_ready:"+targetKey(target), waitLogEvery) {
					agentLog(p.config, "log_printer_not_ready", target.Display, jobRouteStationID(job), prepErr.Error())
				}
				p.setStatus("Waiting for printer", "Printer not ready; retrying")
				// Put back in queue (will retry)
				p.queue.Push(job)
				time.Sleep(5 * time.Second)
				continue
			}

			// Permanent prepare error
			if patchJobStatus(ctx, p.config, job.ID, map[string]any{
				"status":        "failed",
				"error_message": prepErr.Error(),
			}, "failed:prepare") {
				agentLog(p.config, "log_prepare_print_error", job.ID, prepErr.Error())
			}
			continue
		}

		// Claim job (PATCH to processing)
		agentLog(p.config, "log_printing_job", job.ID, jobRouteStationID(job), target.Display, job.Type)
		p.setStatus("Printing", summarizeJobPayload(job))

		if !patchJobStatus(ctx, p.config, job.ID, map[string]any{"status": "processing"}, "processing") {
			// Failed to claim, another agent may have taken it or state changed
			continue
		}

		// Print the job
		data := escposFromJob(job)
		if err := printToTarget(target, data); err != nil {
			// Print failed
			if patchJobStatus(ctx, p.config, job.ID, map[string]any{
				"status":        "failed",
				"error_message": err.Error(),
			}, "failed:print") {
				p.session.hb.recordPrint(false)
				agentLog(p.config, "log_print_failed", job.ID, jobRouteStationID(job), target.Display, err.Error())
			}
			p.setStatus("Print failed", err.Error())
		} else {
			// Print successful
			if patchJobStatus(ctx, p.config, job.ID, map[string]any{"status": "done"}, "done") {
				agentLog(p.config, "log_printed_ok", target.Display, summarizeJobPayload(job), job.ID)
				p.session.hb.recordPrint(true)
				p.setStatus("Ready", "Last print OK")
			} else {
				agentLog(p.config, "log_print_ok_patch_stuck", job.ID, target.Display)
				p.session.hb.recordPrint(true)
			}
		}

		// Mark activity
		if p.session.pc != nil {
			p.session.pc.markActivity()
		}
	}
}

func (p *JobProcessor) setStatus(summary, detail string) {
	if p.status != nil {
		p.status.set(summary, detail)
	}
}
