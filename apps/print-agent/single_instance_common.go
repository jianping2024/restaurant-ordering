package main

import "os"

// isMainAgentInvocation is true for the long-running tray/console agent, not helper CLIs.
func isMainAgentInvocation(args []string) bool {
	if len(args) < 2 {
		return true
	}
	switch args[1] {
	case "discover", "pair", "configure", "config", "setup",
		"help", "-h", "--help", "version", "-v", "--version", "--restart-wait":
		return false
	case "run":
		return true
	default:
		// MesaPrintAgent, MesaPrintAgent -console, MesaPrintAgent -api … -code …
		return true
	}
}

func guardMainAgentSingleInstance() {
	if !isMainAgentInvocation(os.Args) {
		return
	}
	if !acquireAgentSingleInstance() {
		exitAlreadyRunning()
	}
}
