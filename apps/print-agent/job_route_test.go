package main

import "testing"

func TestReorderQueueAwayFromPrinter(t *testing.T) {
	t.Parallel()
	cfg := &config{StationPrinters: map[string]string{
		"cold": "tcp:10.0.0.1:9100",
		"hot":  "tcp:10.0.0.2:9100",
	}}
	q := []printJob{
		{ID: "1", Type: "station_ticket", Payload: []byte(`{"print_station_id":"cold"}`)},
		{ID: "2", Type: "station_ticket", Payload: []byte(`{"print_station_id":"hot"}`)},
		{ID: "3", Type: "station_ticket", Payload: []byte(`{"print_station_id":"cold"}`)},
	}
	out := reorderQueueAwayFromPrinter(q, cfg, "tcp:10.0.0.1:9100")
	if out == nil || len(out) != 3 {
		t.Fatalf("got %v", out)
	}
	if out[0].ID != "2" || out[1].ID != "1" || out[2].ID != "3" {
		t.Fatalf("order %v %v %v", out[0].ID, out[1].ID, out[2].ID)
	}
}

func TestReorderQueueAwayFromPrinter_allSameBlocked(t *testing.T) {
	t.Parallel()
	cfg := &config{StationPrinters: map[string]string{"a": "tcp:10.0.0.1:9100"}}
	q := []printJob{
		{ID: "1", Type: "station_ticket", Payload: []byte(`{"print_station_id":"a"}`)},
	}
	if got := reorderQueueAwayFromPrinter(q, cfg, "tcp:10.0.0.1:9100"); got != nil {
		t.Fatalf("expected nil, got %v", got)
	}
}

func TestJobRouteStationID(t *testing.T) {
	t.Parallel()
	j := printJob{Type: "station_ticket", Payload: []byte(`{"print_station_id":"kitchen"}`)}
	if jobRouteStationID(j) != "kitchen" {
		t.Fatalf("got %q", jobRouteStationID(j))
	}
}
