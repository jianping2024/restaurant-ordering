//go:build windows

package main

import (
	"fmt"
	"os"
	"os/exec"
	"syscall"
)

func spawnAgentSubcommand(subcmd string) error {
	exe, err := os.Executable()
	if err != nil {
		return err
	}
	cmd := exec.Command(exe, subcmd)
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: false}
	if err := cmd.Start(); err != nil {
		return fmt.Errorf("start %s: %w", subcmd, err)
	}
	return nil
}
