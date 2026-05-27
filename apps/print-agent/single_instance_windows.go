//go:build windows

package main

import (
	"os"
	"syscall"
	"unsafe"
)

const agentMutexName = "Global\\MesaPrintAgent-SingleInstance-v1"

const errorAlreadyExists = syscall.Errno(183)

// Held until process exit so the mutex stays owned by this instance.
var agentInstanceMutex syscall.Handle

// acquireAgentSingleInstance returns false if another main agent instance is already running.
func acquireAgentSingleInstance() bool {
	if agentInstanceMutex != 0 {
		return true
	}
	name, err := syscall.UTF16PtrFromString(agentMutexName)
	if err != nil {
		return true
	}
	kernel32 := syscall.NewLazyDLL("kernel32.dll")
	createMutexW := kernel32.NewProc("CreateMutexW")
	getLastError := kernel32.NewProc("GetLastError")

	handle, _, _ := createMutexW.Call(0, 0, uintptr(unsafe.Pointer(name)))
	if handle == 0 {
		return true
	}
	agentInstanceMutex = syscall.Handle(handle)

	// CreateMutex returns a valid handle when the mutex already exists; check GetLastError.
	errno, _, _ := getLastError.Call()
	if syscall.Errno(errno) == errorAlreadyExists {
		_ = syscall.CloseHandle(agentInstanceMutex)
		agentInstanceMutex = 0
		return false
	}
	return true
}

func exitAlreadyRunning() {
	messageBoxOK(
		"Mesa Print Agent",
		"打印代理已在运行，无法启动第二个实例。\n\n请在任务栏右下角点击 ^ 查看托盘图标。\n若需重启，请先在任务管理器中结束 MesaPrintAgent，再重新打开。",
	)
	os.Exit(0)
}
