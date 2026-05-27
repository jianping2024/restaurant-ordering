//go:build windows

package main

import (
	"context"
	"errors"
	"log"
	"time"
)

// startTrayConfigureWizard serves the configure UI in the tray process (no child exe).
// Stops when the user exits the tray or the wizard finishes.
func (rt *trayRuntime) startTrayConfigureWizard() {
	if rt == nil || rt.ctx == nil {
		return
	}
	rt.configureMu.Lock()
	if rt.configureActive {
		url := rt.configureURL
		rt.configureMu.Unlock()
		if url != "" {
			announceWizardURL("", url)
		}
		return
	}
	rt.configureActive = true
	rt.configureMu.Unlock()

	go func() {
		defer func() {
			rt.configureMu.Lock()
			rt.configureActive = false
			rt.configureURL = ""
			rt.configureMu.Unlock()
		}()

		path := defaultConfigPath()
		prefill := ""
		if loaded, err := loadConfig(path); err == nil && loaded.APIBase != "" {
			prefill = loaded.APIBase
		}
		wctx, cancel := context.WithTimeout(rt.ctx, 60*time.Minute)
		defer cancel()
		if err := runConfigureWizard(wctx, path, prefill); err != nil {
			if errors.Is(err, context.Canceled) {
				log.Println("tray: configure wizard stopped")
				return
			}
			log.Println("tray: configure wizard:", err)
		}
	}()
}

// rememberConfigureWizardURL is called when the local configure server is ready.
func (rt *trayRuntime) rememberConfigureWizardURL(url string) {
	if rt == nil || url == "" {
		return
	}
	rt.configureMu.Lock()
	rt.configureURL = url
	rt.configureMu.Unlock()
}
