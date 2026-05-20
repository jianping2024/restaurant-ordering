package main

import (
	"context"
	_ "embed"
	"encoding/json"
	"io"
	"log"
	"net/http"
	"sort"
	"strings"
	"time"
)

//go:embed setup_ui.html
var setupUIHTML []byte

type printerListEntry struct {
	Addr  string `json:"addr"`
	Label string `json:"label"`
}

func discoverAllPrinters(timeout time.Duration, workers int) (tcp []printerListEntry, winspool []printerListEntry, err error) {
	if workers <= 0 {
		workers = 32
	}
	if timeout <= 0 {
		timeout = 600 * time.Millisecond
	}
	found, err := discoverPrinters9100(timeout, workers)
	if err != nil {
		return nil, nil, err
	}
	for _, p := range found {
		tcp = append(tcp, printerListEntry{
			Addr:  schemeTCP + ":" + p.Addr,
			Label: p.Addr + " (LAN)",
		})
	}
	names, _ := listWinspoolPrinterNames()
	sort.Strings(names)
	for _, name := range names {
		name = strings.TrimSpace(name)
		if name == "" {
			continue
		}
		winspool = append(winspool, printerListEntry{
			Addr:  schemeWinspool + ":" + name,
			Label: name + " (USB / Windows)",
		})
	}
	return tcp, winspool, nil
}

// runSetupWizard serves printer selection UI until saved or ctx cancelled.
func runSetupWizard(ctx context.Context, configPath string, cfg *config) error {
	listenAddr, err := pickLocalListenAddr(SetupWizardPort)
	if err != nil {
		return err
	}

	done := make(chan error, 1)
	mux := http.NewServeMux()

	mux.HandleFunc("/setup", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		_, _ = w.Write(setupUIHTML)
	})

	mux.HandleFunc("/api/printers", func(w http.ResponseWriter, r *http.Request) {
		tcp, win, err := discoverAllPrinters(600*time.Millisecond, 32)
		if err != nil && len(tcp) == 0 && len(win) == 0 {
			writePairJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		writePairJSON(w, http.StatusOK, map[string]any{"tcp": tcp, "winspool": win})
	})

	mux.HandleFunc("/api/setup", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		var body struct {
			DefaultPrinter string `json:"default_printer"`
		}
		if err := json.NewDecoder(io.LimitReader(r.Body, 4096)).Decode(&body); err != nil {
			writePairJSON(w, http.StatusBadRequest, map[string]string{"error": "无效的请求"})
			return
		}
		target, err := parsePrinterTarget(body.DefaultPrinter)
		if err != nil {
			writePairJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}
		cfg.DefaultPrinter = target.Display
		if target.Scheme == schemeTCP {
			cfg.PrinterHost = target.TCPHostPort
		} else {
			cfg.PrinterHost = ""
		}
		if err := saveConfig(configPath, cfg); err != nil {
			writePairJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		log.Printf("setup wizard: default_printer=%s", cfg.DefaultPrinter)
		writePairJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})

	mux.HandleFunc("/api/setup-done", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		writePairJSON(w, http.StatusOK, map[string]string{"status": "ok"})
		done <- nil
	})

	srv := &http.Server{Addr: listenAddr, Handler: mux, ReadHeaderTimeout: 10 * time.Second}
	go func() {
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			done <- err
		}
	}()

	baseURL := "http://" + listenAddr + "/setup"
	log.Printf("setup wizard: open %s", baseURL)
	if err := openBrowser(baseURL); err != nil {
		log.Printf("setup wizard: open browser: %v — manual URL: %s", err, baseURL)
	}

	select {
	case <-ctx.Done():
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		defer cancel()
		_ = srv.Shutdown(shutdownCtx)
		return ctx.Err()
	case err := <-done:
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		defer cancel()
		_ = srv.Shutdown(shutdownCtx)
		return err
	}
}
