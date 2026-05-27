//go:build windows

package main

import "log"

func announceWizardURL(title, url string) {
	if err := openBrowser(url); err != nil {
		log.Printf("%s: could not open browser: %v", title, err)
	}
	notifyLocalWizardURL(title, url)
}
