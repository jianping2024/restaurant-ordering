//go:build windows

package main

import (
	"log"
	"os"
	"os/exec"
	"strings"
	"syscall"

	"golang.org/x/sys/windows/registry"
)

// Inno AppId from installer/mesa-print-agent.iss (without surrounding braces in some keys).
const mesaPrintAgentInnoAppID = "{A3B8F2E1-9C4D-4A2B-8E1F-0D5C6B7A8E9F}_is1"

// uninstallAgentWithUserData is the sole tray uninstall path: wipe local config+logs,
// launch Setup uninstaller when present, then exit so files can be removed.
func uninstallAgentWithUserData(rt *trayRuntime) {
	loc := loadTrayUILocale()
	removed := removeAgentUserDataDirs()
	unins := findMesaPrintAgentUninstallCommand()
	if unins == "" {
		log.Println("tray: uninstall — no Setup uninstaller found (portable?)")
		messageBoxOK(uiT(loc, "about_title"), uiT(loc, "uninstall_portable_hint"))
		requestTrayExit(rt)
		return
	}
	log.Printf("tray: uninstall — removed user data=%v; launching %s", removed, unins)
	if err := startWindowsUninstaller(unins); err != nil {
		log.Printf("tray: uninstall launch failed: %v", err)
		messageBoxOK(uiT(loc, "about_title"), fmtUninstallLaunchFail(loc, err))
		requestTrayExit(rt)
		return
	}
	requestTrayExit(rt)
}

func fmtUninstallLaunchFail(locale string, err error) string {
	return strings.ReplaceAll(uiT(locale, "uninstall_launch_fail"), "%s", err.Error())
}

func removeAgentUserDataDirs() bool {
	ok := true
	for _, dir := range agentUserDataDirs() {
		if dir == "" {
			continue
		}
		if err := os.RemoveAll(dir); err != nil {
			log.Printf("tray: uninstall remove %s: %v", dir, err)
			ok = false
		}
	}
	return ok
}

func findMesaPrintAgentUninstallCommand() string {
	keys := []struct {
		root registry.Key
		path string
	}{
		{registry.LOCAL_MACHINE, `SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\` + mesaPrintAgentInnoAppID},
		{registry.LOCAL_MACHINE, `SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\` + mesaPrintAgentInnoAppID},
		{registry.CURRENT_USER, `SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\` + mesaPrintAgentInnoAppID},
	}
	for _, k := range keys {
		if cmd := readUninstallString(k.root, k.path); cmd != "" {
			return cmd
		}
	}
	return findUninstallByDisplayName("Mesa Print Agent")
}

func readUninstallString(root registry.Key, path string) string {
	k, err := registry.OpenKey(root, path, registry.QUERY_VALUE)
	if err != nil {
		return ""
	}
	defer k.Close()
	s, _, err := k.GetStringValue("QuietUninstallString")
	if err == nil && strings.TrimSpace(s) != "" {
		return strings.TrimSpace(s)
	}
	s, _, err = k.GetStringValue("UninstallString")
	if err != nil {
		return ""
	}
	return strings.TrimSpace(s)
}

func findUninstallByDisplayName(want string) string {
	want = strings.TrimSpace(want)
	roots := []registry.Key{registry.LOCAL_MACHINE, registry.CURRENT_USER}
	subPaths := []string{
		`SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall`,
		`SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall`,
	}
	for _, root := range roots {
		for _, sub := range subPaths {
			k, err := registry.OpenKey(root, sub, registry.ENUMERATE_SUB_KEYS|registry.QUERY_VALUE)
			if err != nil {
				continue
			}
			names, err := k.ReadSubKeyNames(-1)
			_ = k.Close()
			if err != nil {
				continue
			}
			for _, name := range names {
				path := sub + `\` + name
				sk, err := registry.OpenKey(root, path, registry.QUERY_VALUE)
				if err != nil {
					continue
				}
				display, _, _ := sk.GetStringValue("DisplayName")
				_ = sk.Close()
				if strings.EqualFold(strings.TrimSpace(display), want) {
					if cmd := readUninstallString(root, path); cmd != "" {
						return cmd
					}
				}
			}
		}
	}
	return ""
}

func startWindowsUninstaller(cmdline string) error {
	cmdline = strings.TrimSpace(cmdline)
	if cmdline == "" {
		return os.ErrInvalid
	}
	// Prefer silent when Inno left QuietUninstallString; else append /SILENT for UninstallString.
	if !strings.Contains(strings.ToUpper(cmdline), "/SILENT") &&
		!strings.Contains(strings.ToUpper(cmdline), "/VERYSILENT") {
		cmdline = cmdline + " /SILENT"
	}
	cmd := exec.Command("cmd", "/C", cmdline)
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	return cmd.Start()
}
