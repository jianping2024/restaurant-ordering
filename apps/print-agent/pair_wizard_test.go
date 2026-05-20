package main

import "testing"

func TestNormalizeAPIBase(t *testing.T) {
	got, err := normalizeAPIBase("https://restaurant-ordering-beryl-three.vercel.app/dashboard/settings/print-assistant")
	if err != nil {
		t.Fatal(err)
	}
	want := "https://restaurant-ordering-beryl-three.vercel.app"
	if got != want {
		t.Fatalf("got %q want %q", got, want)
	}
}
