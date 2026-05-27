//go:build windows

package main

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
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

func showTestPrintResult(err error, locale string) {
	phrase := testPrintPhrase(locale)
	if err == nil {
		messageBoxOK(
			uiT(locale, "test_print_ok_title"),
			fmt.Sprintf(uiT(locale, "test_print_ok_body"), phrase),
		)
		return
	}
	messageBoxOK(uiT(locale, "test_print_fail_title"), err.Error())
}

func trayAboutText(rt *trayRuntime, locale string) string {
	text := uiT(locale, "about_title") + " " + Version + "\n\n" + uiT(locale, "about_config") + "\n" + defaultConfigPath()
	text += "\n\n" + uiT(locale, "about_log") + "\n" + filepath.Join(agentDataDir(), "agent.log")
	if sess, _, done := rt.snapshot(); done && sess != nil && sess.cfg.APIBase != "" {
		text += "\n\n" + uiT(locale, "about_mesa") + " " + sess.cfg.APIBase
	}
	return text
}

func applyTrayMenuLabels(mStatus, mSettings, mTestPrint, mOpenLog, mShowConsole, mAbout, mQuit interface {
	SetTitle(string)
	SetTooltip(string)
}, locale string) {
	mStatus.SetTitle(uiT(locale, "menu_status_prefix") + "…")
	mSettings.SetTitle(uiT(locale, "menu_settings"))
	mSettings.SetTooltip(uiT(locale, "menu_settings_tip"))
	mTestPrint.SetTitle(uiT(locale, "menu_test_print"))
	mTestPrint.SetTooltip(uiT(locale, "menu_test_print_tip"))
	mOpenLog.SetTitle(uiT(locale, "menu_open_log"))
	mOpenLog.SetTooltip(uiT(locale, "menu_open_log_tip"))
	mShowConsole.SetTitle(uiT(locale, "menu_console"))
	mShowConsole.SetTooltip(uiT(locale, "menu_console_tip"))
	mAbout.SetTitle(uiT(locale, "menu_about"))
	mAbout.SetTooltip(uiT(locale, "menu_about_tip"))
	mQuit.SetTitle(uiT(locale, "menu_quit"))
	mQuit.SetTooltip(uiT(locale, "menu_quit_tip"))
}
