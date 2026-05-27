//go:build windows

package main

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
)

func openAgentLogFolder() error {
	dir := agentDataDir()
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return err
	}
	return exec.Command("explorer", dir).Start()
}

func confirmTrayExit(locale string) bool {
	return messageBoxYesNo(
		uiT(locale, "exit_confirm_title"),
		uiT(locale, "exit_confirm_body"),
	)
}

func trayAboutText(rt *trayRuntime, locale string) string {
	text := uiT(locale, "about_title") + " " + Version + "\n\n" + uiT(locale, "about_config") + "\n" + defaultConfigPath()
	text += "\n\n" + uiT(locale, "about_log") + "\n" + filepath.Join(agentDataDir(), "agent.log")
	cfg, _ := loadConfig(defaultConfigPath())
	if cfg == nil {
		if sess, _, done := rt.snapshot(); done && sess != nil && sess.cfg != nil {
			cfg = sess.cfg
		}
	}
	if cfg != nil {
		if line := cfg.credentialAboutLine(locale, time.Now()); line != "" {
			text += "\n\n" + line
		}
		if strings.TrimSpace(cfg.APIBase) != "" {
			text += "\n\n" + uiT(locale, "about_mesa") + " " + cfg.APIBase
		}
	}
	return text
}

func applyTrayMenuLabels(mStatus, mSettings, mOpenLog, mShowConsole, mAbout, mQuit interface {
	SetTitle(string)
	SetTooltip(string)
}, locale string) {
	mStatus.SetTitle(uiT(locale, "menu_status_prefix") + "…")
	mSettings.SetTitle(uiT(locale, "menu_settings"))
	mSettings.SetTooltip(uiT(locale, "menu_settings_tip"))
	mOpenLog.SetTitle(uiT(locale, "menu_open_log"))
	mOpenLog.SetTooltip(uiT(locale, "menu_open_log_tip"))
	mShowConsole.SetTitle(uiT(locale, "menu_console"))
	mShowConsole.SetTooltip(uiT(locale, "menu_console_tip"))
	mAbout.SetTitle(uiT(locale, "menu_about"))
	mAbout.SetTooltip(uiT(locale, "menu_about_tip"))
	mQuit.SetTitle(uiT(locale, "menu_quit"))
	mQuit.SetTooltip(uiT(locale, "menu_quit_tip"))
}
