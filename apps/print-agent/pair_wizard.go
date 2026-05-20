package main

import (
	"context"
	_ "embed"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// PairWizardPort is the localhost HTTP port for the pairing web UI (dashboard links must match).
const PairWizardPort = 17890

//go:embed pair_ui.html
var pairUIHTML []byte

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

func pickPairListenAddr() (string, error) {
	for port := PairWizardPort; port < PairWizardPort+8; port++ {
		addr := fmt.Sprintf("127.0.0.1:%d", port)
		ln, err := net.Listen("tcp", addr)
		if err != nil {
			continue
		}
		_ = ln.Close()
		return addr, nil
	}
	return "", fmt.Errorf("no free port near %d", PairWizardPort)
}

// runPairingWizard serves a local web UI until pairing succeeds or ctx is cancelled.
// prefillAPI is optional (e.g. from -api flag); query ?api= and ?code= override in the browser.
func runPairingWizard(ctx context.Context, configPath, prefillAPI string) error {
	listenAddr, err := pickPairListenAddr()
	if err != nil {
		return err
	}

	done := make(chan error, 1)
	mux := http.NewServeMux()

	mux.HandleFunc("/pair", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		_, _ = w.Write(pairUIHTML)
	})

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
		for _, c := range code {
			if c < '0' || c > '9' {
				writePairJSON(w, http.StatusBadRequest, map[string]string{"error": "配对码须为 6 位数字"})
				return
			}
		}

		deviceID := newUUID()
		cfg, err := claim(apiBase, code, deviceID)
		if err != nil {
			msg := err.Error()
			if strings.Contains(msg, "401") || strings.Contains(msg, "invalid") {
				msg = "配对码无效或已过期，请在 Mesa 后台重新生成"
			}
			writePairJSON(w, http.StatusBadRequest, map[string]string{"error": msg})
			return
		}
		if err := saveConfig(configPath, cfg); err != nil {
			writePairJSON(w, http.StatusInternalServerError, map[string]string{"error": "保存配置失败: " + err.Error()})
			return
		}
		log.Printf("pairing wizard: saved config to %s (device_id=%s)", configPath, deviceID)
		writePairJSON(w, http.StatusOK, map[string]string{"status": "ok"})
		done <- nil
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

	log.Printf("pairing wizard: open %s in your browser", baseURL)
	if err := openBrowser(baseURL); err != nil {
		log.Printf("pairing wizard: could not open browser automatically: %v", err)
		log.Printf("pairing wizard: open this URL manually: %s", baseURL)
	}

	select {
	case <-ctx.Done():
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		defer cancel()
		_ = srv.Shutdown(shutdownCtx)
		return ctx.Err()
	case err := <-done:
		shutdownCtx, cancel := context.WithTimeout(context.Background, 3*time.Second)
		defer cancel()
		_ = srv.Shutdown(shutdownCtx)
		return err
	}
}

func writePairJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}
