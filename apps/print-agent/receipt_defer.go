package main

import (
	"errors"
	"fmt"
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

// soleMappedStationAddr returns the printer address when exactly one station is mapped.
func (c *config) soleMappedStationAddr() (string, bool) {
	if c.StationPrinters == nil {
		return "", false
	}
	var found string
	n := 0
	for _, v := range c.StationPrinters {
		addr := strings.TrimSpace(v)
		if addr == "" {
			continue
		}
		n++
		found = addr
		if n > 1 {
			return "", false
		}
	}
	if n == 1 {
		return found, true
	}
	return "", false
}

func (c *config) resolveReceiptRouting(job printJob, explicitID string) (string, error) {
	id := strings.TrimSpace(explicitID)
	if id != "" {
		return c.resolveReceiptPrinterID(id)
	}
	if addr, ok := c.soleMappedStationAddr(); ok {
		return addr, nil
	}
	if jobCreatedWithin(job, receiptPrintDeferWindow) {
		return "", errReceiptPrintDeferred
	}
	if c.hasPrinterRouting() {
		return "", fmt.Errorf("receipt_printer_id required (multiple stations mapped; picker not set)")
	}
	return "", fmt.Errorf("receipt_printer_id required (no station printers configured within 20 minutes)")
}
