// Mesa print agent: LAN 9100 discover, pairing, poll print_jobs, route per print_station.
package main

import (
	"bytes"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"os"
	"strings"
	"time"

	_ "time/tzdata" // IANA zones (e.g. Europe/Lisbon) in Alpine/minimal images
)

func newUUID() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	b[6] = (b[6] & 0x0f) | 0x40
	b[8] = (b[8] & 0x3f) | 0x80
	h := hex.EncodeToString(b)
	return h[0:8] + "-" + h[8:12] + "-" + h[12:16] + "-" + h[16:20] + "-" + h[20:32]
}

func claim(apiBase, code, deviceID string) (*config, error) {
	body, _ := json.Marshal(map[string]string{"code": code, "device_id": deviceID})
	req, err := http.NewRequest(http.MethodPost, strings.TrimRight(apiBase, "/")+"/api/print-agent/claim", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	raw, _ := io.ReadAll(res.Body)
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return nil, fmt.Errorf("claim %s: %s", res.Status, string(raw))
	}
	var out struct {
		AgentJWT string `json:"agentjwt"`
	}
	if err := json.Unmarshal(raw, &out); err != nil {
		return nil, err
	}
	if out.AgentJWT == "" {
		return nil, fmt.Errorf("claim: missing agentjwt")
	}
	return &config{APIBase: apiBase, AgentJWT: out.AgentJWT, DeviceID: deviceID}, nil
}

type printJob struct {
	ID      string          `json:"id"`
	Type    string          `json:"type"`
	Status  string          `json:"status"`
	Payload json.RawMessage `json:"payload"`
}

func fetchPending(apiBase, jwt string) ([]printJob, error) {
	req, err := http.NewRequest(http.MethodGet, strings.TrimRight(apiBase, "/")+"/api/print-agent/pending-jobs", nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+jwt)
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	raw, _ := io.ReadAll(res.Body)
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return nil, fmt.Errorf("pending-jobs %s: %s", res.Status, string(raw))
	}
	var out struct {
		Jobs []printJob `json:"jobs"`
	}
	if err := json.Unmarshal(raw, &out); err != nil {
		return nil, err
	}
	return out.Jobs, nil
}

func patchJob(apiBase, jwt, id string, patch map[string]any) error {
	body, _ := json.Marshal(patch)
	req, err := http.NewRequest(http.MethodPatch, strings.TrimRight(apiBase, "/")+"/api/print-agent/jobs/"+id, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+jwt)
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	raw, _ := io.ReadAll(res.Body)
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return fmt.Errorf("patch job %s: %s", res.Status, string(raw))
	}
	return nil
}

func summarizeJobPayload(job printJob) string {
	p := parseJobPayload(job)
	if p.ConnectionTest {
		return "connection test"
	}
	station := p.stationName()
	var parts []string
	if station != "" {
		parts = append(parts, "station="+station)
	}
	if p.TableNumber > 0 {
		parts = append(parts, fmt.Sprintf("table=%d", p.TableNumber))
	}
	for _, ln := range p.Lines {
		q := ln.Qty
		if q <= 0 {
			q = 1
		}
		parts = append(parts, fmt.Sprintf("%dx %s", q, ln.DisplayName))
	}
	if len(parts) == 0 {
		return job.Type
	}
	return strings.Join(parts, " | ")
}

func tcpPrint(hostPort string, data []byte) error {
	c, err := net.DialTimeout("tcp", hostPort, 8*time.Second)
	if err != nil {
		return err
	}
	defer c.Close()
	_ = c.SetWriteDeadline(time.Now().Add(12 * time.Second))
	_, err = c.Write(data)
	return err
}

func runAgent(args []string) {
	fs := flag.NewFlagSet("run", flag.ExitOnError)
	apiBase := fs.String("api", "http://127.0.0.1:3000", "Mesa base URL")
	code := fs.String("code", "", "6-digit pairing code (first run)")
	defaultPrinter := fs.String("default-printer", "", "Default host:port for receipts / pre-bill (also sets legacy printer_host)")
	cfgPath := fs.String("config", "", "Config file path")
	_ = fs.Parse(args)

	path := *cfgPath
	if path == "" {
		path = defaultConfigPath()
	}

	cfg, err := loadConfig(path)
	if err != nil || cfg.AgentJWT == "" {
		if *code == "" {
			log.Fatal("first run: pass -code with a fresh 6-digit pairing code from the dashboard")
		}
		deviceID := newUUID()
		cfg, err = claim(*apiBase, strings.TrimSpace(*code), deviceID)
		if err != nil {
			log.Fatal(err)
		}
		if dp := strings.TrimSpace(*defaultPrinter); dp != "" {
			cfg.DefaultPrinter = dp
			cfg.PrinterHost = dp
		}
		if err := saveConfig(path, cfg); err != nil {
			log.Fatal(err)
		}
		log.Printf("saved config to %s (device_id=%s)", path, deviceID)
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

	def := cfg.defaultPrinterAddr()
	stationCount := 0
	if cfg.StationPrinters != nil {
		stationCount = len(cfg.StationPrinters)
	}
	pc, err := newPollController(cfg.Schedule, cfg.Poll)
	if err != nil {
		log.Fatal("schedule:", err)
	}
	logAgentStartup(cfg, cfg.APIBase, def, stationCount)

	var lastLogged pollPhase
	var queue []printJob

	for {
		open, err := pc.scheduleOpen()
		if err != nil {
			log.Println("schedule:", err)
			time.Sleep(pc.sleepFor(pollPhaseError))
			continue
		}
		if !open {
			queue = nil
			if lastLogged != pollPhaseClosed {
				if wait, werr := pc.closedSleep(); werr == nil {
					log.Printf("outside schedule — sleeping %s (no API polls)", wait.Round(time.Second))
				} else {
					log.Println("outside schedule — no API polls")
				}
				lastLogged = pollPhaseClosed
			}
			time.Sleep(pc.sleepFor(pollPhaseClosed))
			continue
		}
		if lastLogged == pollPhaseClosed {
			log.Println("schedule open — resuming polls")
			lastLogged = ""
		}

		if len(queue) == 0 {
			jobs, err := fetchPending(cfg.APIBase, cfg.AgentJWT)
			phase := pc.phase(len(jobs) > 0, err != nil)
			if err != nil {
				if lastLogged != pollPhaseError {
					log.Println("pending-jobs:", err)
					lastLogged = pollPhaseError
				}
				time.Sleep(pc.sleepFor(pollPhaseError))
				continue
			}
			if len(jobs) == 0 {
				if lastLogged != phase && phase != pollPhaseIdle {
					log.Printf("poll %s — next check in %s", phase, pc.sleepFor(phase).Round(time.Second))
					lastLogged = phase
				} else if lastLogged != phase {
					lastLogged = phase
				}
				time.Sleep(pc.sleepFor(phase))
				continue
			}
			queue = jobs
			lastLogged = pollPhaseBusy
			pc.markActivity()
		}

		job := queue[0]
		hostPort, err := cfg.printerAddrForJob(job)
		if err != nil {
			_ = patchJob(cfg.APIBase, cfg.AgentJWT, job.ID, map[string]any{
				"status":        "failed",
				"error_message": err.Error(),
			})
			log.Println("route:", err)
			queue = queue[1:]
			pc.markActivity()
			continue
		}
		if err := patchJob(cfg.APIBase, cfg.AgentJWT, job.ID, map[string]any{"status": "processing"}); err != nil {
			log.Println("claim job:", err)
			time.Sleep(pc.sleepFor(pollPhaseBusy))
			continue
		}
		data := escposFromJob(job)
		if err := tcpPrint(hostPort, data); err != nil {
			_ = patchJob(cfg.APIBase, cfg.AgentJWT, job.ID, map[string]any{
				"status":        "failed",
				"error_message": err.Error(),
			})
			log.Printf("print failed (%s): %v", hostPort, err)
		} else {
			if err := patchJob(cfg.APIBase, cfg.AgentJWT, job.ID, map[string]any{"status": "done"}); err != nil {
				log.Println("mark done:", err)
			} else {
				log.Printf("printed job %s (%s) -> %s\n  ticket: %s", job.ID, job.Type, hostPort, summarizeJobPayload(job))
			}
		}
		queue = queue[1:]
		pc.markActivity()

		if len(queue) == 0 {
			time.Sleep(pc.sleepFor(pollPhaseAfterPrint))
		}
	}
}

func main() {
	if len(os.Args) > 1 {
		switch os.Args[1] {
		case "discover":
			runDiscover(os.Args[2:])
			return
		case "help", "-h", "--help":
			fmt.Println(`Usage:
  mesa-print-agent discover [-json] [-timeout-ms 400] [-workers 64]
  mesa-print-agent [-api URL] [-code CODE] [-default-printer HOST:9100]

Config: schedule (open windows) + poll (idle/busy/warm intervals). See README.

Subcommand "discover" scans local IPv4 subnets for TCP port 9100 (RAW thermal printers).`)
			return
		case "run":
			runAgent(os.Args[2:])
			return
		}
	}
	runAgent(os.Args[1:])
}
