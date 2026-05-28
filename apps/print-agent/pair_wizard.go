package main

import (
	"context"
	_ "embed"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// PairWizardPort is the localhost HTTP port for the pairing web UI (dashboard links must match).
const PairWizardPort = 17890

// SetupWizardPort is the localhost port for printer setup UI (dashboard need not link).
const SetupWizardPort = 17891

// ConfigureWizardPort is the printer mapping UI (/configure).
const ConfigureWizardPort = 17892

//go:embed pair_ui.html
var pairUIHTML []byte

// registerPairWebRoutes serves /pair and POST /api/pair on the given mux (configure tray session or pair wizard).
func registerPairWebRoutes(mux *http.ServeMux, configPath string, cfg **config, logPrefix string, onSuccess func()) {
	mux.HandleFunc("/pair", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		_, _ = w.Write(pairUIHTML)
	})
	registerPairWizardRoute(mux, configPath, cfg, logPrefix, onSuccess)
}

func normalizeAPIBase(raw string) (string, error) {
	s := strings.TrimSpace(raw)
	if s == "" {
		return "", fmt.Errorf("Mesa 网址不能为空")
	}
	if idx := strings.Index(s, "/dashboard"); idx > 0 {
		s = strings.TrimRight(s[:idx], "/")
	}
	if idx := strings.Index(s, "/auth"); idx > 0 {
		s = strings.TrimRight(s[:idx], "/")
	}
	s = strings.TrimRight(s, "/")
	if !strings.HasPrefix(s, "http://") && !strings.HasPrefix(s, "https://") {
		return "", fmt.Errorf("网址须以 http:// 或 https:// 开头")
	}
	return s, nil
}

func pickLocalListenAddr(startPort int) (string, error) {
	for port := startPort; port < startPort+8; port++ {
		addr := fmt.Sprintf("127.0.0.1:%d", port)
		ln, err := net.Listen("tcp", addr)
		if err != nil {
			continue
		}
		_ = ln.Close()
		return addr, nil
	}
	return "", fmt.Errorf("no free port near %d", startPort)
}

// runPairingWizard serves a local web UI until pairing succeeds or ctx is cancelled.
// prefillAPI is optional (e.g. from -api flag); query ?api= and ?code= override in the browser.
func runPairingWizard(ctx context.Context, configPath, prefillAPI string) error {
	listenAddr, err := pickLocalListenAddr(PairWizardPort)
	if err != nil {
		return err
	}

	done := make(chan error, 1)
	mux := http.NewServeMux()
	var cfg *config
	cfgPtr := &cfg
	registerPairWebRoutes(mux, configPath, cfgPtr, "pairing wizard", func() { done <- nil })
	registerUILocaleRoute(mux, configPath, cfgPtr)
	mux.HandleFunc("/api/setup-state", func(w http.ResponseWriter, r *http.Request) {
		*cfgPtr = reloadConfig(configPath, *cfgPtr)
		writeConfigureState(w, *cfgPtr)
	})

	srv := &http.Server{Addr: listenAddr, Handler: mux, ReadHeaderTimeout: 10 * time.Second}
	go func() {
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			done <- err
		}
	}()

	baseURL := "http://" + listenAddr + "/pair"
	if api, err := normalizeAPIBase(prefillAPI); err == nil && api != "" {
		baseURL = "http://" + listenAddr + "/pair?api=" + url.QueryEscape(api)
	}

	agentLogLocale(localeFromConfigPath(configPath), "log_wizard_open", baseURL)
	announceWizardURL("Mesa 配对", baseURL)

	return waitLocalWizard(ctx, srv, done)
}

func writePairJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}
