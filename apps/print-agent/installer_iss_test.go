package main

import (
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"
)

// Sole upgrade story in mesa-print-agent.iss — fail if a second privilege/mutex path appears.
func TestInnoSetupUpgradeStory(t *testing.T) {
	raw, err := os.ReadFile(filepath.Join("installer", "mesa-print-agent.iss"))
	if err != nil {
		t.Fatal(err)
	}
	iss := string(raw)

	mustContain := []string{
		"PrivilegesRequired=admin",
		"UsePreviousAppDir=yes",
		"AppMutex=" + agentMutexName,
		"CloseApplications=yes",
		"CloseApplicationsFilter=MesaPrintAgent.exe",
		"Flags: ignoreversion restartreplace",
	}
	for _, s := range mustContain {
		if !strings.Contains(iss, s) {
			t.Fatalf("installer missing required directive %q", s)
		}
	}
	if strings.Contains(iss, "PrivilegesRequired=lowest") {
		t.Fatal("PrivilegesRequired=lowest must not remain — admin is the sole Setup privilege path")
	}
	if strings.Count(iss, "AppMutex=") != 1 {
		t.Fatal("expected exactly one AppMutex= line")
	}
	if strings.Count(iss, "PrivilegesRequired=") != 1 {
		t.Fatal("expected exactly one PrivilegesRequired= line")
	}
	re := regexp.MustCompile(`(?m)^AppMutex=(.+)$`)
	m := re.FindStringSubmatch(iss)
	if len(m) != 2 || m[1] != agentMutexName {
		t.Fatalf("AppMutex must equal agentMutexName %q, got %q", agentMutexName, m)
	}
}

func TestAgentMutexNameStable(t *testing.T) {
	const want = `Global\MesaPrintAgent-SingleInstance-v1`
	if agentMutexName != want {
		t.Fatalf("agentMutexName changed to %q; update Inno AppMutex in lockstep", agentMutexName)
	}
}
