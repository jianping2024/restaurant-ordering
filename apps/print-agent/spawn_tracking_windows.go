//go:build windows

package main

import (
	"os/exec"
	"sync"
)

var (
	spawnedProcsMu sync.Mutex
	spawnedProcs   []*exec.Cmd
)

func registerSpawnedProcess(cmd *exec.Cmd) {
	if cmd == nil || cmd.Process == nil {
		return
	}
	spawnedProcsMu.Lock()
	spawnedProcs = append(spawnedProcs, cmd)
	spawnedProcsMu.Unlock()
	go func() {
		_ = cmd.Wait()
		spawnedProcsMu.Lock()
		defer spawnedProcsMu.Unlock()
		for i, c := range spawnedProcs {
			if c == cmd {
				spawnedProcs = append(spawnedProcs[:i], spawnedProcs[i+1:]...)
				break
			}
		}
	}()
}

// terminateSpawnedChildren ends configure/pair/setup helper processes (separate exe invocations).
func terminateSpawnedChildren() {
	spawnedProcsMu.Lock()
	list := append([]*exec.Cmd(nil), spawnedProcs...)
	spawnedProcsMu.Unlock()
	for _, cmd := range list {
		if cmd == nil || cmd.Process == nil {
			continue
		}
		_ = cmd.Process.Kill()
	}
}
