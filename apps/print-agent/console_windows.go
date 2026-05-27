//go:build windows

package main

import (
	"syscall"
	"unsafe"
)

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
	getConsoleWindow := syscall.NewLazyDLL("kernel32.dll").NewProc("GetConsoleWindow")
	showWindow := syscall.NewLazyDLL("user32.dll").NewProc("ShowWindow")
	hwnd, _, _ := getConsoleWindow.Call()
	if hwnd == 0 {
		return
	}
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
