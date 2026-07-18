package main

import (
	"context"
	"log"
	"time"
)

// runNotificationLoop starts the agent with the configured notification mode.
func runNotificationLoop(ctx context.Context, sess *agentSession, status *agentStatus) {
	reloadAgentSessionConfig(sess)
	cfg := sess.cfg
	if cfg == nil {
		log.Fatal("config missing")
		return
	}
	
	mode := cfg.resolveNotificationMode()
	log.Printf("Starting agent in %s mode", mode)
	
	// Create shared job queue
	queue := NewJobQueue()
	
	// Start job processor
	processor := NewJobProcessor(queue, sess, status)
	go func() {
		if err := processor.Start(ctx); err != nil && err != context.Canceled {
			log.Printf("Processor error: %v", err)
		}
	}()
	
	// Start heartbeat goroutine
	go func() {
		if err := runHeartbeatLoop(ctx, sess); err != nil && err != context.Canceled {
			log.Printf("Heartbeat error: %v", err)
		}
	}()
	
	// Start notifier based on mode
	var notifier Notifier
	var err error
	
	switch mode {
	case NotificationModeRealtime:
		notifier, err = NewRealtimeNotifier(cfg, queue)
		if err != nil {
			log.Printf("Realtime mode unavailable: %v, falling back to polling", err)
			mode = NotificationModePolling
		}
		
	case NotificationModePolling:
		notifier = NewPollingNotifier(cfg, queue, sess.pc)
	}
	
	// Run notifier (blocks)
	if err := notifier.Start(ctx); err != nil && err != context.Canceled {
		log.Printf("Notifier error: %v", err)
	}
}

// runHeartbeatLoop sends periodic heartbeats to the server.
func runHeartbeatLoop(ctx context.Context, sess *agentSession) error {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()
	
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-ticker.C:
			cfg := sess.cfg
			if cfg == nil {
				continue
			}
			
			open := true
			if sess.pc != nil {
				if o, err := sess.pc.scheduleOpen(); err == nil {
					open = o
				}
			}
			
			if err := postHeartbeat(ctx, cfg, open, &sess.hb); err != nil {
				agentLogTech(cfg, "log_heartbeat_error", err.Error())
			}
		}
	}
}
