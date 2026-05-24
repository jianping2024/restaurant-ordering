package main

import "testing"

func TestEncodeWindows1252Portuguese(t *testing.T) {
	raw := encodeWindows1252("ção")
	if len(raw) != 3 || raw[0] != 0xe7 || raw[1] != 0xe3 || raw[2] != 0x6f {
		t.Fatalf("Windows-1252 encoding: got % x", raw)
	}
}

func TestEncodeGBKChinese(t *testing.T) {
	raw := encodeGBK("川味")
	if len(raw) < 4 {
		t.Fatalf("GBK encoding too short: % x", raw)
	}
}

func TestPayloadNeedsGBK(t *testing.T) {
	if !payloadNeedsGBK(jobPayload{Locale: "pt", RestaurantName: "川味"}) {
		t.Fatal("expected GBK for Chinese restaurant name")
	}
	if payloadNeedsGBK(jobPayload{Locale: "pt", RestaurantName: "Mesa"}) {
		t.Fatal("expected Latin for ASCII-only pt payload")
	}
}
