package main

import "testing"

func TestDeferBlockedHead_singleClears(t *testing.T) {
	t.Parallel()
	var spins int
	out, blocked := deferBlockedHead([]printJob{{ID: "a"}}, &spins)
	if out != nil || !blocked || spins != 0 {
		t.Fatalf("got out=%v blocked=%v spins=%d", out, blocked, spins)
	}
}

func TestDeferBlockedHead_rotatesThenExhausts(t *testing.T) {
	t.Parallel()
	q := []printJob{{ID: "a"}, {ID: "b"}}
	var spins int
	out, blocked := deferBlockedHead(q, &spins)
	if blocked || len(out) != 2 || out[0].ID != "b" || out[1].ID != "a" {
		t.Fatalf("first rotate: out=%v blocked=%v", out, blocked)
	}
	_, blocked = deferBlockedHead(out, &spins)
	if !blocked || spins != 0 {
		t.Fatalf("expected all blocked after 2 spins, spins=%d", spins)
	}
}
