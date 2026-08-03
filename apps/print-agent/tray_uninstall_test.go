package main

import (
	"path/filepath"
	"testing"
)

func TestUniqueNonEmptyStrings(t *testing.T) {
	got := uniqueNonEmptyStrings([]string{" a ", "", "a", "b", " b "})
	if len(got) != 2 || got[0] != "a" || got[1] != "b" {
		t.Fatalf("got %#v", got)
	}
}

func TestAgentUserDataDirsIncludesConfigParent(t *testing.T) {
	prev := configPathOverride
	dir := t.TempDir()
	configPathOverride = filepath.Join(dir, "mesa-print-agent", "config.json")
	defer func() { configPathOverride = prev }()

	dirs := agentUserDataDirs()
	want := filepath.Join(dir, "mesa-print-agent")
	found := false
	for _, d := range dirs {
		if d == want {
			found = true
		}
	}
	if !found {
		t.Fatalf("expected %q in %#v", want, dirs)
	}
}
