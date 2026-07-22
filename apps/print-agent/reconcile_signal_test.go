package main

import "testing"

func TestReconcileSignalCoalesces(t *testing.T) {
	s := newReconcileSignal()
	s.request()
	s.request()
	s.request()
	select {
	case <-s.waitC():
	default:
		t.Fatal("expected one pending signal")
	}
	select {
	case <-s.waitC():
		t.Fatal("expected coalesced (no second signal)")
	default:
	}
}
