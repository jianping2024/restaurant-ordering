package main

import (
	"errors"
	"fmt"
	"sort"
	"strings"
	"time"
)

const receiptPrintDeferWindow = 20 * time.Minute

// errReceiptPrintDeferred — job stays pending; agent retries until printer is mapped or window expires.
var errReceiptPrintDeferred = errors.New("receipt printer not ready; will retry within 20 minutes")

func jobCreatedWithin(job printJob, within time.Duration) bool {
	raw := strings.TrimSpace(job.CreatedAt)
	if raw == "" {
		return true
	}
	for _, layout := range []string{
		time.RFC3339Nano,
		time.RFC3339,
		"2006-01-02T15:04:05.999999999Z07:00",
	} {
		if t, err := time.Parse(layout, raw); err == nil {
			return time.Since(t) <= within
		}
	}
	return true
}

func (c *config) firstMappedStationAddr() (string, bool) {
	if c.StationPrinters == nil {
		return "", false
	}
	ids := c.mappedStationIDsSorted()
	if len(ids) == 0 {
		return "", false
	}
	return strings.TrimSpace(c.StationPrinters[ids[0]]), true
}

func (c *config) mappedStationIDsSorted() []string {
	var ids []string
	for id, addr := range c.StationPrinters {
		if strings.TrimSpace(id) == "" || strings.TrimSpace(addr) == "" {
			continue
		}
		ids = append(ids, id)
	}
	sort.Strings(ids)
	return ids
}

func (c *config) resolveReceiptRouting(job printJob, explicitID string) (string, error) {
	id := strings.TrimSpace(explicitID)
	if id != "" {
		return c.resolveReceiptPrinterID(id)
	}
	if addr, ok := c.firstMappedStationAddr(); ok {
		return addr, nil
	}
	if jobCreatedWithin(job, receiptPrintDeferWindow) {
		return "", errReceiptPrintDeferred
	}
	return "", fmt.Errorf("receipt_printer_id required (no station printers configured within 20 minutes)")
}
