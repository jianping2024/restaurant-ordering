package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
)

func syncRoutingToCloud(cfg *config) error {
	if cfg == nil || strings.TrimSpace(cfg.AgentJWT) == "" || strings.TrimSpace(cfg.APIBase) == "" {
		return nil
	}
	body := map[string]any{
		"station_printers": cfg.StationPrinters,
	}
	raw, err := json.Marshal(body)
	if err != nil {
		return err
	}
	url := strings.TrimRight(cfg.APIBase, "/") + "/api/print-agent/routing"
	req, err := http.NewRequest(http.MethodPost, url, bytes.NewReader(raw))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+cfg.AgentJWT)
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		agentLogTech(cfg, "log_routing_sync_fail", err.Error())
		return err
	}
	defer res.Body.Close()
	_, _ = io.Copy(io.Discard, res.Body)
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		agentLog(cfg, "log_routing_sync_http", res.StatusCode)
		return fmt.Errorf("HTTP %d", res.StatusCode)
	}
	agentLog(cfg, "log_routing_sync_ok", len(cfg.StationPrinters))
	return nil
}
