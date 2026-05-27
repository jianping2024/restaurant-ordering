package main

import (
	"fmt"
	"strings"
	"sync"
)

// agentStatus is shared between the poll loop and the system tray (Windows).
type agentStatus struct {
	mu      sync.RWMutex
	summary string
	detail  string
}

func (s *agentStatus) set(summary, detail string) {
	s.mu.Lock()
	s.summary = strings.TrimSpace(summary)
	s.detail = strings.TrimSpace(detail)
	s.mu.Unlock()
}

func (s *agentStatus) tooltip(version string) string {
	s.mu.RLock()
	sum := s.summary
	det := s.detail
	s.mu.RUnlock()
	if sum == "" {
		sum = "Starting…"
	}
	tip := fmt.Sprintf("Mesa Print Agent %s\n%s", version, sum)
	if det != "" {
		tip += "\n" + det
	}
	return tip
}
