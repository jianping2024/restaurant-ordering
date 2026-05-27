package main

import (
	"sort"
	"strings"
)

// firstMappedStationPrinter picks a stable test-print target: USB/WinSpool first, then LAN.
func firstMappedStationPrinter(cfg *config) (stationID, rawAddr string) {
	if cfg == nil || cfg.StationPrinters == nil {
		return "", ""
	}
	ids := make([]string, 0, len(cfg.StationPrinters))
	for sid, raw := range cfg.StationPrinters {
		if strings.TrimSpace(raw) != "" {
			ids = append(ids, sid)
		}
	}
	sort.Strings(ids)
	var usbFirst, rest []string
	for _, sid := range ids {
		raw := strings.TrimSpace(cfg.StationPrinters[sid])
		t, err := parsePrinterTarget(raw)
		if err == nil && t.Scheme == schemeWinspool {
			usbFirst = append(usbFirst, sid)
		} else {
			rest = append(rest, sid)
		}
	}
	pick := append(usbFirst, rest...)
	if len(pick) == 0 {
		return "", ""
	}
	sid := pick[0]
	return sid, strings.TrimSpace(cfg.StationPrinters[sid])
}
