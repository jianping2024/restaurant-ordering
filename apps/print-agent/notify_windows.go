//go:build windows

package main

import (
	"fmt"
	"os"
	"path/filepath"
)

func maybeNotifyTrayReady() {
	cfg, err := loadConfig(defaultConfigPath())
	if err != nil || cfg == nil || cfg.AgentJWT == "" {
		return
	}
	marker := filepath.Join(agentDataDir(), ".tray_ready_tip_shown")
	if _, err := os.Stat(marker); err == nil {
		return
	}
	_ = os.MkdirAll(agentDataDir(), 0o700)
	_ = os.WriteFile(marker, []byte("1"), 0o644)
	loc := cfg.uiLocale()
	messageBoxOK(
		uiT(loc, "tray_startup_title"),
		fmt.Sprintf(uiT(loc, "tray_startup_body"), filepath.Join(agentDataDir(), "agent.log")),
	)
}
