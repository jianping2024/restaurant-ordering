package main

import (
	"fmt"
	"strings"
	"testing"
	"time"
)

func TestLogReadiness_includesDecisionFields(t *testing.T) {
	t.Parallel()
	tr := newPrinterReadyTracker()
	key := "winspool:Kitchen"
	tr.printAfter[key] = tr.agentStartedAt
	tr.onlineConfirmed[key] = false
	pt := printerTarget{Scheme: schemeWinspool, WinspoolName: "Kitchen", Display: "winspool:Kitchen"}
	job := printJob{
		ID:        "job-1",
		CreatedAt: tr.agentStartedAt.Add(time.Minute).UTC().Format(time.RFC3339),
	}
	fields := map[string]string{"decision": "pending_unconfirmed", "mesa_patch": "pending"}
	parts := []string{
		"event=" + string(readinessPrepare),
		"target=" + key,
		"scheme=" + pt.Scheme,
	}
	parts = append(parts, tr.readinessStateFields(key)...)
	parts = append(parts, "job_id="+job.ID)
	for k, v := range fields {
		parts = append(parts, k+"="+v)
	}
	tech := strings.Join(parts, " ")
	for _, want := range []string{
		"event=prepare_job",
		"online_confirmed=false",
		"decision=pending_unconfirmed",
		"mesa_patch=pending",
		"job_id=job-1",
	} {
		if !strings.Contains(tech, want) {
			t.Fatalf("tech %q missing %q", tech, want)
		}
	}
}

func TestReadinessCheckValue(t *testing.T) {
	t.Parallel()
	if readinessCheckValue(fmt.Errorf("x"), schemeWinspool) != "open_fail" {
		t.Fatal("winspool fail")
	}
	if readinessCheckValue(nil, schemeTCP) != "tcp_ok" {
		t.Fatal("tcp ok")
	}
}
