package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

func TestBillSyncStoreOverwriteOpenAndRejectInvoiced(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "bill-sync-drafts.json")
	store := &billSyncDraftStore{
		path:    path,
		Drafts:  map[string]billSyncDraft{},
		Catalog: map[string]billSyncCatalogItem{},
	}

	payload := json.RawMessage(`{"source_sale_id":"sale-1"}`)
	lines := []billSyncLineView{{
		ItemCode: "815", Name: "Beer", Qty: "1.00",
		UnitPriceGross: "4.90", LineGross: "4.90", VatRate: "23.00",
	}}
	if err := store.upsertDraftAndCatalog("sale-1", "req-1", payload, lines); err != nil {
		t.Fatal(err)
	}
	if err := store.upsertDraftAndCatalog("sale-1", "req-2", payload, lines); err != nil {
		t.Fatalf("overwrite open should succeed: %v", err)
	}
	store.mu.Lock()
	d := store.Drafts["sale-1"]
	d.Status = "invoiced"
	store.Drafts["sale-1"] = d
	_ = store.saveLocked()
	store.mu.Unlock()

	err := store.upsertDraftAndCatalog("sale-1", "req-3", payload, lines)
	if err == nil || err.Error() != "already_invoiced" {
		t.Fatalf("want already_invoiced, got %v", err)
	}
	if _, err := os.Stat(path); err != nil {
		t.Fatal(err)
	}
}

func TestValidBillSyncVatRate(t *testing.T) {
	if !validBillSyncVatRate("23.00") {
		t.Fatal("23.00 should be valid")
	}
	if validBillSyncVatRate("0.23") {
		t.Fatal("0.23 fraction should be invalid")
	}
}
