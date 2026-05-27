//go:build windows

package main

import (
	"log"
	"os"

	"github.com/getlantern/systray"
)

// stopTrayAgent cancels background work, stops local wizards, and ends the systray loop.
func stopTrayAgent(rt *trayRuntime) {
	log.Println("tray: stop requested")
	if rt.cancel != nil {
		rt.cancel()
	}
	shutdownAllWizardServers()
	systray.Quit()
}

// exitTrayAgent ensures the process terminates after systray.Run returns.
func exitTrayAgent() {
	log.Println("tray: exiting process")
	os.Exit(0)
}
