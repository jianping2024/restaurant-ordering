//go:build windows

package main

import (
	"io"
	"log"
	"os"
	"path/filepath"
)

func agentDataDir() string {
	if base := os.Getenv("LOCALAPPDATA"); base != "" {
		return filepath.Join(base, "Mesa Print Agent")
	}
	home, err := os.UserHomeDir()
	if err != nil {
		return filepath.Join(os.TempDir(), "MesaPrintAgent")
	}
	return filepath.Join(home, "AppData", "Local", "Mesa Print Agent")
}

func initWindowsAgentLog() {
	dir := agentDataDir()
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return
	}
	path := filepath.Join(dir, "agent.log")
	f, err := os.OpenFile(path, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o644)
	if err != nil {
		return
	}
	log.SetOutput(io.MultiWriter(f))
	log.Printf("--- Mesa Print Agent %s starting ---", Version)
}
