//go:build windows

package main

import (
	"os"
	"syscall"
	"unsafe"
)

const agentMutexName = "Global\\MesaPrintAgent-SingleInstance-v1"

// acquireAgentSingleInstance returns false if another agent instance holds the mutex.
func acquireAgentSingleInstance() bool {
	name, _ := syscall.UTF16PtrFromString(agentMutexName)
	kernel32 := syscall.NewLazyDLL("kernel32.dll")
	createMutex := kernel32.NewProc("CreateMutexW")
	const errorAlreadyExists = 183

	handle, _, err := createMutex.Call(0, 0, uintptr(unsafe.Pointer(name)))
	if handle == 0 {
		return true
	}
	if err == syscall.Errno(errorAlreadyExists) {
		_ = syscall.CloseHandle(syscall.Handle(handle))
		return false
	}
	return true
}

func exitAlreadyRunning() {
	messageBoxOK(
		"Mesa Print Agent",
		"打印代理已在运行。\n\n请在任务栏右下角点击 ^ 查看隐藏图标，或在任务管理器中结束多余的 MesaPrintAgent 后再启动。",
	)
	os.Exit(0)
}
