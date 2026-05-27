package main

import (
	"encoding/json"
	"io"
	"log"
	"net/http"
	"sort"
	"strings"
	"time"
)

type printerListEntry struct {
	Addr  string `json:"addr"`
	Label string `json:"label"`
}

type setupRequestBody struct {
	StationPrinters map[string]string `json:"station_printers"`
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
		"station_printers": cfg.StationPrinters,
		"station_count":    stationCount,
	})
}

func applyPrinterSetup(cfg *config, body setupRequestBody) (map[string]string, error) {
	cfg.DefaultPrinter = ""
	cfg.PrinterHost = ""
	cfg.CashierPrinter = ""
	cleaned := map[string]string{}
	for sid, raw := range body.StationPrinters {
		sid = strings.TrimSpace(sid)
		raw = strings.TrimSpace(raw)
		if sid == "" || raw == "" {
			continue
		}
		st, err := parsePrinterTarget(raw)
		if err != nil {
			return nil, err
		}
		cleaned[sid] = st.Display
	}
	if len(cleaned) > 0 {
		cfg.StationPrinters = cleaned
	} else {
		cfg.StationPrinters = nil
	}
	return cleaned, nil
}

func registerPrinterWizardRoutes(mux *http.ServeMux, configPath string, cfg **config, logPrefix string) {
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
		var body setupRequestBody
		if err := json.NewDecoder(io.LimitReader(r.Body, 65536)).Decode(&body); err != nil {
			writePairJSON(w, http.StatusBadRequest, map[string]string{"error": "无效的请求"})
			return
		}
		cleaned, err := applyPrinterSetup(c, body)
		if err != nil {
			writePairJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}
		if err := saveConfig(configPath, c); err != nil {
			writePairJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		*cfg = c
		syncRoutingToCloud(c)
		log.Printf("%s: station_printers=%d", logPrefix, len(cleaned))
		writePairJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})

	mux.HandleFunc("/api/test-print", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		c := reloadConfig(configPath, *cfg)
		if strings.TrimSpace(c.AgentJWT) == "" {
			writePairJSON(w, http.StatusUnauthorized, map[string]string{"error": "请先完成配对"})
			return
		}
		var body testPrintRequest
		if err := json.NewDecoder(io.LimitReader(r.Body, 4096)).Decode(&body); err != nil {
			writePairJSON(w, http.StatusBadRequest, map[string]string{"error": "无效的请求"})
			return
		}
		if err := runTestPrintForStation(c, body.StationID, body.Printer); err != nil {
			writePairJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}
		log.Printf("%s: test print station=%s", logPrefix, strings.TrimSpace(body.StationID))
		writePairJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})
}

func registerPairWizardRoute(mux *http.ServeMux, configPath string, cfg **config, logPrefix string, onSuccess func()) {
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
		if cfg != nil {
			*cfg = reloadConfig(configPath, next)
		}
		log.Printf("%s: saved config (device_id=%s)", logPrefix, deviceID)
		writePairJSON(w, http.StatusOK, map[string]string{"status": "ok"})
		if onSuccess != nil {
			onSuccess()
		}
	})
}
