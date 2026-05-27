//go:build windows

package main

import (
	"flag"
	"log"
	"os"
	"syscall"
	"unsafe"
)

func windowsPrepareConsole(args []string) {
	if len(args) < 2 {
		return
	}
	switch args[1] {
	case "discover", "pair", "configure", "config", "setup",
		"help", "-h", "--help", "version", "-v", "--version":
		attachConsoleWindow()
		return
	case "run":
		if agentArgsWantConsole(args[2:]) {
			attachConsoleWindow()
		}
		return
	}
	if agentArgsWantConsole(args[1:]) {
		attachConsoleWindow()
	}
}

func agentArgsWantConsole(args []string) bool {
	fs := flag.NewFlagSet("console-probe", flag.ContinueOnError)
	show := fs.Bool("console", false, "")
	_ = fs.Parse(args)
	return *show
}

// attachConsoleWindow creates a console for CLI subcommands (windowsgui builds).
func attachConsoleWindow() {
	kernel32 := syscall.NewLazyDLL("kernel32.dll")
	r, _, _ := kernel32.NewProc("AllocConsole").Call()
	if r == 0 {
		if hwnd, _, _ := kernel32.NewProc("GetConsoleWindow").Call(); hwnd != 0 {
			return
		}
	}
	if out, err := os.OpenFile("CONOUT$", os.O_WRONLY, 0); err == nil {
		os.Stdout = out
		os.Stderr = out
		log.SetOutput(out)
	}
	if in, err := os.OpenFile("CONIN$", os.O_RDONLY, 0); err == nil {
		os.Stdin = in
	}
}

func hideConsoleWindow() {
	getConsoleWindow := syscall.NewLazyDLL("kernel32.dll").NewProc("GetConsoleWindow")
	showWindow := syscall.NewLazyDLL("user32.dll").NewProc("ShowWindow")
	hwnd, _, _ := getConsoleWindow.Call()
	if hwnd == 0 {
		return
	}
	const swHide = 0
	_, _, _ = showWindow.Call(hwnd, swHide)
}

func showConsoleWindow() {
	hwnd, _, _ := syscall.NewLazyDLL("kernel32.dll").NewProc("GetConsoleWindow").Call()
	if hwnd == 0 {
		attachConsoleWindow()
		return
	}
	showWindow := syscall.NewLazyDLL("user32.dll").NewProc("ShowWindow")
	const swShow = 5
	_, _, _ = showWindow.Call(hwnd, swShow)
}

// messageBoxOK shows a simple info dialog (tray "About").
func messageBoxOK(title, text string) {
	user32 := syscall.NewLazyDLL("user32.dll")
	messageBoxW := user32.NewProc("MessageBoxW")
	mbOK := uintptr(0)
	mbIconInfo := uintptr(0x40)
	tPtr, _ := syscall.UTF16PtrFromString(title)
	mPtr, _ := syscall.UTF16PtrFromString(text)
	_, _, _ = messageBoxW.Call(0, uintptr(unsafe.Pointer(mPtr)), uintptr(unsafe.Pointer(tPtr)), mbOK|mbIconInfo)
}

// messageBoxYesNo returns true if the user chose Yes.
func messageBoxYesNo(title, text string) bool {
	user32 := syscall.NewLazyDLL("user32.dll")
	messageBoxW := user32.NewProc("MessageBoxW")
	const (
		mbYesNo      = 0x00000004
		mbIconQuest  = 0x00000020
		idYes        = 6
	)
	tPtr, _ := syscall.UTF16PtrFromString(title)
	mPtr, _ := syscall.UTF16PtrFromString(text)
	ret, _, _ := messageBoxW.Call(0, uintptr(unsafe.Pointer(mPtr)), uintptr(unsafe.Pointer(tPtr)), mbYesNo|mbIconQuest)
	return ret == idYes
}
