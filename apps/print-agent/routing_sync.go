package main

import (
	"bytes"
	"encoding/json"
	"io"
	"log"
	"net/http"
	"strings"
)

func syncRoutingToCloud(cfg *config) {
	if cfg == nil || strings.TrimSpace(cfg.AgentJWT) == "" || strings.TrimSpace(cfg.APIBase) == "" {
		return
	}
	body := map[string]any{
		"station_printers": cfg.StationPrinters,
	}
	raw, err := json.Marshal(body)
	if err != nil {
		return
	}
	url := strings.TrimRight(cfg.APIBase, "/") + "/api/print-agent/routing"
	req, err := http.NewRequest(http.MethodPost, url, bytes.NewReader(raw))
	if err != nil {
		return
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+cfg.AgentJWT)
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		log.Printf("routing sync: %v", err)
		return
	}
	defer res.Body.Close()
	_, _ = io.Copy(io.Discard, res.Body)
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		log.Printf("routing sync: HTTP %d", res.StatusCode)
		return
	}
	log.Printf("routing sync: ok (station maps=%d)", len(cfg.StationPrinters))
}
