package main

import "testing"

func TestWinspoolStatusIsProblem(t *testing.T) {
	if winspoolStatusIsProblem(0) {
		t.Fatal("zero status should be OK")
	}
	if !winspoolStatusIsProblem(printerStatusOffline) {
		t.Fatal("offline should be a problem")
	}
	if !winspoolStatusIsProblem(printerStatusNotAvailable) {
		t.Fatal("not available should be a problem")
	}
	if winspoolStatusIsProblem(0x100) {
		t.Fatal("busy alone should not fail")
	}
}
