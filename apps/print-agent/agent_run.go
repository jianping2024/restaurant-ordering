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
	if mode == NotificationModeRealtime && !cfg.hasRealtimeSession() {
		log.Println("Realtime requested but session credentials missing; using polling")
		mode = NotificationModePolling
	}
	setNotifyMode(status, mode)
	log.Printf("Starting agent in %s mode", mode)

	queue := NewJobQueue()

	processor := NewJobProcessor(queue, sess, status)
	go func() {
		if err := processor.Start(ctx); err != nil && err != context.Canceled {
			log.Printf("Processor error: %v", err)
		}
	}()

	go func() {
		if err := runHeartbeatLoop(ctx, sess); err != nil && err != context.Canceled {
			log.Printf("Heartbeat error: %v", err)
		}
	}()

	var notifier Notifier

	if mode == NotificationModeRealtime {
		rt, err := NewRealtimeNotifier(cfg, queue, sess.pc, sess.cfgPath)
		if err != nil {
			log.Printf("Realtime mode unavailable: %v, falling back to polling", err)
			mode = NotificationModePolling
			setNotifyMode(status, mode)
			notifier = NewPollingNotifier(cfg, queue, sess.pc)
		} else {
			notifier = rt
		}
	} else {
		notifier = NewPollingNotifier(cfg, queue, sess.pc)
	}

	if err := notifier.Start(ctx); err != nil && err != context.Canceled {
		log.Printf("Notifier error: %v", err)

		if mode == NotificationModeRealtime {
			log.Println("Realtime failed, falling back to polling mode")
			mode = NotificationModePolling
			setNotifyMode(status, mode)
			notifier = NewPollingNotifier(cfg, queue, sess.pc)
			if err := notifier.Start(ctx); err != nil && err != context.Canceled {
				log.Printf("Polling also failed: %v", err)
			}
		}
	}
}

func setNotifyMode(status *agentStatus, mode NotificationMode) {
	if status != nil {
		status.setMode(mode)
	}
	log.Printf("Print notify mode: %s", mode)
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
