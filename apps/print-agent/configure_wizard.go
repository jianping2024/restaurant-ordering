package main

import (
	"context"
	_ "embed"
	"net/http"
	"net/url"
	"time"
)

//go:embed configure_ui.html
var configureUIHTML []byte

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

	registerPairWizardRoute(mux, configPath, cfgPtr, "configure wizard", nil)
	registerPrinterWizardRoutes(mux, configPath, cfgPtr, "configure wizard")
	registerUILocaleRoute(mux, configPath, cfgPtr)

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
	agentLogLocale(localeFromConfigPath(configPath), "log_wizard_open", baseURL)
	if onConfigureWizardReady != nil {
		onConfigureWizardReady(baseURL)
	}
	announceWizardURL("Mesa 打印机设置", baseURL)

	return waitLocalWizard(ctx, srv, done)
}
