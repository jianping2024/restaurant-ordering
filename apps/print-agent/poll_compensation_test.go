package main

import (
	"testing"
	"time"
)

func TestCompensationInterval(t *testing.T) {
	pc, err := newPollController(nil, &pollConfig{WarmIntervalSec: 12})
	if err != nil {
		t.Fatal(err)
	}
	if got := pc.compensationInterval(); got != 12*time.Second {
		t.Fatalf("got %v want 12s", got)
	}
	if got := (*pollController)(nil).compensationInterval(); got != 5*time.Second {
		t.Fatalf("nil pc got %v want default warm 5s", got)
	}
}
