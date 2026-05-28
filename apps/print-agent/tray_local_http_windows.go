//go:build windows

package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"
)

// trayLocalHTTP serves /api/health while the tray agent runs; mounts configure routes while settings are open.
type trayLocalHTTP struct {
	mu     sync.Mutex
	rt     *trayRuntime
	srv    *http.Server
	addr   string
	cmux   *http.ServeMux
	active bool
	done   chan error
}

var trayLocal trayLocalHTTP

func startTrayLocalHTTP(rt *trayRuntime) {
	trayLocal.mu.Lock()
	if trayLocal.srv != nil {
		trayLocal.mu.Unlock()
		return
	}
	trayLocal.rt = rt
	trayLocal.mu.Unlock()

	addr, err := pickLocalListenAddr(ConfigureWizardPort)
	if err != nil {
		log.Println("tray: local http:", err)
		return
	}
	srv := &http.Server{
		Addr:              addr,
		Handler:           http.HandlerFunc(trayLocal.serveHTTP),
		ReadHeaderTimeout: 10 * time.Second,
	}
	trayLocal.mu.Lock()
	trayLocal.addr = addr
	trayLocal.srv = srv
	trayLocal.mu.Unlock()

	go func() {
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Println("tray: local http:", err)
		}
	}()
	log.Println("tray: local http on", addr)
}

func shutdownTrayLocalHTTP() {
	trayLocal.mu.Lock()
	srv := trayLocal.srv
	trayLocal.srv = nil
	trayLocal.cmux = nil
	trayLocal.active = false
	trayLocal.mu.Unlock()
	if srv == nil {
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	_ = srv.Shutdown(ctx)
}

func setTrayLocalCORS(w http.ResponseWriter, r *http.Request) {
	origin := strings.TrimSpace(r.Header.Get("Origin"))
	if origin == "" {
		return
	}
	w.Header().Set("Access-Control-Allow-Origin", origin)
	w.Header().Set("Vary", "Origin")
	w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
	if strings.EqualFold(r.Header.Get("Access-Control-Request-Private-Network"), "true") {
		w.Header().Set("Access-Control-Allow-Private-Network", "true")
	}
}

func (t *trayLocalHTTP) serveHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodOptions {
		setTrayLocalCORS(w, r)
		w.WriteHeader(http.StatusNoContent)
		return
	}

	if r.Method == http.MethodGet && r.URL.Path == "/api/health" {
		setTrayLocalCORS(w, r)
		writePairJSON(w, http.StatusOK, map[string]any{
			"ok":      true,
			"version": Version,
		})
		return
	}

	t.mu.Lock()
	cmux := t.cmux
	active := t.active
	rt := t.rt
	addr := t.addr
	t.mu.Unlock()

	if active && cmux != nil {
		cmux.ServeHTTP(w, r)
		return
	}

	if r.URL.Path == "/configure" || strings.HasPrefix(r.URL.Path, "/api/") {
		if rt != nil {
			rt.startTrayConfigureWizard(r.URL.RawQuery)
		}
		setTrayLocalCORS(w, r)
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		refreshTarget := htmlEscape("http://" + addr + r.URL.RequestURI())
		_, _ = fmt.Fprintf(w, `<!DOCTYPE html><html><head><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=%s"></head><body><p>正在打开打印设置…</p><p><a href="%s">若未跳转请点这里</a></p></body></html>`, refreshTarget, refreshTarget)
		return
	}

	http.NotFound(w, r)
}

func htmlEscape(s string) string {
	return strings.NewReplacer("&", "&amp;", `"`, "&quot;", "<", "&lt;", ">", "&gt;").Replace(s)
}

func (t *trayLocalHTTP) runConfigureSession(ctx context.Context, configPath, prefillAPI, rawQuery string) error {
	t.mu.Lock()
	if t.srv == nil {
		t.mu.Unlock()
		return runConfigureWizard(ctx, configPath, prefillAPI, rawQuery)
	}
	if t.active {
		url := configureWizardBaseURL(t.addr, prefillAPI, rawQuery)
		if rawQuery != "" {
			if q, err := urlParseQueryMerge(rawQuery); err == nil && q.Get("api") != "" {
				url = "http://" + t.addr + "/configure?" + q.Encode()
			}
		}
		t.mu.Unlock()
		announceWizardURL("", url)
		return nil
	}
	t.mu.Unlock()

	if api := apiBaseFromRawQuery(rawQuery); api != "" {
		prefillAPI = api
	}

	cfg := reloadConfig(configPath, &config{})
	cfgPtr := &cfg
	done := make(chan error, 1)
	cmux := http.NewServeMux()
	registerConfigureWizardRoutes(cmux, configPath, cfgPtr, done)

	t.mu.Lock()
	t.cmux = cmux
	t.active = true
	t.done = done
	addr := t.addr
	t.mu.Unlock()

	defer func() {
		t.mu.Lock()
		t.cmux = nil
		t.active = false
		t.done = nil
		t.mu.Unlock()
	}()

	baseURL := configureWizardBaseURL(addr, prefillAPI, rawQuery)
	if rawQuery != "" {
		if u, err := url.Parse(baseURL); err == nil {
			q, _ := url.ParseQuery(rawQuery)
			if api := strings.TrimSpace(q.Get("api")); api != "" {
				u.RawQuery = rawQuery
				baseURL = u.String()
			}
		}
	}
	agentLogLocale(localeFromConfigPath(configPath), "log_wizard_open", baseURL)
	if onConfigureWizardReady != nil {
		onConfigureWizardReady(baseURL)
	}
	announceWizardURL("Mesa 打印机设置", baseURL)

	select {
	case <-ctx.Done():
		return ctx.Err()
	case err := <-done:
		return err
	}
}

func apiBaseFromRawQuery(rawQuery string) string {
	if rawQuery == "" {
		return ""
	}
	q, err := url.ParseQuery(rawQuery)
	if err != nil {
		return ""
	}
	api, err := normalizeAPIBase(q.Get("api"))
	if err != nil {
		return ""
	}
	return api
}

func urlParseQueryMerge(rawQuery string) (url.Values, error) {
	return url.ParseQuery(rawQuery)
}
