package main

import "testing"

func TestCutSequenceFeedsBeforeCut(t *testing.T) {
	w := newEscpos()
	w.text("footer")
	w.cut()
	raw := w.bytes()
	if !containsSubslice(raw, []byte{0x1B, 0x64, escposFeedLinesBeforeCut}) {
		t.Fatalf("expected ESC d feed before cut, got % x", raw[len(raw)-20:])
	}
	if !containsSubslice(raw, []byte{0x1D, 0x56, 0x42, escposFeedDotsBeforeCut}) {
		t.Fatal("expected GS V 66 feed-then-cut")
	}
	if containsSubslice(raw, []byte{0x1D, 0x56, 0x00}) {
		t.Fatal("immediate GS V 0 cut should not be used")
	}
}

func containsSubslice(b, sub []byte) bool {
	if len(sub) == 0 {
		return true
	}
	for i := 0; i+len(sub) <= len(b); i++ {
		ok := true
		for j := range sub {
			if b[i+j] != sub[j] {
				ok = false
				break
			}
		}
		if ok {
			return true
		}
	}
	return false
}
