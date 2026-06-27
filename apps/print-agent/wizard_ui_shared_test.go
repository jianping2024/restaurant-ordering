package main

import (
	"strings"
	"testing"
)

func TestWizardUISharedJSEmbedded(t *testing.T) {
	body := string(wizardUISharedJS)
	if !strings.Contains(body, "MesaWizardUI") {
		t.Fatal("missing MesaWizardUI export")
	}
	if !strings.Contains(body, "postSetup") {
		t.Fatal("missing postSetup helper")
	}
	if !strings.Contains(body, "save_cleared_ok") {
		t.Fatal("missing save_cleared_ok key reference")
	}
}

func TestConfigureUIUsesSharedWizardJS(t *testing.T) {
	html := string(configureUIHTML)
	if !strings.Contains(html, "/wizard-ui-shared.js") {
		t.Fatal("configure_ui.html must load /wizard-ui-shared.js")
	}
	if strings.Contains(html, "function formatSaveError") {
		t.Fatal("duplicate formatSaveError should live in wizard_ui_shared.js")
	}
}

func TestSetupUIUsesSharedWizardJS(t *testing.T) {
	html := string(setupUIHTML)
	if !strings.Contains(html, "/wizard-ui-shared.js") {
		t.Fatal("setup_ui.html must load /wizard-ui-shared.js")
	}
	if strings.Contains(html, "function formatSaveError") {
		t.Fatal("duplicate formatSaveError should live in wizard_ui_shared.js")
	}
}

func TestMappingSaveI18nKeys(t *testing.T) {
	for _, loc := range []string{"zh", "en", "pt"} {
		bundle := uiBundleMap(loc)
		for _, key := range []string{"save_ok", "save_cleared_ok", "save_need_mapping"} {
			if strings.TrimSpace(bundle[key]) == "" || bundle[key] == key {
				t.Fatalf("locale %s missing %s", loc, key)
			}
		}
	}
}
