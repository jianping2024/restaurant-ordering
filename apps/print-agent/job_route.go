package main

import (
	"encoding/json"
	"strings"
)

// jobRouteStationID is the mapped station id for logs (station_ticket / receipt station:…).
func jobRouteStationID(job printJob) string {
	if job.Type == "station_ticket" {
		var p struct {
			PrintStationID string `json:"print_station_id"`
		}
		_ = json.Unmarshal(job.Payload, &p)
		if sid := strings.TrimSpace(p.PrintStationID); sid != "" {
			return sid
		}
	}
	if isReceiptPrintJobType(job.Type) {
		var p struct {
			ReceiptPrinterID string `json:"receipt_printer_id"`
		}
		_ = json.Unmarshal(job.Payload, &p)
		rid := strings.TrimSpace(p.ReceiptPrinterID)
		const prefix = "station:"
		if strings.HasPrefix(rid, prefix) {
			if sid := strings.TrimSpace(rid[len(prefix):]); sid != "" {
				return sid
			}
		}
		return "receipt"
	}
	return strings.TrimSpace(job.Type)
}

// reorderQueueAwayFromPrinter moves jobs that use other printers to the front.
// Returns nil when every routable job targets blockedKey (all waiting on that printer).
func reorderQueueAwayFromPrinter(queue []printJob, cfg *config, blockedKey string) []printJob {
	if cfg == nil || len(queue) == 0 || strings.TrimSpace(blockedKey) == "" {
		return queue
	}
	var head, tail []printJob
	for _, j := range queue {
		t, err := cfg.printerTargetForJob(j)
		if err != nil {
			tail = append(tail, j)
			continue
		}
		if targetKey(t) == blockedKey {
			tail = append(tail, j)
		} else {
			head = append(head, j)
		}
	}
	if len(head) == 0 {
		return nil
	}
	return append(head, tail...)
}
