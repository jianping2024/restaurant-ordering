//go:build windows

package main

import (
	"fmt"
	"syscall"
	"unsafe"
)

func openBrowser(url string) error {
	shell32 := syscall.NewLazyDLL("shell32.dll")
	shellExecuteW := shell32.NewProc("ShellExecuteW")
	verb, err := syscall.UTF16PtrFromString("open")
	if err != nil {
		return err
	}
	u, err := syscall.UTF16PtrFromString(url)
	if err != nil {
		return err
	}
	// SW_SHOWNORMAL
	ret, _, callErr := shellExecuteW.Call(0, uintptr(unsafe.Pointer(verb)), uintptr(unsafe.Pointer(u)), 0, 0, 1)
	if ret <= 32 {
		if callErr != nil && callErr != syscall.Errno(0) {
			return fmt.Errorf("ShellExecute: %w", callErr)
		}
		return fmt.Errorf("ShellExecute failed (code %d)", ret)
	}
	return nil
}
