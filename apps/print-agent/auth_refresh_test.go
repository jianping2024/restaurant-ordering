package main

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestRefreshSupabaseSessionJSONBody(t *testing.T) {
	var gotCT string
	var gotBody map[string]string
	var gotPath string

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.String()
		gotCT = r.Header.Get("Content-Type")
		raw, _ := io.ReadAll(r.Body)
		if err := json.Unmarshal(raw, &gotBody); err != nil {
			http.Error(w, `{"msg":"not json"}`, http.StatusBadRequest)
			return
		}
		_ = json.NewEncoder(w).Encode(map[string]string{
			"access_token":  "new-access",
			"refresh_token": "new-refresh",
		})
	}))
	defer srv.Close()

	cfg := &config{
		SupabaseURL:  srv.URL,
		AnonKey:      "anon",
		AccessToken:  "old-access",
		RefreshToken: "old-refresh",
	}
	if err := refreshSupabaseSession(context.Background(), cfg); err != nil {
		t.Fatalf("refresh: %v", err)
	}
	if !strings.Contains(gotPath, "grant_type=refresh_token") {
		t.Fatalf("path = %q, want grant_type query", gotPath)
	}
	if !strings.HasPrefix(gotCT, "application/json") {
		t.Fatalf("Content-Type = %q, want application/json", gotCT)
	}
	if gotBody["refresh_token"] != "old-refresh" {
		t.Fatalf("body = %#v", gotBody)
	}
	if cfg.AccessToken != "new-access" || cfg.RefreshToken != "new-refresh" {
		t.Fatalf("tokens not updated: access=%q refresh=%q", cfg.AccessToken, cfg.RefreshToken)
	}
}

func TestAccessTokenUnexpired(t *testing.T) {
	mk := func(exp time.Time) string {
		payload, _ := json.Marshal(map[string]int64{"exp": exp.Unix()})
		return "x." + base64.RawURLEncoding.EncodeToString(payload) + ".y"
	}
	if !accessTokenUnexpired(mk(time.Now().Add(10*time.Minute)), time.Minute) {
		t.Fatal("expected unexpired")
	}
	if accessTokenUnexpired(mk(time.Now().Add(30*time.Second)), time.Minute) {
		t.Fatal("expected expired under skew")
	}
	if accessTokenUnexpired("not-a-jwt", 0) {
		t.Fatal("garbage should be expired")
	}
}
