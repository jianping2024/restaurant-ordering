package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

type config struct {
	APIBase         string            `json:"api_base"`
	AgentJWT        string            `json:"agentjwt"`
	DeviceID        string            `json:"device_id"`
	PrinterHost     string            `json:"printer_host,omitempty"`
	DefaultPrinter  string            `json:"default_printer,omitempty"` // legacy file field; not used for receipt routing
	CashierPrinter  string            `json:"cashier_printer,omitempty"` // legacy; cleared on save, not used for routing
	StationPrinters map[string]string `json:"station_printers,omitempty"`
	Schedule        *scheduleConfig   `json:"schedule,omitempty"`
	Poll            *pollConfig       `json:"poll,omitempty"`
	// UILocale: zh | en | pt — tray, wizards, and local test print only (not order tickets).
	UILocale string `json:"ui_locale,omitempty"`
	// ValidUntil: RFC3339 from claim; used for tray renewal hints (half-year credential).
	ValidUntil string `json:"valid_until,omitempty"`
	// TextEncoding: auto | utf8 | gbk | latin — Chinese/non-Latin bytes on thermal paper (UI/test + zh jobs).
	TextEncoding string `json:"text_encoding,omitempty"`
}

// configPathOverride is set by tests only.
var configPathOverride string

func defaultConfigPath() string {
	if configPathOverride != "" {
		return configPathOverride
	}
	home, err := os.UserHomeDir()
	if err != nil {
		return "mesa-print-agent.json"
	}
	return filepath.Join(home, ".config", "mesa-print-agent", "config.json")
}

func loadConfig(path string) (*config, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var c config
	if err := json.Unmarshal(raw, &c); err != nil {
		return nil, err
	}
	return &c, nil
}

func saveConfig(path string, c *config) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return err
	}
	raw, err := json.MarshalIndent(c, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, raw, 0o600)
}

func normalizeHostPort(hostPort string, defaultPort string) string {
	hostPort = strings.TrimSpace(hostPort)
	if hostPort == "" {
		return ""
	}
	if strings.Contains(hostPort, ":") {
		return hostPort
	}
	return hostPort + ":" + defaultPort
}

func isReceiptPrintJobType(jobType string) bool {
	return jobType == "order_receipt" || jobType == "pre_bill"
}

func (c *config) resolveReceiptPrinterID(id string) (string, error) {
	id = strings.TrimSpace(id)
	if id == "" {
		return "", fmt.Errorf("receipt_printer_id required")
	}
	if id == "cashier" {
		return "", fmt.Errorf("receipt_printer_id cashier is no longer supported; use station:{id}")
	}
	const prefix = "station:"
	if !strings.HasPrefix(id, prefix) {
		return "", fmt.Errorf("unknown receipt_printer_id %q", id)
	}
	sid := strings.TrimSpace(id[len(prefix):])
	if sid == "" {
		return "", fmt.Errorf("invalid receipt_printer_id")
	}
	if c.StationPrinters != nil {
		if v := strings.TrimSpace(c.StationPrinters[sid]); v != "" {
			return v, nil
		}
	}
	return "", fmt.Errorf("no station_printers mapping for print_station_id %s", sid)
}

func (c *config) printerAddrForJob(job printJob) (string, error) {
	if isReceiptPrintJobType(job.Type) {
		var p struct {
			ReceiptPrinterID string `json:"receipt_printer_id"`
		}
		_ = json.Unmarshal(job.Payload, &p)
		return c.resolveReceiptRouting(job, p.ReceiptPrinterID)
	}

	if job.Type == "station_ticket" {
		var p struct {
			PrintStationID string `json:"print_station_id"`
		}
		_ = json.Unmarshal(job.Payload, &p)
		sid := strings.TrimSpace(p.PrintStationID)
		if sid == "" {
			return "", fmt.Errorf("station_ticket missing print_station_id")
		}
		if c.StationPrinters != nil {
			if v := strings.TrimSpace(c.StationPrinters[sid]); v != "" {
				return v, nil
			}
		}
		return "", fmt.Errorf("no station_printers mapping for print_station_id %s", sid)
	}

	// Unknown job types: do not route to cashier (keeps roles separate).
	return "", fmt.Errorf("unsupported print job type %q", job.Type)
}

// mergePrinterConfig keeps local printer routing when re-pairing with a new code.
func mergePrinterConfig(prev, next *config) {
	if prev == nil || next == nil {
		return
	}
	if strings.TrimSpace(prev.DeviceID) != "" && strings.TrimSpace(next.DeviceID) == "" {
		next.DeviceID = prev.DeviceID
	}
	if len(prev.StationPrinters) > 0 {
		next.StationPrinters = prev.StationPrinters
	}
	if strings.TrimSpace(prev.UILocale) != "" {
		next.UILocale = prev.UILocale
	}
	if strings.TrimSpace(prev.ValidUntil) != "" && strings.TrimSpace(next.ValidUntil) == "" {
		next.ValidUntil = prev.ValidUntil
	}
	if strings.TrimSpace(prev.TextEncoding) != "" && strings.TrimSpace(next.TextEncoding) == "" {
		next.TextEncoding = prev.TextEncoding
	}
}

func savePairConfig(configPath string, next *config) error {
	var prev *config
	if p, err := loadConfig(configPath); err == nil {
		prev = p
	}
	mergePrinterConfig(prev, next)
	return saveConfig(configPath, next)
}

func deviceIDForPairing(configPath string) string {
	if prev, err := loadConfig(configPath); err == nil {
		if id := strings.TrimSpace(prev.DeviceID); looksLikeUUID(id) {
			return id
		}
	}
	return newUUID()
}

func looksLikeUUID(s string) bool {
	if len(s) != 36 {
		return false
	}
	for i, ch := range s {
		switch i {
		case 8, 13, 18, 23:
			if ch != '-' {
				return false
			}
		default:
			if !((ch >= '0' && ch <= '9') || (ch >= 'a' && ch <= 'f') || (ch >= 'A' && ch <= 'F')) {
				return false
			}
		}
	}
	return true
}
