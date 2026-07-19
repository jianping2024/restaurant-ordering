package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// refreshSupabaseSession exchanges refresh_token for a new access/refresh pair.
// Updates cfg in place and returns an error if refresh fails.
func refreshSupabaseSession(ctx context.Context, cfg *config) error {
	if cfg == nil || !cfg.hasRealtimeSession() {
		return fmt.Errorf("no realtime session")
	}
	base := strings.TrimRight(cfg.getSupabaseURL(), "/")
	if base == "" {
		return fmt.Errorf("missing supabase_url")
	}

	form := url.Values{}
	form.Set("grant_type", "refresh_token")
	form.Set("refresh_token", cfg.RefreshToken)

	req, err := http.NewRequestWithContext(
		ctx,
		http.MethodPost,
		base+"/auth/v1/token?grant_type=refresh_token",
		bytes.NewBufferString(form.Encode()),
	)
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("apikey", cfg.AnonKey)
	req.Header.Set("Authorization", "Bearer "+cfg.AnonKey)

	client := &http.Client{Timeout: 15 * time.Second}
	res, err := client.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	raw, _ := io.ReadAll(res.Body)
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return fmt.Errorf("refresh %s: %s", res.Status, string(raw))
	}

	var out struct {
		AccessToken  string `json:"access_token"`
		RefreshToken string `json:"refresh_token"`
	}
	if err := json.Unmarshal(raw, &out); err != nil {
		return err
	}
	if strings.TrimSpace(out.AccessToken) == "" || strings.TrimSpace(out.RefreshToken) == "" {
		return fmt.Errorf("refresh: missing tokens")
	}
	cfg.AccessToken = out.AccessToken
	cfg.RefreshToken = out.RefreshToken
	return nil
}
