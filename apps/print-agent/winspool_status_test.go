package main

import "testing"

func TestWinspoolStatusIsProblemDiagnostic(t *testing.T) {
	if winspoolStatusIsProblem(0) {
		t.Fatal("zero status should be OK")
	}
	if winspoolStatusIsProblem(printerStatusOffline) {
		t.Fatal("offline alone must not block (common false positive on USB POS)")
	}
	if winspoolStatusIsProblem(0xC0) {
		t.Fatal("0xC0 (offline|paper_problem) must not block preflight")
	}
	if !winspoolStatusIsProblem(printerStatusNotAvailable) {
		t.Fatal("not available should be a problem")
	}
	if winspoolStatusIsProblem(0x100) {
		t.Fatal("busy alone should not fail")
	}
}
