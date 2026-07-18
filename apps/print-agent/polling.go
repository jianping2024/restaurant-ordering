package main

import (
	"context"
	"log"
	"time"
)

// PollingNotifier implements Notifier using HTTP polling (fallback mode).
type PollingNotifier struct {
	config *config
	queue  *JobQueue
	pc     *pollController
}

// NewPollingNotifier creates a new polling notifier.
func NewPollingNotifier(cfg *config, queue *JobQueue, pc *pollController) *PollingNotifier {
	return &PollingNotifier{
		config: cfg,
		queue:  queue,
		pc:     pc,
	}
}

// Start begins the polling loop (blocks until context canceled).
func (p *PollingNotifier) Start(ctx context.Context) error {
	log.Println("Polling mode: starting")
	
	// Initial fetch
	if err := p.fetch(ctx); err != nil {
		log.Printf("Polling: initial fetch failed: %v", err)
	}
	
	hadJobs := false
	
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}
		
		// Check schedule
		open, err := p.pc.scheduleOpen()
		if err != nil {
			log.Printf("Polling: schedule error: %v", err)
			select {
			case <-time.After(p.pc.sleepFor(pollPhaseError)):
			case <-ctx.Done():
				return ctx.Err()
			}
			continue
		}
		
		if !open {
			// Outside business hours, sleep longer
			select {
			case <-time.After(p.pc.sleepFor(pollPhaseClosed)):
			case <-ctx.Done():
				return ctx.Err()
			}
			continue
		}
		
		// Fetch pending jobs
		if err := p.fetch(ctx); err != nil {
			log.Printf("Polling: fetch failed: %v", err)
			select {
			case <-time.After(p.pc.sleepFor(pollPhaseError)):
			case <-ctx.Done():
				return ctx.Err()
			}
			continue
		}
		
		// Determine phase and sleep duration
		queueLen := p.queue.Len()
		phase := p.pc.phase(queueLen > 0, false)
		
		if queueLen > 0 && !hadJobs {
			p.pc.markActivity()
			hadJobs = true
		} else if queueLen == 0 {
			hadJobs = false
		}
		
		select {
		case <-time.After(p.pc.sleepFor(phase)):
		case <-ctx.Done():
			return ctx.Err()
		}
	}
}

func (p *PollingNotifier) fetch(ctx context.Context) error {
	jobs, err := fetchPending(ctx, p.config.APIBase, p.config.AgentJWT)
	if err != nil {
		return err
	}
	
	count := 0
	for _, job := range jobs {
		// Filter by routing (same as Realtime)
		if _, err := p.config.printerTargetForJob(job); err != nil {
			continue
		}
		
		if p.queue.Push(job) {
			count++
		}
	}
	
	if count > 0 {
		log.Printf("Polling: enqueued %d jobs", count)
	}
	
	return nil
}
