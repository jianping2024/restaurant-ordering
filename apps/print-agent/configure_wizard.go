package main

import (
	"context"
	_ "embed"
	"encoding/json"
	"io"
	"log"
	"net/http"
	"net/url"
	"strings"
	"time"
)

//go:embed configure_ui.html
var configureUIHTML []byte

func reloadConfig(configPath string, fallback *config) *config {
	if c, err := loadConfig(configPath); err == nil {
		return c
	}
	if fallback != nil {
		return fallback
	}
	return &config{}
}

func writeConfigureState(w http.ResponseWriter, cfg *config) {
	stationCount := 0
	if cfg.StationPrinters != nil {
		stationCount = len(cfg.StationPrinters)
	}
	writePairJSON(w, http.StatusOK, map[string]any{
		"paired":           strings.TrimSpace(cfg.AgentJWT) != "",
		"api_base":         cfg.APIBase,
		"device_id":        cfg.DeviceID,
		"default_printer":  cfg.defaultPrinterTargetRaw(),
		"station_printers": cfg.StationPrinters,
		"station_count":    stationCount,
	})
}

func registerPrinterWizardRoutes(mux *http.ServeMux, configPath string, cfg **config, onSetupSaved func()) {
	mux.HandleFunc("/api/printers", func(w http.ResponseWriter, r *http.Request) {
		tcp, win, err := discoverAllPrinters(600*time.Millisecond, 32)
		if err != nil && len(tcp) == 0 && len(win) == 0 {
			writePairJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		writePairJSON(w, http.StatusOK, map[string]any{"tcp": tcp, "winspool": win})
	})

	mux.HandleFunc("/api/print-stations", func(w http.ResponseWriter, r *http.Request) {
		c := *cfg
		if strings.TrimSpace(c.AgentJWT) == "" {
			writePairJSON(w, http.StatusUnauthorized, map[string]string{"error": "请先完成配对"})
			return
		}
		stations, err := fetchPrintStations(c.APIBase, c.AgentJWT)
		if err != nil {
			writePairJSON(w, http.StatusBadGateway, map[string]string{"error": err.Error()})
			return
		}
		writePairJSON(w, http.StatusOK, map[string]any{"stations": stations})
	})

	mux.HandleFunc("/api/setup-state", func(w http.ResponseWriter, r *http.Request) {
		writeConfigureState(w, *cfg)
	})

	mux.HandleFunc("/api/setup", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		c := *cfg
		if strings.TrimSpace(c.AgentJWT) == "" {
			writePairJSON(w, http.StatusUnauthorized, map[string]string{"error": "请先完成配对"})
			return
		}
		var body struct {
			DefaultPrinter  string            `json:"default_printer"`
			StationPrinters map[string]string `json:"station_printers"`
		}
		if err := json.NewDecoder(io.LimitReader(r.Body, 65536)).Decode(&body); err != nil {
			writePairJSON(w, http.StatusBadRequest, map[string]string{"error": "无效的请求"})
			return
		}
		target, err := parsePrinterTarget(body.DefaultPrinter)
		if err != nil {
			writePairJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}
		c.DefaultPrinter = target.Display
		if target.Scheme == schemeTCP {
			c.PrinterHost = target.TCPHostPort
		} else {
			c.PrinterHost = ""
		}
		cleaned := map[string]string{}
		for sid, raw := range body.StationPrinters {
			sid = strings.TrimSpace(sid)
			raw = strings.TrimSpace(raw)
			if sid == "" || raw == "" {
				continue
			}
			st, err := parsePrinterTarget(raw)
			if err != nil {
				writePairJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
				return
			}
			cleaned[sid] = st.Display
		}
		if len(cleaned) > 0 {
			c.StationPrinters = cleaned
		} else {
			c.StationPrinters = nil
		}
		if err := saveConfig(configPath, c); err != nil {
			writePairJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		*cfg = c
		log.Printf("configure wizard: default_printer=%s station_printers=%d", c.DefaultPrinter, len(cleaned))
		writePairJSON(w, http.StatusOK, map[string]string{"status": "ok"})
		if onSetupSaved != nil {
			onSetupSaved()
		}
	})
}

func registerPairWizardRoute(mux *http.ServeMux, configPath string, cfg **config, onPaired func()) {
	mux.HandleFunc("/api/pair", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		var body struct {
			APIBase string `json:"api_base"`
			Code    string `json:"code"`
		}
		if err := json.NewDecoder(io.LimitReader(r.Body, 4096)).Decode(&body); err != nil {
			writePairJSON(w, http.StatusBadRequest, map[string]string{"error": "无效的请求"})
			return
		}
		apiBase, err := normalizeAPIBase(body.APIBase)
		if err != nil {
			writePairJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}
		code := strings.TrimSpace(body.Code)
		if len(code) != 6 {
			writePairJSON(w, http.StatusBadRequest, map[string]string{"error": "配对码须为 6 位数字"})
			return
		}
		for _, ch := range code {
			if ch < '0' || ch > '9' {
				writePairJSON(w, http.StatusBadRequest, map[string]string{"error": "配对码须为 6 位数字"})
				return
			}
		}

		deviceID := newUUID()
		next, err := claim(apiBase, code, deviceID)
		if err != nil {
			msg := err.Error()
			if strings.Contains(msg, "401") || strings.Contains(msg, "invalid") {
				msg = "配对码无效或已过期，请在 Mesa 后台重新生成"
			}
			writePairJSON(w, http.StatusBadRequest, map[string]string{"error": msg})
			return
		}
		if err := savePairConfig(configPath, next); err != nil {
			writePairJSON(w, http.StatusInternalServerError, map[string]string{"error": "保存配置失败: " + err.Error()})
			return
		}
		*cfg = reloadConfig(configPath, next)
		log.Printf("configure wizard: re-paired (device_id=%s)", deviceID)
		writePairJSON(w, http.StatusOK, map[string]string{"status": "ok"})
		if onPaired != nil {
			onPaired()
		}
	})
}

// runConfigureWizard serves re-pair + printer setup until the user closes the page.
func runConfigureWizard(ctx context.Context, configPath string, prefillAPI string) error {
	listenAddr, err := pickLocalListenAddr(ConfigureWizardPort)
	if err != nil {
		return err
	}

	cfg := reloadConfig(configPath, &config{})
	cfgPtr := &cfg

	done := make(chan error, 1)
	mux := http.NewServeMux()

	mux.HandleFunc("/configure", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		_, _ = w.Write(configureUIHTML)
	})

	registerPairWizardRoute(mux, configPath, cfgPtr, nil)
	registerPrinterWizardRoutes(mux, configPath, cfgPtr, nil)

	mux.HandleFunc("/api/configure-state", func(w http.ResponseWriter, r *http.Request) {
		*cfgPtr = reloadConfig(configPath, *cfgPtr)
		writeConfigureState(w, *cfgPtr)
	})

	mux.HandleFunc("/api/configure-done", func(w http.ResponseWriter, r *http.Request) {
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

	baseURL := "http://" + listenAddr + "/configure"
	if api, err := normalizeAPIBase(prefillAPI); err == nil && api != "" {
		baseURL = "http://" + listenAddr + "/configure?api=" + url.QueryEscape(api)
	}
	log.Printf("configure wizard: open %s", baseURL)
	if err := openBrowser(baseURL); err != nil {
		log.Printf("configure wizard: open browser: %v — manual URL: %s", err, baseURL)
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
