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

func TestTrayUserSummaryChinese(t *testing.T) {
	if got := trayUserSummary("Ready"); got != "运行正常" {
		t.Fatalf("got %q", got)
	}
	if got := trayUserSummary("Outside business hours"); got != "非营业时间" {
		t.Fatalf("got %q", got)
	}
}
