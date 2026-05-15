package main

import (
	"testing"
	"time"
)

func TestSchedulePirataWeekdayLunch(t *testing.T) {
	s := &scheduleConfig{
		Timezone: "Europe/Lisbon",
		Weekday: &daySchedule{Windows: []timeWindow{
			{Start: "12:00", End: "15:00"},
			{Start: "19:30", End: "23:00"},
		}},
	}
	loc, err := time.LoadLocation("Europe/Lisbon")
	if err != nil {
		t.Fatal(err)
	}
	// Wednesday 12:45
	wed := time.Date(2026, 5, 13, 12, 45, 0, 0, loc)
	open, err := s.activeAt(wed)
	if err != nil || !open {
		t.Fatalf("expected open at lunch, got open=%v err=%v", open, err)
	}
	// Wednesday 15:00 — between services
	mid := time.Date(2026, 5, 13, 15, 0, 0, 0, loc)
	open, err = s.activeAt(mid)
	if err != nil || open {
		t.Fatalf("expected closed mid-afternoon, got open=%v err=%v", open, err)
	}
	// Sunday 13:00 (uses weekday template)
	sun := time.Date(2026, 5, 17, 13, 0, 0, 0, loc)
	open, err = s.activeAt(sun)
	if err != nil || !open {
		t.Fatalf("expected open Sunday lunch via weekday, got open=%v err=%v", open, err)
	}
}

func TestPollPhaseWarm(t *testing.T) {
	pc := &pollController{
		cfg: defaultPollConfig(),
		lastAct: time.Now().Add(-5 * time.Minute),
	}
	if pc.phase(false, false) != pollPhaseWarm {
		t.Fatalf("expected warm, got %s", pc.phase(false, false))
	}
	pc.lastAct = time.Now().Add(-2 * time.Hour)
	if pc.phase(false, false) != pollPhaseIdle {
		t.Fatalf("expected idle, got %s", pc.phase(false, false))
	}
}
