//go:build windows

package main

import (
	"log"
	"os"
	"sync"
	"time"

	"github.com/getlantern/systray"
)

var exitOnce sync.Once

// stopTrayAgentWork cancels polling/init and stops local HTTP wizards. Safe from any goroutine.
func stopTrayAgentWork(rt *trayRuntime) {
	log.Println("tray: stop work")
	if rt != nil && rt.cancel != nil {
		rt.cancel()
	}
	shutdownAllWizardServers()
	shutdownTrayLocalHTTP()
	terminateSpawnedChildren()
	releaseAgentSingleInstance()
}

// requestTrayExit shuts down and terminates the process immediately.
// systray.Quit must not run on the menu goroutine — it can block and prevent exit.
func requestTrayExit(rt *trayRuntime) {
	stopTrayAgentWork(rt)
	go systray.Quit()
	// Belt-and-suspenders: if systray.Run never returns, still exit.
	go func() {
		time.Sleep(2 * time.Second)
		exitTrayAgent()
	}()
	exitTrayAgent()
}

// exitTrayAgent terminates the process (does not return).
func exitTrayAgent() {
	exitOnce.Do(func() {
		log.Println("tray: exiting process")
		os.Exit(0)
		killCurrentProcess()
	})
}
