package main

import "testing"

func TestTrayLevelForSummary(t *testing.T) {
	cases := []struct {
		in   string
		want trayLevel
	}{
		{"Ready", trayLevelGreen},
		{"Printing", trayLevelGreen},
		{"Outside business hours", trayLevelYellow},
		{"Connection problem", trayLevelRed},
		{"Print failed", trayLevelRed},
	}
	for _, tc := range cases {
		if got := trayLevelForSummary(tc.in); got != tc.want {
			t.Fatalf("%q: got %v want %v", tc.in, got, tc.want)
		}
	}
}

func TestTrayUserSummaryLocalized(t *testing.T) {
	if got := trayUserSummary("Ready", "zh"); got != "运行正常" {
		t.Fatalf("zh got %q", got)
	}
	if got := trayUserSummary("Ready", "en"); got != "Running OK" {
		t.Fatalf("en got %q", got)
	}
	if got := testPrintPhrase("en"); got != "PRINT TEST" {
		t.Fatalf("en test phrase got %q", got)
	}
}
