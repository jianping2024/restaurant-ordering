package main

import (
	"context"
	"flag"
	"log"
	"strings"
	"time"
)

type agentSession struct {
	cfgPath string
	cfg     *config
	pc      *pollController
}

func initAgentSession(args []string) (*agentSession, bool, error) {
	fs := flag.NewFlagSet("run", flag.ExitOnError)
	apiBase := fs.String("api", "http://127.0.0.1:3000", "Mesa base URL")
	code := fs.String("code", "", "6-digit pairing code (first run)")
	defaultPrinter := fs.String("default-printer", "", "Default host:port for receipts / pre-bill (also sets legacy printer_host)")
	cfgPath := fs.String("config", "", "Config file path")
	showConsole := fs.Bool("console", false, "Keep console window visible (Windows debug)")
	_ = fs.Parse(args)

	path := *cfgPath
	if path == "" {
		path = defaultConfigPath()
	}

	cfg, err := loadConfig(path)
	if err != nil || cfg.AgentJWT == "" {
		if *code != "" {
			deviceID := newUUID()
			cfg, err = claim(*apiBase, strings.TrimSpace(*code), deviceID)
			if err != nil {
				return nil, *showConsole, err
			}
			if dp := strings.TrimSpace(*defaultPrinter); dp != "" {
				cfg.DefaultPrinter = dp
				cfg.PrinterHost = dp
			}
			if err := saveConfig(path, cfg); err != nil {
				return nil, *showConsole, err
			}
			log.Printf("saved config to %s (device_id=%s)", path, deviceID)
		} else {
			prefill := strings.TrimSpace(*apiBase)
			if prefill == "http://127.0.0.1:3000" {
				prefill = ""
			}
			// Tray may already be visible (runAgentTrayFirst); hint user to use browser wizard.
			log.Println("pairing required — complete the browser wizard (tray icon should be visible)")
			ctx, cancel := context.WithTimeout(context.Background(), 20*time.Minute)
			defer cancel()
			if err := runPairingWizard(ctx, path, prefill); err != nil {
				return nil, *showConsole, err
			}
			cfg, err = loadConfig(path)
			if err != nil {
				return nil, *showConsole, err
			}
			if cfg.AgentJWT == "" {
				return nil, *showConsole, errPairingIncomplete
			}
		}
	}
	if cfg.APIBase == "" {
		cfg.APIBase = *apiBase
	}
	if dp := strings.TrimSpace(*defaultPrinter); dp != "" {
		cfg.DefaultPrinter = dp
		cfg.PrinterHost = dp
		_ = saveConfig(path, cfg)
	}

	applyCloudRuntimeConfig(cfg, cfg.APIBase)

	if !cfg.hasPrinterRouting() {
		log.Println("no printer configured — opening setup wizard")
		setupCtx, setupCancel := context.WithTimeout(context.Background(), 30*time.Minute)
		if err := runSetupWizard(setupCtx, path, cfg); err != nil {
			setupCancel()
			return nil, *showConsole, err
		}
		setupCancel()
		cfg, err = loadConfig(path)
		if err != nil {
			return nil, *showConsole, err
		}
	}
	if !cfg.hasPrinterRouting() {
		log.Println("no station printer mappings — map stations in configure")
	}

	syncRoutingToCloud(cfg)

	stationCount := 0
	if cfg.StationPrinters != nil {
		stationCount = len(cfg.StationPrinters)
	}
	pc, err := newPollController(cfg.Schedule, cfg.Poll)
	if err != nil {
		return nil, *showConsole, err
	}
	log.Printf("Mesa Print Agent %s", Version)
	logAgentStartup(cfg, cfg.APIBase, stationCount)

	return &agentSession{cfgPath: path, cfg: cfg, pc: pc}, *showConsole, nil
}

var errPairingIncomplete = errString("pairing did not save configuration")

type errString string

func (e errString) Error() string { return string(e) }
