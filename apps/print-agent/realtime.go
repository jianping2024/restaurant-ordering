package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

// RealtimeNotifier implements Notifier using Supabase Realtime WebSocket.
type RealtimeNotifier struct {
	config       *config
	queue        *JobQueue
	supabaseURL  string
	jwt          string
	restaurantID string
	
	mu          sync.Mutex
	conn        *websocket.Conn
	reconnectDelay time.Duration
}

// NewRealtimeNotifier creates a new Realtime notifier.
func NewRealtimeNotifier(cfg *config, queue *JobQueue) (*RealtimeNotifier, error) {
	supabaseURL := cfg.getSupabaseURL()
	if supabaseURL == "" {
		return nil, fmt.Errorf("cannot determine supabase_url")
	}
	
	return &RealtimeNotifier{
		config:         cfg,
		queue:          queue,
		supabaseURL:    supabaseURL,
		jwt:            cfg.AgentJWT,
		restaurantID:   cfg.RestaurantID,
		reconnectDelay: 2 * time.Second,
	}, nil
}

// Start begins the Realtime event loop (blocks until context canceled).
func (r *RealtimeNotifier) Start(ctx context.Context) error {
	log.Println("Realtime mode: starting")
	
	// Initial compensation fetch
	if err := r.compensationFetch(ctx); err != nil {
		log.Printf("Realtime: initial fetch failed: %v", err)
	}
	
	// Limit initial connection retries to fail fast for fallback
	const maxInitialRetries = 3
	retries := 0
	connected := false
	
	// Main reconnection loop
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}
		
		if err := r.connect(ctx); err != nil {
			retries++
			log.Printf("Realtime: connection failed: %v (attempt %d/%d)", err, retries, maxInitialRetries)
			
			// If not yet connected and reached retry limit, fail fast for fallback
			if !connected && retries >= maxInitialRetries {
				return fmt.Errorf("realtime connection failed after %d attempts: %w", maxInitialRetries, err)
			}
			
			select {
			case <-time.After(r.reconnectDelay):
				r.increaseBackoff()
			case <-ctx.Done():
				return ctx.Err()
			}
			continue
		}
		
		// Connection successful
		connected = true
		retries = 0
		r.reconnectDelay = 2 * time.Second
		
		// Post-connection compensation
		if err := r.compensationFetch(ctx); err != nil {
			log.Printf("Realtime: post-connect fetch failed: %v", err)
		}
		
		// Event loop (blocks until disconnect)
		r.eventLoop(ctx)
		
		log.Println("Realtime: connection lost, reconnecting...")
		// After first successful connection, unlimited reconnect attempts
	}
}

func (r *RealtimeNotifier) connect(ctx context.Context) error {
	wsURL, err := r.buildWebSocketURL()
	if err != nil {
		return err
	}
	
	header := http.Header{}
	header.Set("Authorization", "Bearer "+r.jwt)
	
	dialer := websocket.Dialer{
		HandshakeTimeout: 10 * time.Second,
	}
	
	conn, _, err := dialer.DialContext(ctx, wsURL, header)
	if err != nil {
		return err
	}
	
	r.mu.Lock()
	r.conn = conn
	r.mu.Unlock()
	
	// Subscribe to print_jobs table
	if err := r.subscribe(); err != nil {
		conn.Close()
		return err
	}
	
	log.Println("Realtime: connected and subscribed")
	return nil
}

func (r *RealtimeNotifier) buildWebSocketURL() (string, error) {
	u, err := url.Parse(r.supabaseURL)
	if err != nil {
		return "", err
	}
	
	// Convert https:// to wss://
	u.Scheme = "wss"
	u.Path = "/realtime/v1/websocket"
	
	// Add access_token
	q := u.Query()
	q.Set("apikey", r.jwt)
	q.Set("vsn", "1.0.0")
	u.RawQuery = q.Encode()
	
	return u.String(), nil
}

func (r *RealtimeNotifier) subscribe() error {
	// Phoenix Channel subscription message
	msg := map[string]interface{}{
		"topic": fmt.Sprintf("realtime:print_jobs:restaurant_id=eq.%s", r.restaurantID),
		"event": "phx_join",
		"payload": map[string]interface{}{
			"config": map[string]interface{}{
				"postgres_changes": []map[string]interface{}{
					{
						"event":  "*",
						"schema": "public",
						"table":  "print_jobs",
						"filter": fmt.Sprintf("restaurant_id=eq.%s", r.restaurantID),
					},
				},
			},
		},
		"ref": "1",
	}
	
	r.mu.Lock()
	conn := r.conn
	r.mu.Unlock()
	
	if conn == nil {
		return fmt.Errorf("no connection")
	}
	
	return conn.WriteJSON(msg)
}

func (r *RealtimeNotifier) eventLoop(ctx context.Context) {
	heartbeatTicker := time.NewTicker(30 * time.Second)
	defer heartbeatTicker.Stop()
	
	// Goroutine for reading messages
	messages := make(chan []byte, 10)
	errors := make(chan error, 1)
	
	go func() {
		for {
			_, msg, err := r.conn.ReadMessage()
			if err != nil {
				errors <- err
				return
			}
			messages <- msg
		}
	}()
	
	for {
		select {
		case <-ctx.Done():
			r.disconnect()
			return
			
		case <-heartbeatTicker.C:
			if err := r.sendHeartbeat(); err != nil {
				log.Printf("Realtime: heartbeat failed: %v", err)
				if err := r.compensationFetch(ctx); err != nil {
					log.Printf("Realtime: heartbeat compensation fetch failed: %v", err)
				}
				r.disconnect()
				return
			}
			
		case msg := <-messages:
			r.handleMessage(msg)
			
		case err := <-errors:
			log.Printf("Realtime: read error: %v", err)
			r.disconnect()
			return
		}
	}
}

func (r *RealtimeNotifier) sendHeartbeat() error {
	msg := map[string]interface{}{
		"topic": "phoenix",
		"event": "heartbeat",
		"payload": map[string]interface{}{},
		"ref": fmt.Sprintf("%d", time.Now().Unix()),
	}
	
	r.mu.Lock()
	defer r.mu.Unlock()
	
	if r.conn == nil {
		return fmt.Errorf("no connection")
	}
	
	return r.conn.WriteJSON(msg)
}

func (r *RealtimeNotifier) handleMessage(msg []byte) {
	var envelope struct {
		Event   string          `json:"event"`
		Payload json.RawMessage `json:"payload"`
	}
	
	if err := json.Unmarshal(msg, &envelope); err != nil {
		log.Printf("Realtime: failed to parse message: %v", err)
		return
	}
	
	// Handle postgres_changes events
	if envelope.Event == "postgres_changes" {
		var payload struct {
			Data struct {
				Type   string          `json:"type"`
				Record json.RawMessage `json:"record"`
			} `json:"data"`
		}
		
		if err := json.Unmarshal(envelope.Payload, &payload); err != nil {
			log.Printf("Realtime: failed to parse postgres_changes: %v", err)
			return
		}
		
		// Parse print job from record
		var job printJob
		if err := json.Unmarshal(payload.Data.Record, &job); err != nil {
			log.Printf("Realtime: failed to parse job record: %v", err)
			return
		}
		
		// Only process pending jobs
		if job.Status != "pending" {
			return
		}
		
		// Check if this agent can print this job
		if !r.canPrintJob(&job) {
			return
		}
		
		// Push to queue (dedup inside)
		if r.queue.Push(job) {
			log.Printf("Realtime: enqueued job %s (type=%s)", job.ID, job.Type)
		}
	}
}

func (r *RealtimeNotifier) canPrintJob(job *printJob) bool {
	_, err := r.config.printerTargetForJob(*job)
	return err == nil
}

func (r *RealtimeNotifier) compensationFetch(ctx context.Context) error {
	jobs, err := fetchPending(ctx, r.config.APIBase, r.jwt)
	if err != nil {
		return err
	}
	
	count := 0
	for _, job := range jobs {
		if r.queue.Push(job) {
			count++
		}
	}
	
	if count > 0 {
		log.Printf("Realtime: compensation fetch enqueued %d jobs", count)
	}
	
	return nil
}

func (r *RealtimeNotifier) disconnect() {
	r.mu.Lock()
	defer r.mu.Unlock()
	
	if r.conn != nil {
		r.conn.Close()
		r.conn = nil
	}
}

func (r *RealtimeNotifier) increaseBackoff() {
	r.reconnectDelay *= 2
	if r.reconnectDelay > 60*time.Second {
		r.reconnectDelay = 60 * time.Second
	}
}

// inferSupabaseURL derives the Supabase project URL from api_base.
// Example: https://example.com/api -> https://xxx.supabase.co
func inferSupabaseURL(apiBase string) string {
	// For local development
	if apiBase == "http://localhost:3000" || apiBase == "http://0.0.0.0:3000" {
		return "http://localhost:54321" // Supabase local
	}
	
	// For production, try to parse from API base
	// This is a simplified implementation - adjust based on actual deployment
	u, err := url.Parse(apiBase)
	if err != nil {
		return ""
	}
	
	// If API is hosted on same domain as Supabase, this needs adjustment
	// For now, assume standard Supabase URL pattern
	return u.Scheme + "://" + u.Host
}
