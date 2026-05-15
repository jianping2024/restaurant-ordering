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
	DefaultPrinter  string            `json:"default_printer,omitempty"`
	StationPrinters map[string]string `json:"station_printers,omitempty"`
	Schedule        *scheduleConfig   `json:"schedule,omitempty"`
	Poll            *pollConfig       `json:"poll,omitempty"`
}

func defaultConfigPath() string {
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

func (c *config) defaultPrinterAddr() string {
	if hp := normalizeHostPort(c.DefaultPrinter, "9100"); hp != "" {
		return hp
	}
	if hp := normalizeHostPort(c.PrinterHost, "9100"); hp != "" {
		return hp
	}
	return "127.0.0.1:9100"
}

func (c *config) printerAddrForJob(job printJob) (string, error) {
	var p struct {
		PrintStationID string `json:"print_station_id"`
	}
	_ = json.Unmarshal(job.Payload, &p)

	if job.Type == "station_ticket" && strings.TrimSpace(p.PrintStationID) != "" {
		sid := strings.TrimSpace(p.PrintStationID)
		if c.StationPrinters != nil {
			if hp := normalizeHostPort(c.StationPrinters[sid], "9100"); hp != "" {
				return hp, nil
			}
		}
		return "", fmt.Errorf("no station_printers mapping for print_station_id %s", sid)
	}

	return c.defaultPrinterAddr(), nil
}
