package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

// billSyncDraftStore is the sole durable Agent store for synced bill drafts
// (JSON file; one representation — do not add a parallel in-memory-only path).
type billSyncDraftStore struct {
	mu      sync.Mutex
	path    string
	Drafts  map[string]billSyncDraft `json:"drafts"`
	Catalog map[string]billSyncCatalogItem `json:"catalog"`
}

type billSyncDraft struct {
	RequestID     string          `json:"request_id"`
	SourceSaleID  string          `json:"source_sale_id"`
	Payload       json.RawMessage `json:"payload_json"`
	Status        string          `json:"status"` // open | invoiced | discarded
	UpdatedAt     string          `json:"updated_at"`
}

type billSyncCatalogItem struct {
	ItemCode         string `json:"item_code"`
	Name             string `json:"name"`
	UnitPriceGross   string `json:"unit_price_gross"`
	VatRate          string `json:"vat_rate"`
}

type billSyncJob struct {
	ID               string          `json:"id"`
	RestaurantID     string          `json:"restaurant_id"`
	RequestID        string          `json:"request_id"`
	SourceSaleID     string          `json:"source_sale_id"`
	TableDisplayName string          `json:"table_display_name"`
	ScopeType        string          `json:"scope_type"`
	Payload          json.RawMessage `json:"payload"`
	Status           string          `json:"status"`
	CreatedAt        string          `json:"created_at"`
}

type billSyncPayloadView struct {
	RequestID      string `json:"request_id"`
	SourceSaleID   string `json:"source_sale_id"`
	ScopeType      string `json:"scope_type"`
	Lines          []billSyncLineView `json:"lines"`
	Splits         []struct {
		Lines []billSyncLineView `json:"lines"`
	} `json:"splits"`
}

type billSyncLineView struct {
	ItemCode       string `json:"item_code"`
	Name           string `json:"name"`
	Qty            string `json:"qty"`
	UnitPriceGross string `json:"unit_price_gross"`
	LineGross      string `json:"line_gross"`
	VatRate        string `json:"vat_rate"`
}

var billSyncStoreOnce sync.Once
var billSyncStore *billSyncDraftStore

func billSyncStorePath(cfg *config) string {
	_ = cfg
	return filepath.Join(filepath.Dir(defaultConfigPath()), "bill-sync-drafts.json")
}

func getBillSyncStore(cfg *config) *billSyncDraftStore {
	billSyncStoreOnce.Do(func() {
		billSyncStore = &billSyncDraftStore{
			path:    billSyncStorePath(cfg),
			Drafts:  map[string]billSyncDraft{},
			Catalog: map[string]billSyncCatalogItem{},
		}
		_ = billSyncStore.load()
	})
	return billSyncStore
}

func (s *billSyncDraftStore) load() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	raw, err := os.ReadFile(s.path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}
	var parsed billSyncDraftStore
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return err
	}
	if parsed.Drafts == nil {
		parsed.Drafts = map[string]billSyncDraft{}
	}
	if parsed.Catalog == nil {
		parsed.Catalog = map[string]billSyncCatalogItem{}
	}
	s.Drafts = parsed.Drafts
	s.Catalog = parsed.Catalog
	return nil
}

func (s *billSyncDraftStore) saveLocked() error {
	raw, err := json.MarshalIndent(struct {
		Drafts  map[string]billSyncDraft       `json:"drafts"`
		Catalog map[string]billSyncCatalogItem `json:"catalog"`
	}{Drafts: s.Drafts, Catalog: s.Catalog}, "", "  ")
	if err != nil {
		return err
	}
	tmp := s.path + ".tmp"
	if err := os.WriteFile(tmp, raw, 0o600); err != nil {
		return err
	}
	return os.Rename(tmp, s.path)
}

func (s *billSyncDraftStore) upsertDraftAndCatalog(sourceSaleID string, requestID string, payload json.RawMessage, lines []billSyncLineView) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	existing, ok := s.Drafts[sourceSaleID]
	if ok && existing.Status == "invoiced" {
		return fmt.Errorf("already_invoiced")
	}

	first := map[string]billSyncLineView{}
	for _, line := range lines {
		code := strings.TrimSpace(line.ItemCode)
		if code == "" {
			return fmt.Errorf("empty_item_code")
		}
		if prev, exists := first[code]; exists {
			if prev.Name != line.Name || prev.UnitPriceGross != line.UnitPriceGross || prev.VatRate != line.VatRate {
				return fmt.Errorf("item_code_conflict")
			}
			continue
		}
		first[code] = line
	}

	for code, line := range first {
		if !validBillSyncVatRate(line.VatRate) {
			return fmt.Errorf("invalid_vat_rate")
		}
		cur, exists := s.Catalog[code]
		next := billSyncCatalogItem{
			ItemCode:       code,
			Name:           line.Name,
			UnitPriceGross: line.UnitPriceGross,
			VatRate:        line.VatRate,
		}
		if !exists || cur != next {
			s.Catalog[code] = next
		}
	}

	s.Drafts[sourceSaleID] = billSyncDraft{
		RequestID:    requestID,
		SourceSaleID: sourceSaleID,
		Payload:      append(json.RawMessage(nil), payload...),
		Status:       "open",
		UpdatedAt:    time.Now().UTC().Format(time.RFC3339),
	}
	return s.saveLocked()
}

func validBillSyncVatRate(v string) bool {
	if len(v) < 4 {
		return false
	}
	// "13.00" style percent points — reject "0.23"
	var whole, frac int
	n, err := fmt.Sscanf(v, "%d.%d", &whole, &frac)
	if err != nil || n != 2 {
		return false
	}
	if whole < 0 || whole > 100 {
		return false
	}
	if whole == 0 && frac > 0 {
		return false
	}
	parts := strings.Split(v, ".")
	return len(parts) == 2 && len(parts[1]) == 2
}

func collectBillSyncLines(payload json.RawMessage) ([]billSyncLineView, error) {
	var view billSyncPayloadView
	if err := json.Unmarshal(payload, &view); err != nil {
		return nil, err
	}
	if view.ScopeType == "split" {
		var lines []billSyncLineView
		for _, sp := range view.Splits {
			lines = append(lines, sp.Lines...)
		}
		return lines, nil
	}
	return view.Lines, nil
}

func fetchPendingBillSyncs(ctx context.Context, apiBase, jwt string) ([]billSyncJob, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, strings.TrimRight(apiBase, "/")+"/api/print-agent/pending-bill-syncs", nil)
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
		return nil, fmt.Errorf("pending-bill-syncs %s: %s", res.Status, string(raw))
	}
	var out struct {
		Jobs []billSyncJob `json:"jobs"`
	}
	if err := json.Unmarshal(raw, &out); err != nil {
		return nil, err
	}
	return out.Jobs, nil
}

func ackBillSync(ctx context.Context, apiBase, jwt, id, status, errCode, errMsg string) error {
	bodyMap := map[string]any{"status": status}
	if status == "failed" {
		if errCode != "" {
			bodyMap["error_code"] = errCode
		}
		if errMsg != "" {
			bodyMap["error_message"] = errMsg
		}
	}
	body, _ := json.Marshal(bodyMap)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, strings.TrimRight(apiBase, "/")+"/api/print-agent/bill-syncs/"+id+"/ack", bytes.NewReader(body))
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
		return fmt.Errorf("bill-sync ack %s: %s", res.Status, string(raw))
	}
	return nil
}

// processPendingBillSyncs pulls and persists drafts on the SAME notifier pipe as print jobs.
func processPendingBillSyncs(ctx context.Context, cfg *config) {
	jobs, err := fetchPendingBillSyncs(ctx, cfg.APIBase, cfg.AgentJWT)
	if err != nil {
		log.Printf("BillSync: fetch pending failed: %v", err)
		return
	}
	if len(jobs) == 0 {
		return
	}
	store := getBillSyncStore(cfg)
	for _, job := range jobs {
		lines, err := collectBillSyncLines(job.Payload)
		if err != nil {
			_ = ackBillSync(ctx, cfg.APIBase, cfg.AgentJWT, job.ID, "failed", "invalid_payload", err.Error())
			continue
		}
		if err := store.upsertDraftAndCatalog(job.SourceSaleID, job.RequestID, job.Payload, lines); err != nil {
			code := err.Error()
			_ = ackBillSync(ctx, cfg.APIBase, cfg.AgentJWT, job.ID, "failed", code, code)
			log.Printf("BillSync: job %s failed: %s", job.ID, code)
			continue
		}
		if err := ackBillSync(ctx, cfg.APIBase, cfg.AgentJWT, job.ID, "succeeded", "", ""); err != nil {
			log.Printf("BillSync: ack succeeded failed for %s: %v", job.ID, err)
			continue
		}
		log.Printf("BillSync: stored draft source_sale_id=%s request_id=%s", job.SourceSaleID, job.RequestID)
	}
}
