package main

import (
	"testing"
)

// Test getSupabaseURL with explicit configuration
func TestGetSupabaseURLExplicit(t *testing.T) {
	c := &config{
		APIBase:     "https://example.com",
		SupabaseURL: "https://xxx.supabase.co",
	}
	
	got := c.getSupabaseURL()
	want := "https://xxx.supabase.co"
	
	if got != want {
		t.Errorf("getSupabaseURL() = %q, want %q", got, want)
	}
}

// Test getSupabaseURL with inference fallback
func TestGetSupabaseURLInfer(t *testing.T) {
	c := &config{
		APIBase: "http://localhost:3000",
	}
	
	got := c.getSupabaseURL()
	want := "http://localhost:54321"
	
	if got != want {
		t.Errorf("getSupabaseURL() = %q, want %q", got, want)
	}
}

// Test backward compatibility: old configs without supabase_url still work
func TestBackwardCompatibilityOldConfig(t *testing.T) {
	c := &config{
		APIBase:      "https://example.com",
		AgentJWT:     "test-jwt",
		RestaurantID: "test-restaurant",
		// No SupabaseURL, no NotificationMode - old config
	}
	
	// Should default to Realtime
	mode := c.resolveNotificationMode()
	if mode != NotificationModeRealtime {
		t.Errorf("Expected default mode Realtime, got %s", mode)
	}
	
	// Should infer URL
	url := c.getSupabaseURL()
	if url == "" {
		t.Error("Expected inferred URL, got empty string")
	}
}

// Test explicit polling mode configuration
func TestExplicitPollingMode(t *testing.T) {
	c := &config{
		APIBase:          "https://example.com",
		NotificationMode: "polling",
	}
	
	mode := c.resolveNotificationMode()
	if mode != NotificationModePolling {
		t.Errorf("Expected Polling mode, got %s", mode)
	}
}
